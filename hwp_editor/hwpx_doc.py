"""HWPX(zip 안의 OWPML XML) 문서를 열고, 문단 글을 바꾸고, 원본 구조를 그대로 둔 채 다시 묶는다.

HWPX 는 ``Contents/section0.xml`` 같은 섹션 XML 에 ``<hp:p>``(문단) → ``<hp:run>`` → ``<hp:t>``(글) 가
들어 있다. 글만 ``<hp:t>`` 안에서 바꾸고 나머지(글꼴·표·그림·쪽 설정)는 손대지 않으므로
한글에서 열었을 때 서식이 보존된다. 표 칸 안의 문단은 ``<hp:tbl>`` 아래 다시 ``<hp:p>`` 로 들어 있어
깊이(depth)로 구분해 보여 준다.
"""
from __future__ import annotations

import io
import random
import re
import zipfile
import xml.etree.ElementTree as ET

NAMESPACES = {
    "ha": "http://www.hancom.co.kr/hwpml/2011/app",
    "hp": "http://www.hancom.co.kr/hwpml/2011/paragraph",
    "hp10": "http://www.hancom.co.kr/hwpml/2016/paragraph",
    "hs": "http://www.hancom.co.kr/hwpml/2011/section",
    "hc": "http://www.hancom.co.kr/hwpml/2011/core",
    "hh": "http://www.hancom.co.kr/hwpml/2011/head",
    "hhs": "http://www.hancom.co.kr/hwpml/2011/history",
    "hm": "http://www.hancom.co.kr/hwpml/2011/master-page",
    "hpf": "http://www.hancom.co.kr/schema/2011/hpf",
    "hv": "http://www.hancom.co.kr/hwpml/2011/version",
    "dc": "http://purl.org/dc/elements/1.1/",
    "opf": "http://www.idpf.org/2007/opf/",
    "ooxmlchart": "http://www.hancom.co.kr/hwpml/2016/ooxmlchart",
    "hwpunitchar": "http://www.hancom.co.kr/hwpml/2016/HwpUnitChar",
    "epub": "http://www.idpf.org/2007/ops",
    "config": "urn:oasis:names:tc:opendocument:xmlns:config:1.0",
}
for _prefix, _uri in NAMESPACES.items():
    ET.register_namespace(_prefix, _uri)

HP = "{%s}" % NAMESPACES["hp"]
SECTION_RE = re.compile(r"^Contents/section(\d+)\.xml$")
XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
PREVIEW_TEXT = "Preview/PrvText.txt"

# <hp:t> 안에 글과 섞여 들어오는 조절 요소. 글로 바꿔 보여 주고, 저장할 때 다시 요소로 만든다.
INLINE_TO_TEXT = {"tab": "\t", "lineBreak": "\n", "nbSpace": " ", "fwSpace": " ", "hyphen": "-"}


class HwpxError(ValueError):
    pass


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def register_namespaces(xml_bytes: bytes) -> None:
    """파일이 쓰는 접두사를 그대로 쓰도록 등록한다. 등록 못 하는 접두사(ns0 꼴)는 건너뛴다."""
    for prefix, uri in re.findall(rb'xmlns:([\w.-]+)="([^"]+)"', xml_bytes):
        try:
            ET.register_namespace(prefix.decode(), uri.decode())
        except ValueError:
            pass


def t_text(t: ET.Element) -> str:
    """``<hp:t>`` 하나의 글. 자식 요소(탭·줄바꿈)는 글자로 바꾸고 그 뒤 글(tail)도 이어 붙인다."""
    parts = [t.text or ""]
    for child in t:
        parts.append(INLINE_TO_TEXT.get(_local(child.tag), ""))
        parts.append(child.tail or "")
    return "".join(parts)


def fill_t(t: ET.Element, text: str) -> None:
    """``<hp:t>`` 를 비우고 새 글로 채운다. 탭은 ``<hp:tab/>``, 줄바꿈은 ``<hp:lineBreak/>`` 요소로."""
    for child in list(t):
        t.remove(child)
    tokens = re.split(r"([\t\n])", text)
    t.text = tokens[0]
    last: ET.Element | None = None
    for tok in tokens[1:]:
        if tok == "\t":
            last = ET.SubElement(t, HP + "tab", {"width": "8000", "leader": "NONE", "type": "LEFT"})
            last.tail = ""
        elif tok == "\n":
            last = ET.SubElement(t, HP + "lineBreak")
            last.tail = ""
        elif last is not None:
            last.tail = tok


def para_runs(p: ET.Element) -> list[ET.Element]:
    return [c for c in p if c.tag == HP + "run"]


def para_ts(p: ET.Element) -> list[ET.Element]:
    """문단 바로 아래 run 들의 ``<hp:t>``. 표 칸 안 문단의 글은 그 문단 몫이라 여기엔 안 들어온다."""
    return [t for run in para_runs(p) for t in run if t.tag == HP + "t"]


def para_text(p: ET.Element) -> str:
    return "".join(t_text(t) for t in para_ts(p))


def para_has_objects(p: ET.Element) -> bool:
    """표·그림·구역 설정처럼 글 말고 다른 것을 품은 문단인지. 이런 문단은 지우지 못하게 막는다."""
    for run in para_runs(p):
        for child in run:
            if child.tag != HP + "t":
                return True
    return False


def set_para_text(p: ET.Element, text: str) -> None:
    """문단의 글을 바꾼다. 첫 ``<hp:t>`` 에 모두 넣고 나머지 ``<hp:t>`` 는 뺀다(서식은 첫 run 것을 따른다)."""
    ts = para_ts(p)
    if not ts:
        if text == "":
            return
        runs = para_runs(p)
        ref = runs[-1].get("charPrIDRef", "0") if runs else "0"
        run = ET.Element(HP + "run", {"charPrIDRef": ref})
        pos = len(p)
        for i, child in enumerate(p):
            if child.tag == HP + "linesegarray":
                pos = i
                break
        p.insert(pos, run)
        ts = [ET.SubElement(run, HP + "t")]
    for t in ts[1:]:
        run = next(r for r in para_runs(p) if t in list(r))
        run.remove(t)
        if len(run) == 0:
            p.remove(run)
    fill_t(ts[0], text)


def new_para_like(src: ET.Element, text: str) -> ET.Element:
    """``src`` 와 같은 문단·글자 서식을 쓰는 새 문단. 개체(표·구역 설정)는 복사하지 않는다."""
    attrs = {
        "id": str(random.randrange(1, 2**31)),
        "paraPrIDRef": src.get("paraPrIDRef", "0"),
        "styleIDRef": src.get("styleIDRef", "0"),
        "pageBreak": "0",
        "columnBreak": "0",
        "merged": "0",
    }
    p = ET.Element(HP + "p", attrs)
    runs = para_runs(src)
    ref = "0"
    for run in runs:
        if any(c.tag == HP + "t" for c in run):
            ref = run.get("charPrIDRef", "0")
            break
    else:
        if runs:
            ref = runs[-1].get("charPrIDRef", "0")
    run = ET.SubElement(p, HP + "run", {"charPrIDRef": ref})
    t = ET.SubElement(run, HP + "t")
    fill_t(t, text)
    return p


def serialize(root: ET.Element) -> bytes:
    return (XML_DECL + ET.tostring(root, encoding="unicode")).encode("utf-8")


class HwpxDocument:
    """HWPX 한 파일. ``paragraphs()`` 로 문단 목록을 보고 ``apply()`` 로 고친 뒤 ``to_bytes()`` 로 다시 묶는다."""

    kind = "hwpx"

    def __init__(self, data: bytes):
        try:
            self.zip_in = zipfile.ZipFile(io.BytesIO(data))
        except zipfile.BadZipFile as e:
            raise HwpxError("zip 으로 열 수 없는 파일입니다") from e
        names = self.zip_in.namelist()
        self.section_names = sorted(
            (n for n in names if SECTION_RE.match(n)), key=lambda n: int(SECTION_RE.match(n).group(1))
        )
        if not self.section_names:
            raise HwpxError("HWPX 가 아닙니다 (Contents/section*.xml 이 없음)")
        self.roots: dict[str, ET.Element] = {}
        for name in self.section_names:
            raw = self.zip_in.read(name)
            register_namespaces(raw)
            try:
                self.roots[name] = ET.fromstring(raw)
            except ET.ParseError as e:
                raise HwpxError(f"{name} 을 XML 로 읽지 못했습니다: {e}") from e
        self._index()

    # ── 문단 목록 ─────────────────────────────────
    def _index(self) -> None:
        """문서 순서대로 모든 문단(표 칸 안 포함)에 번호를 매기고 부모를 기억한다."""
        self.elems: dict[str, ET.Element] = {}
        self.parent: dict[ET.Element, ET.Element] = {}
        self.meta: list[dict] = []
        n = 0
        for name in self.section_names:
            root = self.roots[name]
            for parent in root.iter():
                for child in parent:
                    self.parent[child] = parent

            def walk(el: ET.Element, depth: int) -> None:
                nonlocal n
                for child in el:
                    if child.tag == HP + "p":
                        pid = str(n)
                        n += 1
                        self.elems[pid] = child
                        self.meta.append({"id": pid, "section": name, "depth": depth, "el": child})
                        walk(child, depth + 1)
                    else:
                        walk(child, depth)

            walk(root, 0)

    def paragraphs(self) -> list[dict]:
        out = []
        for m in self.meta:
            p = m["el"]
            siblings = [c for c in self.parent[p] if c.tag == HP + "p"]
            out.append({
                "id": m["id"],
                "section": int(SECTION_RE.match(m["section"]).group(1)),
                "depth": m["depth"],
                "text": para_text(p),
                "hasObjects": para_has_objects(p),
                # 개체를 품었거나 그 자리(표 칸·구역)의 하나뿐인 문단은 지우지 않는다.
                "deletable": not para_has_objects(p) and len(siblings) > 1,
            })
        return out

    # ── 고치기 ─────────────────────────────────
    def apply(self, ops: list[dict]) -> None:
        """``{"op":"set","id","text"}`` ``{"op":"del","id"}`` ``{"op":"ins","after","id","text"}`` 를 차례로 적용한다.

        ``ins`` 의 ``id`` 는 새 문단에 붙일 임시 이름(``n1`` 꼴)이라 뒤의 op 가 그 문단을 다시 가리킬 수 있다.
        """
        for op in ops:
            kind = op.get("op")
            if kind == "set":
                p = self._get(op["id"])
                set_para_text(p, str(op.get("text", "")))
            elif kind == "del":
                p = self._get(op["id"])
                parent = self.parent[p]
                if para_has_objects(p):
                    raise HwpxError(f"문단 {op['id']} 은 표·그림·구역 설정을 품고 있어 지울 수 없습니다")
                if len([c for c in parent if c.tag == HP + "p"]) <= 1:
                    raise HwpxError(f"문단 {op['id']} 은 그 자리의 하나뿐인 문단이라 지울 수 없습니다")
                parent.remove(p)
                del self.elems[op["id"]]
            elif kind == "ins":
                ref = self._get(op["after"])
                parent = self.parent[ref]
                new = new_para_like(ref, str(op.get("text", "")))
                parent.insert(list(parent).index(ref) + 1, new)
                self.parent[new] = parent
                for child in new.iter():
                    for sub in child:
                        self.parent[sub] = child
                new_id = str(op.get("id") or f"n{len(self.elems)}")
                if new_id in self.elems:
                    raise HwpxError(f"문단 이름 {new_id} 이 겹칩니다")
                self.elems[new_id] = new
            else:
                raise HwpxError(f"모르는 op: {kind!r}")

    def _get(self, pid) -> ET.Element:
        try:
            return self.elems[str(pid)]
        except KeyError:
            raise HwpxError(f"없는 문단: {pid}") from None

    # ── 다시 묶기 ─────────────────────────────────
    def to_bytes(self) -> bytes:
        """원본 zip 의 항목 순서·압축 방식을 그대로 두고 섹션 XML 만 바꿔 쓴다(``mimetype`` 은 첫 항목·무압축이어야 한다)."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zout:
            for info in self.zip_in.infolist():
                if info.filename in self.roots:
                    data = serialize(self.roots[info.filename])
                elif info.filename == PREVIEW_TEXT:  # 미리보기 글도 고친 글로 맞춘다(인코딩은 원본 BOM 을 따른다)
                    old = self.zip_in.read(info)
                    enc = "utf-16-le" if old.startswith(b"\xff\xfe") else "utf-8"
                    data = (b"\xff\xfe" if enc == "utf-16-le" else b"") + self.to_text()[:4000].encode(enc)
                else:
                    data = self.zip_in.read(info)
                out = zipfile.ZipInfo(info.filename, date_time=info.date_time)
                out.compress_type = info.compress_type
                out.external_attr = info.external_attr
                zout.writestr(out, data)
        return buf.getvalue()

    def to_text(self) -> str:
        """지금 문서의 글. ``self.meta`` 는 연 때의 목록이라 지우고 더한 문단이 빠지므로 섹션 XML 을 다시 훑는다."""
        return "\n".join(para_text(p) for p in self._iter_paras())

    def _iter_paras(self):
        """섹션 순서·문서 순서대로 모든 ``<hp:p>``(표 칸 안 포함)."""

        def walk(el: ET.Element):
            for child in el:
                if child.tag == HP + "p":
                    yield child
                yield from walk(child)

        for name in self.section_names:
            yield from walk(self.roots[name])
