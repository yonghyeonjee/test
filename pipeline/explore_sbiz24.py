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
    """
    6차: 앱이 요청에 붙이는 헤더를 번들에서 긁어내 그 헤더로 부른다.

    5차에서 /api/cmmn/file/… 은 200, 없는 경로 /api/robots.txt 는 404 가
    아니라 똑같은 500 이었다. 해외 차단이 아니라 JSON API 앞단 필터가
    라우팅 전에 우리 요청을 거절하는 것이다. 코드에 Origin-Method,
    sysGroup, headers.common[...] 같은 흔적이 있었다.
    """
    r = S.get(f"{BASE}/", timeout=20)
    scripts = re.findall(r'<script[^>]+src="([^"]+)"', r.text)
    idx = js_of(scripts[0])
    conf = js_of(scripts[1]) if len(scripts) > 1 else ""

    print("\n=== axios 인스턴스를 만드는 자리와 그 설정")
    around(idx, r"init axios instance with", 900, 2)
    around(idx, r"Wj\(\{", 700, 4)
    around(idx, r"isApiUrl", 900, 2)
    around(idx, r"Ln\.prototype\.get=", 900, 1)
    around(idx, r"Ln\.prototype\.post=", 700, 1)
    around(idx, r"Origin-Method", 500, 3)
    around(idx, r"sysGroup", 400, 5)
    around(idx, r"headers\.common", 350, 8)
    print("\n=== UserScriptConf.js (설정 파일) 머리")
    print("    " + conf[:1500].replace("\n", "\n    "))

    names = set()
    for pat in [r'headers\.common\[["\']([A-Za-z0-9\-]+)["\']\]', r'headers\.common\.([A-Za-z][A-Za-z0-9]*)\s*=',
                r'headers\[["\']([A-Za-z0-9\-]+)["\']\]\s*=', r'["\']([A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+)["\']\s*:']:
        for m in re.findall(pat, idx):
            if m.lower() not in ("accept", "content-type", "authorization", "accept-language", "cache-control", "content-disposition",
                                 "x-content-type-options", "x-frame-options", "set-cookie", "user-agent"):
                names.add(m)
    names = sorted(names)
    print("\n=== 번들에서 본 헤더 이름 후보", names[:60])

    url = BASE + "/api/combinePbanc/getPbancTpbiz"
    def try_headers(hs, tag):
        h = dict(S.headers); h.update(hs)
        try:
            r = requests.get(url, headers=h, timeout=25)
        except Exception as e:
            print(f"\n--- {tag}: 실패 {type(e).__name__}"); return None
        body = r.text[:160].replace("\n", " ")
        print(f"\n--- {tag}: {r.status_code} {body}")
        return r

    print("\n=== 후보 헤더를 하나씩")
    vals = ["PT", "pt", "sbiz24", "SBIZ24", "true", "1", "GET", "ko"]
    good = []
    for n in names[:40]:
        for v in vals:
            r = try_headers({n: v}, f"{n}: {v}")
            if r is not None and r.status_code != 500:
                good.append((n, v)); break
    print("\n=== 500 이 아니게 만든 헤더", good)
    if good:
        r = try_headers(dict(good), "전부 함께")
        if r is not None:
            show("전부 함께", r, 1500)
            if r.ok and "json" in r.headers.get("content-type", ""):
                r2 = requests.post(BASE + "/api/combinePbanc/list", headers={**dict(S.headers), **dict(good)},
                                   json={"pageIndex": 1, "pageSize": 10}, timeout=25)
                show("POST /api/combinePbanc/list (pageIndex/pageSize)", r2, 2500)
                r3 = requests.get(BASE + "/api/combinePbanc/list", headers={**dict(S.headers), **dict(good)},
                                  params={"pageIndex": 1, "pageSize": 10}, timeout=25)
                show("GET /api/combinePbanc/list (pageIndex/pageSize)", r3, 2500)


if __name__ == "__main__":
    main()
