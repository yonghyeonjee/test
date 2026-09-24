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
    7차: 앱의 http 래퍼가 하는 그대로 부른다.

    6차에서 래퍼를 찾았다. /api/ 주소에 대한 get() 은 실제로는
      POST url, body={search:{}}, headers={Accept, Content-Type, "Origin-Method":"GET"}
    다. 응답은 data.default.list 에 목록이 온다. 우리가 보낸 요청에는
    search 래퍼가 없어서 서버가 500 을 냈던 것으로 보인다.
    """
    S.get(f"{BASE}/", timeout=20)
    H = {"Accept": "application/json", "Content-Type": "application/json", "Origin-Method": "GET"}

    def post(path, body, tag=None, n=1400):
        try:
            r = S.post(BASE + path, json=body, headers=H, timeout=30)
        except Exception as e:
            print(f"\n--- POST {path}: 실패 {type(e).__name__}"); return None
        show(tag or f"POST {path} {json.dumps(body, ensure_ascii=False)}", r, n)
        return r

    print("\n=== 1) 코드 목록 — 래퍼 모양 검증")
    r = post("/api/combinePbanc/getPbancTpbiz", {"search": {}})
    ok_shape = r is not None and r.ok
    print("\n### 래퍼 모양이 맞나:", ok_shape)

    print("\n=== 2) 통합공고 목록 — 페이지 파라미터 찾기")
    bodies = [
        {"search": {}},
        {"search": {}, "pageIndex": 1, "pageSize": 10},
        {"search": {}, "page": 1, "size": 10},
        {"search": {}, "currentPage": 1, "pageSize": 10},
        {"search": {}, "paging": {"pageIndex": 1, "pageSize": 10}},
        {"search": {"pageIndex": 1, "pageSize": 10}},
        {"search": {}, "pageIndex": 2, "pageSize": 10},
    ]
    got = None
    for b in bodies:
        r = post("/api/combinePbanc/list", b)
        if r is not None and r.ok and "json" in r.headers.get("content-type", ""):
            try:
                j = r.json()
                d = j.get("data", {}).get("default", j.get("data", j))
                lst = d.get("list") if isinstance(d, dict) else None
                print(f"    → list 길이 {len(lst) if isinstance(lst, list) else '?'}  default keys {list(d.keys())[:20] if isinstance(d, dict) else type(d)}")
                if isinstance(lst, list) and lst:
                    got = got or (b, j)
                    (OUT / f"list_{len(OUT.iterdir().__class__.__name__)}_{abs(hash(json.dumps(b)))%10000}.json").write_text(r.text[:600000], encoding="utf-8")
            except Exception as e:
                print("    json 해석 실패", e)

    if got:
        b, j = got
        d = j["data"]["default"] if "data" in j and "default" in j["data"] else j
        print("\n### 통합공고 첫 항목 전체:")
        print(json.dumps(d["list"][0], ensure_ascii=False, indent=1)[:4000])
        print("\n### 첫 3건 요약:")
        for it in d["list"][:3]:
            print("   ", {k: it.get(k) for k in ("pbancSn", "pbancNm", "departNm", "rcrtTypeCdNm", "aplyPd", "pbancBgngDt", "pbancEndDt", "regionNm", "bizType", "pbancKindCd", "url", "pbancUrl", "dtlUrl")})
        print("\n### 총 건수처럼 보이는 키:", {k: v for k, v in d.items() if k != "list"})

    print("\n=== 3) 화면이 조건을 어떻게 붙이는지 (청크 조각)")
    idx = js_of(re.findall(r'<script[^>]+src="([^"]+)"', S.get(f"{BASE}/", timeout=20).text)[0])
    ch = re.findall(r'import\("\./(PtCombinePbancList\.[0-9a-f]{6,10}\.js)"\)', idx)
    if ch:
        js = js_of(ch[0])
        around(js, r'url:"/combinePbanc/list"', 2600, 1)
        around(js, r"setCondition\(", 300, 12)
        around(js, r"getListByPbancSn|loadData|\.search\(|\.list\(", 500, 6)


if __name__ == "__main__":
    main()
