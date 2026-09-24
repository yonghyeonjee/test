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
    8차: 페이지 파라미터와 항목 필드명을 확정한다.

    7차에서 POST /api/combinePbanc/list + {search:{}} + Origin-Method:GET 이
    200 으로 열렸다. 응답의 page 가 Spring Pageable 모양이라 요청 쪽은
    ?page=&size= 쿼리일 가능성이 크다. 항목은 fbFieldValue1~ 같은 빈 열이
    앞을 가려 실제 필드가 안 보였다 — 비어 있지 않은 것만 찍는다.
    """
    S.get(f"{BASE}/", timeout=20)
    H = {"Accept": "application/json", "Content-Type": "application/json", "Origin-Method": "GET"}

    def post(path, body, params=None):
        r = S.post(BASE + path, json=body, params=params, headers=H, timeout=30)
        j = r.json() if "json" in r.headers.get("content-type", "") else None
        return r, j

    def pageinfo(j):
        d = j["data"]["default"]; pg = d.get("page", {})
        lst = d.get("list", [])
        return {"number": pg.get("number"), "size": pg.get("size"), "n": pg.get("numberOfElements"),
                "totalPages": pg.get("totalPages"), "total": d.get("total"),
                "firstSn": lst[0].get("pbancSn") if lst else None, "firstNm": (lst[0].get("pbancNm") or "")[:30] if lst else None}

    print("=== 1) 페이지 파라미터")
    for params, body in [
        (None, {"search": {}}),
        ({"page": 0, "size": 100}, {"search": {}}),
        ({"page": 1, "size": 100}, {"search": {}}),
        ({"page": 2, "size": 50}, {"search": {}}),
        (None, {"search": {}, "page": 1, "size": 100}),
        (None, {"search": {}, "pageNumber": 1, "pageSize": 100}),
        ({"page": 0, "size": 500}, {"search": {}}),
    ]:
        try:
            r, j = post("/api/combinePbanc/list", body, params)
            print(f"  params={params} body={json.dumps(body)} → {r.status_code} {pageinfo(j) if j else r.text[:100]}")
        except Exception as e:
            print("  실패", params, body, type(e).__name__, e)

    print("\n=== 2) 항목 필드 (비어 있지 않은 것만)")
    r, j = post("/api/combinePbanc/list", {"search": {}}, {"page": 0, "size": 30})
    lst = j["data"]["default"]["list"]
    (OUT / "combinePbanc_list_p0.json").write_text(r.text, encoding="utf-8")
    keys = set()
    for it in lst:
        keys.update(k for k, v in it.items() if v not in (None, "", [], {}) and not k.startswith("fbFieldValue"))
    print("  비어 있지 않은 키 합집합:", sorted(keys))
    for it in lst[:4]:
        print("\n  ---")
        print("  " + json.dumps({k: v for k, v in it.items() if v not in (None, "", [], {}) and not k.startswith("fbFieldValue")},
                                ensure_ascii=False)[:2500])
    print("\n  pbancGubun 분포(30건):", {g: sum(1 for x in lst if x.get("pbancGubun") == g) for g in set(x.get("pbancGubun") for x in lst)})

    print("\n=== 3) 정렬·조건이 먹는지 (마감임박순, 신청가능만)")
    for body in [{"search": {"ptPbancSortBy": "DEADLINE"}}, {"search": {"aplySeYn": "Y"}}, {"search": {"ptPbancSortBy": "INSERT"}}]:
        try:
            r, j = post("/api/combinePbanc/list", body, {"page": 0, "size": 5})
            d = j["data"]["default"]
            print(f"  {json.dumps(body)} → total {d.get('total')} 첫 {[ (x.get('pbancNm') or '')[:18] for x in d['list'][:3] ]}")
        except Exception as e:
            print("  실패", body, type(e).__name__)

    print("\n=== 4) 상세 하나 (pbancGubun A 인 것)")
    a_ = next((x for x in lst if x.get("pbancGubun") == "A" and x.get("pbancSn")), None)
    if a_:
        for path in [f"/api/pbanc/{a_['pbancSn']}", f"/api/combinePbanc/{a_['pbancSn']}", f"/api/pbanc/getPbanc/{a_['pbancSn']}"]:
            try:
                r, j = post(path, {"search": {}})
                d = (j or {}).get("data", {}).get("default")
                print(f"  {path} → {r.status_code} " + (json.dumps({k: v for k, v in d.items() if v not in (None, '', [], {}) and not str(k).startswith('fbFieldValue')}, ensure_ascii=False)[:1500] if isinstance(d, dict) else r.text[:120]))
            except Exception as e:
                print("  실패", path, type(e).__name__)


if __name__ == "__main__":
    main()
