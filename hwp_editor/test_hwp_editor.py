"""HWP·HWPX 편집기 검사.  python hwp_editor/test_hwp_editor.py  (저장소 루트에서)"""
import io
import json
import os
import struct
import sys
import threading
import unittest
import urllib.request
import zipfile
import zlib
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hwp_editor import app as app_mod  # noqa: E402
from hwp_editor.hwp_doc import TAG_PARA_HEADER, TAG_PARA_TEXT, HwpError, parse_section  # noqa: E402
from hwp_editor.hwpx_doc import HwpxDocument, HwpxError, para_text  # noqa: E402
from hwp_editor.hwpx_template import build_hwpx  # noqa: E402

HP = "http://www.hancom.co.kr/hwpml/2011/paragraph"
HS = "http://www.hancom.co.kr/hwpml/2011/section"


def record(tag: int, level: int, body: bytes) -> bytes:
    head = tag | (level << 10) | (len(body) << 20)
    return struct.pack("<I", head) + body


def utf16(s: str) -> bytes:
    return s.encode("utf-16-le")


def hwpx_with_table() -> bytes:
    """바깥 문단 둘과 표(칸 둘) 가 든 손으로 만든 섹션. 칸 하나는 문단 하나만 가진다."""
    sec = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hs:sec xmlns:hs="{HS}" xmlns:hp="{HP}">
  <hp:p id="1" paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0"><hp:secPr id=""/></hp:run><hp:run charPrIDRef="3"><hp:t>첫 문단 </hp:t><hp:t>둘째 run</hp:t></hp:run></hp:p>
  <hp:p id="2" paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0"><hp:t>표 앞<hp:tab/>탭 뒤</hp:t></hp:run>
    <hp:run charPrIDRef="0"><hp:tbl id="9" rowCnt="1" colCnt="2"><hp:tr>
      <hp:tc><hp:subList><hp:p id="3" paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0"><hp:t>칸1</hp:t></hp:run></hp:p></hp:subList></hp:tc>
      <hp:tc><hp:subList><hp:p id="4" paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0"><hp:t>칸2a</hp:t></hp:run></hp:p><hp:p id="5" paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0"><hp:t>칸2b</hp:t></hp:run></hp:p></hp:subList></hp:tc>
    </hp:tr></hp:tbl></hp:run></hp:p>
  <hp:p id="6" paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0"/></hp:p>
</hs:sec>'''
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        mt = zipfile.ZipInfo("mimetype"); mt.compress_type = zipfile.ZIP_STORED
        z.writestr(mt, b"application/hwp+zip")
        z.writestr("Contents/header.xml", b"<x/>", zipfile.ZIP_DEFLATED)
        z.writestr("Contents/section0.xml", sec.encode("utf-8"), zipfile.ZIP_DEFLATED)
        z.writestr("BinData/image1.png", b"\x89PNG\r\n\x1a\n" + bytes(range(256)) * 4, zipfile.ZIP_DEFLATED)
        z.writestr("Preview/PrvText.txt", "\ufeff첫 문단 둘째 run".encode("utf-16-le"), zipfile.ZIP_DEFLATED)
    return buf.getvalue()


class HwpxTest(unittest.TestCase):
    def test_paragraphs_including_table_cells(self):
        doc = HwpxDocument(hwpx_with_table())
        ps = doc.paragraphs()
        self.assertEqual([p["text"] for p in ps], ["첫 문단 둘째 run", "표 앞\t탭 뒤", "칸1", "칸2a", "칸2b", ""])
        self.assertEqual([p["depth"] for p in ps], [0, 0, 1, 1, 1, 0])
        self.assertTrue(ps[0]["hasObjects"] and ps[1]["hasObjects"])
        self.assertEqual([p["deletable"] for p in ps], [False, False, False, True, True, True])

    def test_edit_roundtrip_keeps_other_entries(self):
        src = hwpx_with_table()
        doc = HwpxDocument(src)
        doc.apply([
            {"op": "set", "id": "0", "text": "고친 첫 문단"},
            {"op": "set", "id": "2", "text": "칸1 고침\n둘째 줄"},
            {"op": "del", "id": "4"},
            {"op": "ins", "after": "3", "id": "n1", "text": "칸2 새 문단\t탭"},
            {"op": "ins", "after": "n1", "id": "n2", "text": "그 다음"},
            {"op": "set", "id": "5", "text": "빈 문단에 글"},
        ])
        out = doc.to_bytes()
        with zipfile.ZipFile(io.BytesIO(out)) as z, zipfile.ZipFile(io.BytesIO(src)) as z0:
            self.assertEqual(z.namelist(), z0.namelist())
            self.assertEqual(z.infolist()[0].filename, "mimetype")
            self.assertEqual(z.infolist()[0].compress_type, zipfile.ZIP_STORED)
            self.assertEqual(z.read("BinData/image1.png"), z0.read("BinData/image1.png"))
            self.assertEqual(z.read("Contents/header.xml"), z0.read("Contents/header.xml"))
            xml = z.read("Contents/section0.xml").decode("utf-8")
            self.assertTrue(z.read("Preview/PrvText.txt").decode("utf-16").startswith("고친 첫 문단\n표 앞"))
        self.assertTrue(xml.startswith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'))
        self.assertIn("<hp:secPr", xml)  # 구역 설정은 그대로
        self.assertIn("<hp:tbl", xml)
        self.assertIn("<hp:lineBreak", xml)
        self.assertIn("<hp:tab ", xml)
        self.assertNotIn("ns0:", xml)
        self.assertIn('xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"', xml.split(">", 2)[1])
        again = HwpxDocument(out).paragraphs()
        self.assertEqual([p["text"] for p in again], ["고친 첫 문단", "표 앞\t탭 뒤", "칸1 고침\n둘째 줄", "칸2a", "칸2 새 문단\t탭", "그 다음", "빈 문단에 글"])
        self.assertEqual([p["depth"] for p in again], [0, 0, 1, 1, 1, 1, 0])

    def test_delete_rules(self):
        doc = HwpxDocument(hwpx_with_table())
        with self.assertRaises(HwpxError):
            doc.apply([{"op": "del", "id": "2"}])  # 칸의 하나뿐인 문단
        with self.assertRaises(HwpxError):
            doc.apply([{"op": "del", "id": "1"}])  # 표를 품은 문단
        with self.assertRaises(HwpxError):
            doc.apply([{"op": "set", "id": "99", "text": "x"}])

    def test_not_hwpx(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("a.txt", b"hi")
        with self.assertRaises(HwpxError):
            HwpxDocument(buf.getvalue())
        with self.assertRaises(HwpxError):
            HwpxDocument(b"not a zip")

    def test_template_opens_and_edits(self):
        data = build_hwpx(["제목", "본문\t탭\n줄바꿈", ""], "제목")
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            self.assertEqual(z.namelist()[0], "mimetype")
            self.assertEqual(z.read("mimetype"), b"application/hwp+zip")
            import xml.etree.ElementTree as ET
            for name in z.namelist()[1:]:
                if name.endswith((".xml", ".hpf", ".rdf")):
                    ET.fromstring(z.read(name))  # 모두 올바른 XML
            # 한컴 HWPX 처럼 rootfile 의 full-path 는 접두사 없는 속성이어야 다른 프로그램이 본문을 찾는다
            ocf = "{urn:oasis:names:tc:opendocument:xmlns:container}"
            roots = ET.fromstring(z.read("META-INF/container.xml")).iter(ocf + "rootfile")
            self.assertIn("Contents/content.hpf", [r.get("full-path") for r in roots])
            self.assertIn("META-INF/container.rdf", z.namelist())
            for part in ("Contents/header.xml", "Contents/section0.xml"):  # 한컴 표준 루트 선언 15개
                head = z.read(part).decode("utf-8").split(">", 2)[1]
                import re
                self.assertEqual(len(re.findall(r'\sxmlns:[\w.-]+="', head)), 15, part)
            self.assertTrue(z.read("Preview/PrvText.txt").decode("utf-16").startswith("제목"))
        doc = HwpxDocument(data)
        self.assertEqual([p["text"] for p in doc.paragraphs()], ["제목", "본문\t탭\n줄바꿈", ""])
        self.assertTrue(doc.paragraphs()[0]["hasObjects"])  # secPr
        doc.apply([{"op": "set", "id": "1", "text": "바뀜"}])
        self.assertEqual(HwpxDocument(doc.to_bytes()).paragraphs()[1]["text"], "바뀜")


# ── 최소 OLE 복합 문서(CFB) 만들기: 4096 바이트 미만 스트림만 담아 모두 미니 스트림에 둔다 ──
SECT, MINI = 512, 64
ENDOFCHAIN, FREESECT, FATSECT = 0xFFFFFFFE, 0xFFFFFFFF, 0xFFFFFFFD
NOSTREAM = 0xFFFFFFFF


def _dir_entry(name, typ, left=NOSTREAM, right=NOSTREAM, child=NOSTREAM, start=0, size=0):
    raw = name.encode("utf-16-le") + b"\x00\x00"
    return struct.pack("<64sHBBIII16sIQQIII", raw.ljust(64, b"\x00"), len(raw), typ, 1, left, right, child,
                       b"\x00" * 16, 0, 0, 0, start, size, 0)


def build_cfb(streams: dict) -> bytes:
    """``{"FileHeader": b..., "BodyText/Section0": b...}`` → OLE 파일. 저장소는 한 단계만."""
    assert all(len(v) < 4096 for v in streams.values())
    # 미니 스트림과 미니 FAT
    mini, minifat, starts = bytearray(), [], {}
    for path, data in streams.items():
        first = len(mini) // MINI
        starts[path] = first
        n = max(1, -(-len(data) // MINI))
        mini += data.ljust(n * MINI, b"\x00")
        minifat += list(range(first + 1, first + n)) + [ENDOFCHAIN]
    # 디렉터리 항목: 0 루트, 그 다음 최상위 항목들(스트림이나 저장소), 저장소 아래 스트림들
    entries, top = [None], []
    groups: dict = {}
    for path in streams:
        if "/" in path:
            groups.setdefault(path.split("/", 1)[0], []).append(path)
        else:
            top.append(path)
    idx: dict = {}
    for path in top:
        idx[path] = len(entries); entries.append(["stream", path, path])
    for store, paths in groups.items():
        idx[store] = len(entries); entries.append(["storage", store, paths])
    for store, paths in groups.items():
        for path in paths:
            idx[path] = len(entries); entries.append(["stream", path.split("/", 1)[1], path])

    def chain_siblings(names):  # 형제를 오른쪽 사슬로 잇는다(올바른 적흑 트리는 아니지만 olefile 은 따라간다)
        for a, b in zip(names, names[1:]):
            links[idx[a]] = idx[b]

    links: dict = {}
    top_names = top + list(groups)
    chain_siblings(top_names)
    for store, paths in groups.items():
        chain_siblings(paths)
    mini_start_sector = None  # 나중에 채운다
    dir_bytes = bytearray()
    n_dir_sects = -(-len(entries) * 128 // SECT)
    n_minifat_sects = max(1, -(-len(minifat) * 4 // SECT))
    n_mini_sects = max(1, -(-len(mini) // SECT))
    dir_first, minifat_first, mini_first = 1, 1 + n_dir_sects, 1 + n_dir_sects + n_minifat_sects
    dir_bytes += _dir_entry("Root Entry", 5, child=idx[top_names[0]] if top_names else NOSTREAM, start=mini_first, size=len(mini))
    for i, (kind, name, ref) in enumerate(entries[1:], 1):
        if kind == "storage":
            dir_bytes += _dir_entry(name, 1, right=links.get(i, NOSTREAM), child=idx[ref[0]])
        else:
            dir_bytes += _dir_entry(name, 2, right=links.get(i, NOSTREAM), start=starts[ref], size=len(streams[ref]))
    dir_bytes = dir_bytes.ljust(n_dir_sects * SECT, b"\x00")
    minifat_bytes = b"".join(struct.pack("<I", v) for v in minifat).ljust(n_minifat_sects * SECT, b"\xff")
    mini_bytes = bytes(mini).ljust(n_mini_sects * SECT, b"\x00")
    total = 1 + n_dir_sects + n_minifat_sects + n_mini_sects
    fat = [FREESECT] * (SECT // 4)
    fat[0] = FATSECT
    for first, n in ((dir_first, n_dir_sects), (minifat_first, n_minifat_sects), (mini_first, n_mini_sects)):
        for k in range(first, first + n):
            fat[k] = k + 1 if k < first + n - 1 else ENDOFCHAIN
    fat_bytes = b"".join(struct.pack("<I", v) for v in fat)
    difat = [0] + [FREESECT] * 108
    header = struct.pack("<8s16sHHHHH6sIIIIIIIII", b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", b"\x00" * 16, 0x3E, 3, 0xFFFE, 9, 6,
                         b"\x00" * 6, 0, 1, dir_first, 0, 4096, minifat_first, n_minifat_sects, ENDOFCHAIN, 0)
    header += b"".join(struct.pack("<I", v) for v in difat)
    assert len(header) == SECT and total < SECT // 4
    return header + fat_bytes + bytes(dir_bytes) + minifat_bytes + mini_bytes


def build_hwp(sections: list, flags: int = 1) -> bytes:
    """레코드 바이트 목록 → HWP 5.0 파일. flags 비트0 압축."""
    head = b"HWP Document File".ljust(32, b"\x00") + bytes([0, 0, 0, 5]) + struct.pack("<I", flags)
    streams = {"FileHeader": head.ljust(256, b"\x00")}
    for i, sec in enumerate(sections):
        if flags & 1:
            c = zlib.compressobj(wbits=-15); sec = c.compress(sec) + c.flush()
        streams[f"BodyText/Section{i}"] = sec
    return build_cfb(streams)


def sample_hwp_records(*texts: str) -> bytes:
    return b"".join(record(TAG_PARA_HEADER, 0, b"\x00" * 22) + record(TAG_PARA_TEXT, 1, utf16(t) + struct.pack("<H", 13)) for t in texts)


class HwpTest(unittest.TestCase):
    def test_real_ole_container(self):
        data = build_hwp([sample_hwp_records("첫 문단", "둘째 문단"), sample_hwp_records("둘째 구역")])
        import olefile
        self.assertTrue(olefile.isOleFile(data))
        doc = app_mod.HwpDocument(data)
        self.assertEqual(doc.version, "5.0.0.0")
        self.assertEqual([(p["id"], p["section"], p["text"]) for p in doc.paragraphs()],
                         [("0", 0, "첫 문단"), ("1", 0, "둘째 문단"), ("2", 1, "둘째 구역")])
        self.assertEqual(app_mod.HwpDocument(build_hwp([sample_hwp_records("압축 안 함")], flags=0)).to_text(), "압축 안 함")
        with self.assertRaisesRegex(HwpError, "암호"):
            app_mod.HwpDocument(build_hwp([sample_hwp_records("x")], flags=0b11))
        with self.assertRaisesRegex(HwpError, "배포용"):
            app_mod.HwpDocument(build_hwp([sample_hwp_records("x")], flags=0b101))

    def test_parse_section_records(self):
        sec = b"".join([
            record(TAG_PARA_HEADER, 0, b"\x00" * 22),
            record(TAG_PARA_TEXT, 1, utf16("안녕") + struct.pack("<H", 9) + b"\x00" * 14 + utf16("탭") + struct.pack("<H", 13)),
            record(TAG_PARA_HEADER, 0, b"\x00" * 22),   # 빈 문단(PARA_TEXT 없음)
            record(TAG_PARA_HEADER, 0, b"\x00" * 22),
            record(TAG_PARA_TEXT, 1, struct.pack("<H", 11) + b"\x00" * 14 + utf16("표 뒤") + struct.pack("<H", 13)),
            record(TAG_PARA_HEADER, 2, b"\x00" * 22),   # 표 칸 안
            record(TAG_PARA_TEXT, 3, utf16("칸") + struct.pack("<H", 13)),
        ])
        self.assertEqual(parse_section(sec), [
            {"text": "안녕\t탭", "depth": 0}, {"text": "", "depth": 0}, {"text": "표 뒤", "depth": 0}, {"text": "칸", "depth": 1},
        ])

    def test_long_record_size(self):
        body = utf16("가" * 3000)
        sec = record(TAG_PARA_HEADER, 0, b"\x00" * 22) + struct.pack("<I", TAG_PARA_TEXT | (1 << 10) | (0xFFF << 20)) + struct.pack("<I", len(body)) + body
        self.assertEqual(parse_section(sec)[0]["text"], "가" * 3000)

    def test_rejects_non_ole(self):
        with self.assertRaises(HwpError):
            app_mod.HwpDocument(b"PK\x03\x04 not ole")

    def test_apply_to_items(self):
        items = [("0", "a"), ("1", "b"), ("2", "c")]
        app_mod._apply_to_items(items, [{"op": "del", "id": "1"}, {"op": "set", "id": "2", "text": "C"}, {"op": "ins", "after": "0", "id": "n1", "text": "x"}])
        self.assertEqual(items, [("0", "a"), ("n1", "x"), ("2", "C")])
        app_mod._apply_to_items(items, [{"op": "set", "id": "n1", "text": "X"}])  # 두 번째 저장에서도 새 문단을 가리킬 수 있다
        self.assertEqual(items[1], ("n1", "X"))


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), app_mod.Handler)
        cls.url = f"http://127.0.0.1:{cls.httpd.server_address[1]}"
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown(); cls.httpd.server_close()

    def post(self, path, body, headers=None):
        req = urllib.request.Request(self.url + path, data=body, method="POST", headers=headers or {})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, dict(r.headers), r.read()
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), e.read()

    def test_open_edit_save_hwpx(self):
        status, _, body = self.post("/api/open", hwpx_with_table(), {"X-Filename": "%ED%85%8C%EC%8A%A4%ED%8A%B8.hwpx"})
        self.assertEqual(status, 200, body)
        info = json.loads(body)
        self.assertEqual(info["kind"], "hwpx"); self.assertEqual(info["name"], "테스트.hwpx")
        self.assertEqual(len(info["paragraphs"]), 6)
        ops = [{"op": "set", "id": "0", "text": "서버로 고침"}]
        status, headers, out = self.post("/api/save", json.dumps({"token": info["token"], "ops": ops, "format": "hwpx"}).encode())
        self.assertEqual(status, 200, out)
        self.assertIn("UTF-8''%ED%85%8C%EC%8A%A4%ED%8A%B8.hwpx", headers["Content-Disposition"])
        self.assertEqual(HwpxDocument(out).paragraphs()[0]["text"], "서버로 고침")
        status, _, txt = self.post("/api/save", json.dumps({"token": info["token"], "ops": [], "format": "txt"}).encode())
        self.assertTrue(txt.decode("utf-8").startswith("서버로 고침\n표 앞\t탭 뒤\n칸1"))

    def test_open_edit_save_hwp(self):
        data = build_hwp([sample_hwp_records("공고", "모집 분야")])
        status, _, body = self.post("/api/open", data, {"X-Filename": "a.hwp"})
        self.assertEqual(status, 200, body)
        info = json.loads(body)
        self.assertEqual(info["kind"], "hwp"); self.assertIn("HWPX", info["notes"][0])
        ops = [{"op": "set", "id": "1", "text": "모집 분야: 행정"}, {"op": "ins", "after": "1", "id": "n1", "text": "새 문단"}]
        status, headers, out = self.post("/api/save", json.dumps({"token": info["token"], "ops": ops, "format": "hwpx"}).encode())
        self.assertEqual(status, 200, out)
        self.assertTrue(headers["Content-Disposition"].endswith("a.hwpx"))
        self.assertEqual([p["text"] for p in HwpxDocument(out).paragraphs()], ["공고", "모집 분야: 행정", "새 문단"])
        # 두 번째 저장: 앞서 더한 문단을 다시 고칠 수 있어야 한다(서버가 고친 상태를 들고 있다)
        status, _, out = self.post("/api/save", json.dumps({"token": info["token"], "ops": [{"op": "set", "id": "n1", "text": "고친 새 문단"}], "format": "txt"}).encode())
        self.assertEqual(out.decode("utf-8"), "공고\n모집 분야: 행정\n고친 새 문단")

    def test_errors(self):
        status, _, body = self.post("/api/open", b"hello", {"X-Filename": "a.doc"})
        self.assertEqual(status, 400); self.assertIn("HWP", json.loads(body)["error"])
        status, _, body = self.post("/api/save", json.dumps({"token": "nope", "ops": []}).encode())
        self.assertEqual(status, 400)
        with urllib.request.urlopen(self.url + "/") as r:
            self.assertIn("HWP", r.read().decode("utf-8"))


if __name__ == "__main__":
    unittest.main(verbosity=1)
