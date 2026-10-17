"""HWP·HWPX 편집기 로컬 서버. 표준 라이브러리만 쓴다(HWP 읽기에만 olefile).

    python -m hwp_editor            # 127.0.0.1:8765 에 열고 브라우저를 띄운다
    python -m hwp_editor --port 9000 --no-browser

API
    POST /api/open   본문 = 파일 바이트, 헤더 X-Filename(URL 인코딩)  → {token, kind, name, paragraphs, notes}
    POST /api/save   JSON {token, ops, format: "hwpx"|"txt"}          → 파일(내려받기)
    POST /api/close  JSON {token}
열린 문서는 메모리에만 두고, 서버를 끄면 사라진다. 바깥에서 접속하지 못하게 127.0.0.1 에만 묶는다.
"""
from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote, unquote

from .hwp_doc import HwpDocument, HwpError
from .hwpx_doc import HwpxDocument, HwpxError
from .hwpx_template import build_hwpx

# PyInstaller 로 묶인 실행 파일이면 풀어 놓은 임시 폴더(sys._MEIPASS) 아래에 static 이 있다.
_BASE = getattr(sys, "_MEIPASS", None)
STATIC_DIR = os.path.join(_BASE, "hwp_editor", "static") if _BASE else os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
MAX_UPLOAD = 200 * 1024 * 1024
DOC_TTL = 6 * 60 * 60  # 여섯 시간 안 쓴 문서는 메모리에서 지운다

_docs: dict[str, dict] = {}
_lock = threading.Lock()


def open_document(name: str, data: bytes):
    """확장자 말고 내용(서명)으로 형식을 가른다."""
    if data.startswith(b"PK"):
        return HwpxDocument(data)
    if data.startswith(b"\xd0\xcf\x11\xe0"):
        return HwpDocument(data)
    ext = os.path.splitext(name)[1].lower()
    raise HwpxError(f"HWP(5.0) 도 HWPX 도 아닌 파일입니다 ({ext or '확장자 없음'}). 한글 97 이하 .hwp 는 지원하지 않습니다")


def _notes(doc) -> list[str]:
    if doc.kind == "hwp":
        return [
            "HWP(이진) 파일은 원본 형식으로 다시 저장할 수 없습니다. 고친 글은 HWPX(글만 담은 새 문서) 나 txt 로 내려받습니다.",
            "서식·표·그림은 담기지 않고 글만 옮겨집니다. 표 안 문단은 보통 문단으로 펴서 보입니다.",
        ]
    return ["글만 바꾸고 서식·표·그림·쪽 설정은 그대로 둡니다. 저장한 파일은 한글에서 열어 확인하세요."]


def _stem(name: str) -> str:
    base = os.path.basename(name or "document")
    return os.path.splitext(base)[0] or "document"


class Handler(BaseHTTPRequestHandler):
    server_version = "hwp-editor/1.0"

    def log_message(self, fmt, *args):  # 조용히
        if os.environ.get("HWP_EDITOR_DEBUG"):
            super().log_message(fmt, *args)

    # ── 응답 도우미 ─────────────────────────────
    def _send(self, status: int, body: bytes, ctype: str, extra: dict | None = None):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, obj):
        self._send(status, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def _error(self, status: int, msg: str):
        self._json(status, {"error": msg})

    def _body(self) -> bytes:
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_UPLOAD:
            raise ValueError(f"파일이 너무 큽니다 ({n // 1024 // 1024}MB > {MAX_UPLOAD // 1024 // 1024}MB)")
        return self.rfile.read(n)

    # ── 라우팅 ─────────────────────────────
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            with open(os.path.join(STATIC_DIR, "index.html"), "rb") as f:
                return self._send(200, f.read(), "text/html; charset=utf-8")
        if path == "/api/health":
            return self._json(200, {"ok": True, "open": len(_docs)})
        self._error(404, "없는 주소")

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        try:
            if path == "/api/open":
                return self._open()
            if path == "/api/save":
                return self._save()
            if path == "/api/close":
                return self._close()
            return self._error(404, "없는 주소")
        except (HwpError, HwpxError, ValueError, KeyError, json.JSONDecodeError) as e:
            return self._error(400, str(e) or e.__class__.__name__)
        except Exception as e:  # noqa: BLE001 — 사용자 화면에 이유를 보여 준다
            return self._error(500, f"{e.__class__.__name__}: {e}")

    # ── 동작 ─────────────────────────────
    def _open(self):
        name = unquote(self.headers.get("X-Filename") or "document")
        data = self._body()
        if not data:
            raise ValueError("파일이 비어 있습니다")
        doc = open_document(name, data)
        token = secrets.token_urlsafe(16)
        with _lock:
            _expire()
            entry = {"doc": doc, "name": name, "at": time.time()}
            if doc.kind == "hwp":  # 읽기 전용이라 고친 글은 서버 쪽 목록에 따로 쌓아 둔다
                entry["items"] = [(p["id"], p["text"]) for p in doc.paragraphs()]
            _docs[token] = entry
        info = {
            "token": token, "kind": doc.kind, "name": name, "size": len(data),
            "paragraphs": doc.paragraphs(), "notes": _notes(doc),
        }
        if doc.kind == "hwp":
            info["version"] = doc.version
        self._json(200, info)

    def _save(self):
        req = json.loads(self._body().decode("utf-8"))
        with _lock:
            entry = _docs.get(str(req.get("token")))
            if not entry:
                raise KeyError("열린 문서가 없습니다. 파일을 다시 올려 주세요(서버를 다시 켰거나 오래 두면 사라집니다)")
            entry["at"] = time.time()
            doc, name = entry["doc"], entry["name"]
            fmt = req.get("format") or ("hwpx" if doc.kind == "hwpx" else "hwpx")
            ops = req.get("ops") or []
            if doc.kind == "hwpx":
                doc.apply(ops)
                payload = doc.to_text().encode("utf-8") if fmt == "txt" else doc.to_bytes()
            else:
                _apply_to_items(entry["items"], ops)
                texts = [t for _, t in entry["items"]]
                payload = "\n".join(texts).encode("utf-8") if fmt == "txt" else build_hwpx(texts, _stem(name))
        out_name = f"{_stem(name)}.{fmt}"
        self._send(200, payload, "application/octet-stream", {
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(out_name)}",
            "X-Filename": quote(out_name),
        })

    def _close(self):
        req = json.loads(self._body().decode("utf-8") or "{}")
        with _lock:
            _docs.pop(str(req.get("token")), None)
        self._json(200, {"ok": True})


def _apply_to_items(items: list[tuple[str, str]], ops: list[dict]) -> list[tuple[str, str]]:
    """HWP(읽기 전용) 의 ``(문단 id, 글)`` 목록에 set/del/ins 를 제자리에서 적용한다. id 는 ``paragraphs()`` 것과 같다."""

    def find(pid) -> int:
        for i, (k, _) in enumerate(items):
            if k == str(pid):
                return i
        raise KeyError(f"없는 문단: {pid}")

    for op in ops:
        kind = op.get("op")
        if kind == "set":
            i = find(op["id"])
            items[i] = (items[i][0], str(op.get("text", "")))
        elif kind == "del":
            del items[find(op["id"])]
        elif kind == "ins":
            i = find(op["after"])
            new_id = str(op.get("id") or f"n{len(items)}")
            if any(k == new_id for k, _ in items):
                raise ValueError(f"문단 이름 {new_id} 이 겹칩니다")
            items.insert(i + 1, (new_id, str(op.get("text", ""))))
        else:
            raise ValueError(f"모르는 op: {kind!r}")
    return items


def _expire():
    now = time.time()
    for k in [k for k, v in _docs.items() if now - v["at"] > DOC_TTL]:
        del _docs[k]


def main(argv=None):
    ap = argparse.ArgumentParser(description="HWP·HWPX 편집기 (로컬 웹)")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--host", default="127.0.0.1", help="기본 127.0.0.1. 다른 기기에서 쓰려면 0.0.0.0 (권장하지 않음)")
    ap.add_argument("--no-browser", action="store_true", help="브라우저를 자동으로 띄우지 않는다")
    args = ap.parse_args(argv)
    # Windows 에서 콘솔·파일 인코딩이 cp949/cp1252 면 한글 메시지가 UnicodeEncodeError 로 실행을 끊는다. 못 적는 글자는 ? 로.
    for stream in (sys.stdout, sys.stderr):
        if stream is not None and hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")
    httpd = None
    # 더블클릭으로 켰는데 포트가 이미 쓰이고 있으면(앞서 켠 편집기 등) 다음 번호를 몇 개 더 시도한다.
    for port in range(args.port, args.port + 20):
        try:
            httpd = ThreadingHTTPServer((args.host, port), Handler)
            break
        except OSError as e:
            last = e
    if httpd is None:
        print(f"{args.host}:{args.port} 부터 20개 포트를 열 수 없습니다 ({last}). --port 로 다른 번호를 주세요.", file=sys.stderr)
        if getattr(sys, "frozen", False):
            input("아무 키나 누르면 닫힙니다...")
        return 1
    port = httpd.server_address[1]
    url = f"http://{'127.0.0.1' if args.host == '0.0.0.0' else args.host}:{port}/"
    print(f"HWP·HWPX 편집기: {url}", flush=True)
    print("이 창을 닫거나 Ctrl+C 를 누르면 편집기가 꺼집니다. 브라우저가 안 뜨면 위 주소를 직접 여세요.", flush=True)
    if not args.no_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n끝.")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
