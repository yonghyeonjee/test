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
    scripts = re.findall(r'<script[^>]+src="([^"]+)"', html)
    print("scripts:", scripts)
    idx = js_of(scripts[0])

    print("\n=== 공통 요청 래퍼 (index 번들)")
    around(idx, r"interceptors\.request\.use", 900, 3)
    around(idx, r"Use-Encryption", 500, 3)
    around(idx, r"X-Requested-With|X-CSRF|XSRF|Authorization", 400, 4)
    around(idx, r"baseURL", 300, 4)
    around(idx, r'"/api/"|`/api/|\'/api/', 400, 4)

    chunks = sorted(set(re.findall(r'import\("\./((?:PtCombinePbancList|PtPbancList|PtLcgPbancList|PtExtldPbancList)\.[0-9a-f]{6,10}\.js)"\)', idx)))
    print("\n=== 목록 청크", chunks)
    for name in chunks:
        js = js_of(name)
        (OUT / name).write_text(js, encoding="utf-8")
        print(f"\n=== [{name}] 경로처럼 보이는 문자열")
        print("   ", sorted(set(re.findall(r'["\'`](/[A-Za-z][A-Za-z0-9_/\-]{2,60})["\'`]', js)))[:80])
        print(f"\n=== [{name}] sbiz24PbancList 근처")
        around(js, r"sbiz24PbancList", 1500, 4)
        print(f"\n=== [{name}] apiBind / .post( / .get( / params 근처")
        around(js, r"apiBind", 700, 3)
        around(js, r"\.post\(", 700, 4)
        around(js, r"pageIndex|pageUnit|pageSize|currentPage|recordCount", 500, 4)
        around(js, r"combine", 400, 4)

    # 몇 가지 모양으로 불러 본다
    url = BASE + "/api/pbanc/sbiz24PbancList"
    bodies = [
        {"pageIndex": 1, "pageUnit": 10},
        {"pageIndex": 1, "pageUnit": 10, "combine": "combine"},
        {"pageIndex": 1, "pageUnit": 10, "pbancKindCd": "", "srchWord": ""},
        {"page": 1, "rows": 10},
        {"currentPage": 1, "pageSize": 10},
        {"start": 0, "length": 10},
        {},
    ]
    hdr_sets = [
        {},
        {"X-Requested-With": "XMLHttpRequest", "Content-Type": "application/json;charset=UTF-8"},
    ]
    for hs in hdr_sets:
        for b in bodies:
            try:
                r = S.post(url, json=b, headers=hs, timeout=25)
            except Exception as e:
                print("\n--- POST 실패", b, type(e).__name__)
                continue
            show(f"POST {json.dumps(b, ensure_ascii=False)} hdr={list(hs)}", r)
            if r.ok and "json" in r.headers.get("content-type", ""):
                (OUT / "sbiz24PbancList.json").write_text(r.text[:400000], encoding="utf-8")
                print("\n### 됐다. 이 모양으로 수집기를 쓴다.")
                return
        for b in bodies[:3]:
            try:
                r = S.get(url, params=b, headers=hs, timeout=25)
            except Exception as e:
                print("\n--- GET 실패", b, type(e).__name__)
                continue
            show(f"GET {b} hdr={list(hs)}", r)
            if r.ok and "json" in r.headers.get("content-type", ""):
                (OUT / "sbiz24PbancList.json").write_text(r.text[:400000], encoding="utf-8")
                print("\n### 됐다. 이 모양으로 수집기를 쓴다.")
                return


if __name__ == "__main__":
    main()
