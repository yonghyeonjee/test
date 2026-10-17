"""HWP 5.0(OLE 복합 문서) 를 읽어 문단 글을 뽑는다.

HWP 는 압축된 이진 레코드라 글만 바꿔 제자리에 다시 쓸 수 없다(레코드 길이·압축 스트림이 다 바뀜).
그래서 이 편집기는 HWP 를 **읽기**만 하고, 고친 글은 HWPX(글만 담은 새 문서) 나 txt 로 내려 준다.

레코드 머리 4바이트: 태그 10비트 · 수준(level) 10비트 · 크기 12비트(0xFFF 면 다음 4바이트가 크기).
PARA_HEADER(66) 뒤에 같은 문단의 PARA_TEXT(67) 가 수준 +1 로 따라온다. 표 칸 안 문단은 수준이 2 씩 깊다.
"""
from __future__ import annotations

import io
import zlib

TAG_BEGIN = 0x10
TAG_PARA_HEADER = TAG_BEGIN + 50
TAG_PARA_TEXT = TAG_BEGIN + 51
# 글자 코드 32 미만은 조절 문자. 이 코드들은 자기 포함 8 글자(16바이트)를 차지한다. 나머지(0·10·13·24~31)는 한 글자.
WIDE_CTRL = {1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23}
CHAR_OF = {9: "\t", 10: "\n", 24: "-", 30: " ", 31: " "}
SIGNATURE = b"HWP Document File"


class HwpError(ValueError):
    pass


def iter_records(section: bytes):
    """(tag, level, body) 를 차례로 낸다."""
    i, n = 0, len(section)
    while i + 4 <= n:
        h = int.from_bytes(section[i:i + 4], "little")
        tag, level, size = h & 0x3FF, (h >> 10) & 0x3FF, (h >> 20) & 0xFFF
        i += 4
        if size == 0xFFF:
            if i + 4 > n:
                return
            size = int.from_bytes(section[i:i + 4], "little")
            i += 4
        yield tag, level, section[i:i + size]
        i += size


def fix_surrogates(s: str) -> str:
    """짝이 맞는 UTF-16 대리 쌍(U+D800~DFFF 둘)은 한 글자로 합치고, 외톨이 대리 값은 U+FFFD 로 바꾼다.

    BMP 밖 글자(한글이 글머리표로 쓰는 U+F03DA 같은 사용자 정의 영역 글자)를 코드 단위마다 ``chr`` 로 만들면
    대리 값 둘이 남아 UTF-8·JSON 으로 내보내지 못하고 파일 열기가 통째로 실패한다.
    """
    if not any("\ud800" <= ch <= "\udfff" for ch in s):
        return s
    return s.encode("utf-16-le", "surrogatepass").decode("utf-16-le", "replace")


def decode_para_text(body: bytes, fix: bool = True) -> str:
    """PARA_TEXT 몸통 → 글. ``fix=False`` 면 대리 값을 그대로 두어, 여러 레코드를 이어 붙인 뒤 한 번에 고칠 수 있다."""
    chars, j = [], 0
    while j + 2 <= len(body):
        c = int.from_bytes(body[j:j + 2], "little")
        if c >= 32:
            chars.append(chr(c))
            j += 2
        elif c in WIDE_CTRL:
            if c == 9:
                chars.append("\t")
            j += 16
        else:
            if c == 13:  # 문단 끝
                pass
            elif c in CHAR_OF:
                chars.append(CHAR_OF[c])
            j += 2
    text = "".join(chars)
    return fix_surrogates(text) if fix else text


def parse_section(section: bytes) -> list[dict]:
    """압축을 푼 BodyText 섹션 하나 → ``[{"text", "depth"}]``. PARA_HEADER 마다 문단 하나(글 없는 빈 문단 포함)."""
    paras: list[dict] = []
    cur: dict | None = None
    for tag, level, body in iter_records(section):
        if tag == TAG_PARA_HEADER:
            cur = {"text": "", "depth": level // 2, "level": level}
            paras.append(cur)
        elif tag == TAG_PARA_TEXT and cur is not None and level == cur["level"] + 1:
            cur["text"] += decode_para_text(body, fix=False)
    for p in paras:
        del p["level"]
        p["text"] = fix_surrogates(p["text"])
    return paras


class HwpDocument:
    """HWP 5.0 한 파일(읽기 전용). 문단 글을 뽑아 ``paragraphs()`` 로 준다."""

    kind = "hwp"

    def __init__(self, data: bytes):
        try:
            import olefile
        except ImportError as e:  # pragma: no cover
            raise HwpError("olefile 이 없습니다. `pip install olefile` 을 먼저 하세요") from e
        if not data.startswith(b"\xd0\xcf\x11\xe0"):
            raise HwpError("HWP 5.0(OLE) 파일이 아닙니다")
        ole = olefile.OleFileIO(io.BytesIO(data))
        try:
            if not ole.exists("FileHeader"):
                raise HwpError("FileHeader 가 없어 HWP 가 아닙니다")
            head = ole.openstream("FileHeader").read()
            if not head.startswith(SIGNATURE):
                raise HwpError("HWP 서명이 없습니다")
            ver = head[32:36]
            self.version = f"{ver[3]}.{ver[2]}.{ver[1]}.{ver[0]}"
            flags = int.from_bytes(head[36:40], "little")
            if flags & 0b10:
                raise HwpError("암호가 걸린 문서는 열 수 없습니다")
            if flags & 0b100:
                raise HwpError("배포용 문서(ViewText)는 열 수 없습니다")
            compressed = bool(flags & 1)
            self.sections: list[list[dict]] = []
            entries = [e for e in ole.listdir() if len(e) == 2 and e[0] == "BodyText" and e[1].startswith("Section")]
            entries.sort(key=lambda e: int(e[1][7:]) if e[1][7:].isdigit() else 0)
            for entry in entries:
                raw = ole.openstream(entry).read()
                try:
                    sec = zlib.decompress(raw, -15) if compressed else raw
                except zlib.error as e:
                    raise HwpError(f"{'/'.join(entry)} 압축을 풀지 못했습니다: {e}") from e
                self.sections.append(parse_section(sec))
            if not self.sections:
                raise HwpError("본문(BodyText) 이 없습니다")
        finally:
            ole.close()

    def paragraphs(self) -> list[dict]:
        out, n = [], 0
        for si, sec in enumerate(self.sections):
            for p in sec:
                out.append({
                    "id": str(n), "section": si, "depth": p["depth"], "text": p["text"],
                    "hasObjects": False, "deletable": True,
                })
                n += 1
        return out

    def to_text(self) -> str:
        return "\n".join(p["text"] for sec in self.sections for p in sec)
