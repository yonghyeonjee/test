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
    5차: 해외 IP 차단인지 판정한다.

    4차까지 /api 아래 모든 호출이 헤더·본문과 무관하게 같은 500 이었다.
    파라미터가 없는 코드 목록까지 그랬다. 그렇다면 요청 모양이 아니라
    부르는 쪽(미국 러너)이 문제일 수 있다. 화면이 켜질 때 반드시 부르는
    메뉴 API 와, 검색엔진에 노출된 공개 파일 주소로 대조한다. 이것마저
    500 이면 /api 가 통째로 막힌 것이다.
    """
    r = S.get(f"{BASE}/", timeout=20)
    print("index", r.status_code, "server=", r.headers.get("server"), "via=", r.headers.get("via"), "cookies=", S.cookies.get_dict())

    def call(method, path, **kw):
        try:
            r = S.request(method, BASE + path, timeout=25, **kw)
        except Exception as e:
            print(f"\n--- {method} {path}: 실패 {type(e).__name__}"); return None
        print(f"\n--- {method} {path}\n    {r.status_code} {r.headers.get('content-type','')} {len(r.content)}B")
        print("    resp headers:", {k: v for k, v in r.headers.items() if k.lower() not in ("date",)})
        print("    " + (r.text[:300] if "json" in r.headers.get("content-type", "") or "text" in r.headers.get("content-type", "") else "(binary)"))
        return r

    print("\n=== 대조 1: 화면이 켜질 때 부르는 메뉴 API")
    for sys_ in ["PT", "pt", "SBIZ24", "sbiz24", "USER"]:
        call("GET", f"/api/cmmn/gnrl/Menu/{sys_}")

    print("\n=== 대조 2: 검색엔진에 노출된 공개 파일 주소 (구글이 색인한 것 = 누군가는 열었다)")
    call("GET", "/api/cmmn/file/4edbfcdd-5215-4930-b8b6-b7e8a937b2ee", stream=True)
    call("HEAD", "/api/cmmn/file/4edbfcdd-5215-4930-b8b6-b7e8a937b2ee")

    print("\n=== 대조 3: 정적 자원과 /api 의 응답 헤더 차이")
    call("GET", "/robots.txt")
    call("GET", "/api/robots.txt")
    call("GET", "/api/")
    call("GET", "/api")

    print("\n=== 대조 4: 인코딩·언어 헤더 없이 순수하게")
    h = {"User-Agent": UA}
    try:
        r = requests.get(BASE + "/api/combinePbanc/getPbancTpbiz", headers=h, timeout=25)
        print("\n--- 순수 GET getPbancTpbiz", r.status_code, dict(r.headers), r.text[:200])
    except Exception as e:
        print("실패", e)


if __name__ == "__main__":
    main()
