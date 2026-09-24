"""
explore_sbiz24.py — 소상공인24(sbiz24.kr) 통합공고 목록 API 의 요청 모양을 찾는다.

2차 탐침에서 목록 API 가 /api/pbanc/sbiz24PbancList 라는 것까지 알았다.
없는 경로는 404 가 오는데 이건 500 이 온다 — 있지만 우리가 보낸 모양이
틀린 것이다. 이번에는
  1) 공통 요청 래퍼(axios interceptors)가 무슨 헤더를 붙이는지,
  2) 목록 화면 청크가 이 API 를 어떤 본문으로 부르는지
를 코드에서 그대로 찍고, 그 자리에서 몇 가지 모양으로 불러 본다.
"""

import json
import re
import sys
from pathlib import Path

import requests

BASE = "https://www.sbiz24.kr"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 narajiwon-probe/1.0 (+https://jiwon.knowhow-it.com)"
OUT = Path(__file__).resolve().parent.parent / "samples" / "sbiz24"
OUT.mkdir(parents=True, exist_ok=True)
S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept": "application/json, text/plain, */*",
                  "Accept-Language": "ko-KR,ko;q=0.9", "Referer": BASE + "/", "Origin": BASE})


def js_of(name):
    url = BASE + "/" + name.lstrip("./")
    r = S.get(url, timeout=30)
    print(f"  js {url} {r.status_code} {len(r.text)}자")
    return r.text


def around(js, pat, w=900, limit=6, flags=0):
    n = 0
    for m in re.finditer(pat, js, flags):
        a, b = max(0, m.start() - w), min(len(js), m.end() + w)
        print(f"\n    >>> {pat!r} @ {m.start()}\n    " + js[a:b].replace("\n", " "))
        n += 1
        if n >= limit:
            break
    if n == 0:
        print(f"\n    >>> {pat!r}: 없음")


def show(tag, r, n=500):
    ct = r.headers.get("content-type", "")
    body = r.text or ""
    print(f"\n--- {tag}\n    {r.status_code} {ct} {len(body)}자  hdrs={dict((k, v) for k, v in r.headers.items() if k.lower() in ('set-cookie', 'x-csrf-token', 'www-authenticate'))}")
    print("    " + body[:n].replace("\n", "\n    "))
    try:
        j = r.json()
        def walk(o, path="", depth=0):
            if depth > 3:
                return
            if isinstance(o, dict):
                print(f"    {path or '$'} keys:", list(o.keys())[:25])
                for k, v in o.items():
                    walk(v, f"{path}.{k}" if path else k, depth + 1)
            elif isinstance(o, list) and o and isinstance(o[0], dict):
                print(f"    {path}[0] keys:", list(o[0].keys())[:40])
                print(f"    {path}[0]:", json.dumps(o[0], ensure_ascii=False)[:1200])
        walk(j)
    except Exception:
        pass


def main():
    html = S.get(f"{BASE}/", timeout=20).text
    print("cookies after index:", S.cookies.get_dict())
    scripts = re.findall(r'<script[^>]+src="([^"]+)"', html)
    idx = js_of(scripts[0])
    vendor = re.findall(r'\./(vendor\.[0-9a-f]{6,10}\.js)', idx)
    print("vendor:", vendor[:2])

    print("\n=== index: 리소스 헬퍼 (useResource / '/api' 접두어 / 암호화 헤더)")
    around(idx, r"useResource", 700, 4)
    around(idx, r'"/api"|`/api|\'/api"|"/api/"\+|"api/"', 500, 6)
    around(idx, r"Use-Req-Encryption", 350, 6)
    around(idx, r"queue\.push", 500, 2)

    if vendor:
        vjs = js_of(vendor[0])
        print("\n=== vendor: 그리드가 목록을 부르는 자리")
        around(vjs, r"rowKey", 900, 3)
        around(vjs, r"initList", 900, 3)
        around(vjs, r"paging", 700, 4)
        around(vjs, r"pageSize", 500, 6)

    # 전제조건 가리기: 코드 목록(파라미터 거의 없음)
    def call(method, path, hs=None, **kw):
        h = dict(S.headers); h.update(hs or {})
        try:
            r = requests.request(method, BASE + path, headers=h, cookies=S.cookies, timeout=25, **kw)
        except Exception as e:
            print(f"\n--- {method} {path}: 실패 {type(e).__name__}"); return None
        show(f"{method} {path} hs={list((hs or {}).keys())} {kw.get('params') or kw.get('json') or kw.get('data') or ''}", r, 600)
        return r

    print("\n=== 전제조건 가리기")
    for hs in [{}, {"Origin": None, "Referer": None}, {"Accept": "*/*"}, {"Authorization": ""},
               {"X-Requested-With": "XMLHttpRequest"}]:
        hs2 = {k: v for k, v in hs.items() if v is not None}
        if hs and any(v is None for v in hs.values()):
            # Origin/Referer 를 아예 빼고
            h = {k: v for k, v in S.headers.items() if k not in ("Origin", "Referer")}
            try:
                r = requests.get(BASE + "/api/combinePbanc/getPbancTpbiz", headers=h, cookies=S.cookies, timeout=25)
                show("GET /api/combinePbanc/getPbancTpbiz (Origin/Referer 없이)", r, 600)
            except Exception as e:
                print("실패", e)
            continue
        call("GET", "/api/combinePbanc/getPbancTpbiz", hs2)
    call("POST", "/api/combinePbanc/getPbancTpbiz", {}, json={})

    print("\n=== 목록 부르기")
    bodies = [{"pageIndex": 1, "pageSize": 10}, {"page": 1, "size": 10}, {"currentPage": 1, "pageSize": 10},
              {"pageNo": 1, "pageSize": 10}, {"pageIndex": 1, "pageUnit": 10}, {"offset": 0, "limit": 10}, {}]
    for b in bodies:
        r = call("GET", "/api/combinePbanc/list", {}, params=b)
        if r is not None and r.ok and "json" in r.headers.get("content-type", ""):
            (OUT / "combinePbanc_list.json").write_text(r.text[:400000], encoding="utf-8"); print("\n### 됐다 GET", b); return
        r = call("POST", "/api/combinePbanc/list", {}, json=b)
        if r is not None and r.ok and "json" in r.headers.get("content-type", ""):
            (OUT / "combinePbanc_list.json").write_text(r.text[:400000], encoding="utf-8"); print("\n### 됐다 POST", b); return


if __name__ == "__main__":
    main()
