"""
explore_sbiz24.py — 소상공인24(sbiz24.kr) 통합공고 목록 API 의 요청 모양을 찾는다.

7~8차에서 확정된 것:
  POST /api/combinePbanc/list  본문 {"search":{...}}  헤더 Origin-Method: GET
  응답 data.default = { page(Spring Pageable), total, list[] }

9차: 페이지 넘김과 상세 엔드포인트.
  화면 공통 그리드 코드가 목록을 부를 때 본문을
    { sortModel:[], search:{...}, paging:true, startRow:size*(page-1), endRow:size*page }
  로 만든다(vendor 번들의 `ie.startRow=T*(M-1),ie.endRow=T*M`). 이 모양으로
  2페이지가 실제로 다른 항목을 주는지, 페이지 크기를 키울 수 있는지 확인한다.
  상세는 공고 구분(pbancGubun A/B/C/D)별로 후보 경로를 불러 본다.
"""

import json
import re
from pathlib import Path

import requests

BASE = "https://www.sbiz24.kr"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 narajiwon-probe/1.0 (+https://jiwon.knowhow-it.com)"
OUT = Path(__file__).resolve().parent.parent / "samples" / "sbiz24"
OUT.mkdir(parents=True, exist_ok=True)
S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept": "application/json, text/plain, */*",
                  "Accept-Language": "ko-KR,ko;q=0.9", "Referer": BASE + "/", "Origin": BASE})
H = {"Accept": "application/json", "Content-Type": "application/json", "Origin-Method": "GET"}


def post(path, body):
    r = S.post(BASE + path, json=body, headers=H, timeout=30)
    j = r.json() if "json" in r.headers.get("content-type", "") else None
    return r, j


def compact(d, n=1500):
    if not isinstance(d, dict):
        return json.dumps(d, ensure_ascii=False)[:n]
    return json.dumps({k: v for k, v in d.items()
                       if v not in (None, "", [], {}) and not str(k).startswith("fbFieldValue")},
                      ensure_ascii=False)[:n]


def page_body(page, size, search=None):
    return {"sortModel": [], "search": search or {}, "paging": True,
            "startRow": size * (page - 1), "endRow": size * page}


def pageinfo(j):
    d = j["data"]["default"]; pg = d.get("page", {}); lst = d.get("list", [])
    return {"number": pg.get("number"), "size": pg.get("size"), "n": len(lst),
            "totalPages": pg.get("totalPages"), "total": d.get("total"),
            "first": (lst[0].get("pbancNm") or "")[:24] if lst else None,
            "last": (lst[-1].get("pbancNm") or "")[:24] if lst else None}


def main():
    S.get(f"{BASE}/", timeout=20)

    print("=== 1) startRow/endRow 페이지 넘김")
    for page, size in [(1, 10), (2, 10), (1, 100), (2, 100), (1, 300), (1, 1000)]:
        try:
            r, j = post("/api/combinePbanc/list", page_body(page, size))
            print(f"  page={page} size={size} → {r.status_code} {pageinfo(j) if j else r.text[:100]}")
        except Exception as e:
            print("  실패", page, size, type(e).__name__, e)

    print("\n=== 2) 300건 받아 구분 분포")
    r, j = post("/api/combinePbanc/list", page_body(1, 300))
    lst = j["data"]["default"]["list"]
    (OUT / "combinePbanc_list_300.json").write_text(r.text, encoding="utf-8")
    dist = {}
    for x in lst:
        dist[x.get("pbancGubun")] = dist.get(x.get("pbancGubun"), 0) + 1
    print("  pbancGubun:", dist)
    print("  aplyPsbltySe:", {g: sum(1 for x in lst if x.get("aplyPsbltySe") == g) for g in set(x.get("aplyPsbltySe") for x in lst)})
    print("  bizType:", {g: sum(1 for x in lst if x.get("bizType") == g) for g in set(x.get("bizType") for x in lst)})
    print("  pbancKindCd:", {g: sum(1 for x in lst if x.get("pbancKindCd") == g) for g in set(x.get("pbancKindCd") for x in lst)})
    samples = {}
    for x in lst:
        g = x.get("pbancGubun")
        if g and g not in samples:
            samples[g] = x
    for g, x in sorted(samples.items()):
        print(f"\n  [{g}] {compact(x, 900)}")

    print("\n=== 3) 상세 후보 경로")
    cands = {
        "A": ["/api/pbanc/{sn}", "/api/dtlPbanc/{sn}", "/api/pbanc/{sn}/getPbanc", "/api/dtlPbanc/{sn}/getSprtBizSn",
              "/api/combinePbanc/{sn}", "/api/pbanc/sbiz24Pbanc/{sn}"],
        "B": ["/api/exltdPbanc/{id}", "/api/extldPbanc/{id}", "/api/exltdPbanc/{id}/getExltdPbanc"],
        "C": ["/api/loanProduct/{sn}", "/api/loan/loanProduct/{sn}", "/api/pbanc/{sn}"],
        "D": ["/api/lcgPbanc/{sn}", "/api/pbanc/{sn}", "/api/lcg/lcgPbanc/{sn}"],
    }
    for g, x in sorted(samples.items()):
        sn, pid = x.get("pbancSn"), x.get("pbancId")
        print(f"\n  --- {g} sn={sn} id={pid} {(x.get('pbancNm') or '')[:30]}")
        for tpl in cands.get(g, []):
            path = tpl.replace("{sn}", str(sn)).replace("{id}", str(pid))
            if "None" in path:
                continue
            try:
                r, j = post(path, {"search": {}})
                d = (j or {}).get("data", {}).get("default") if isinstance(j, dict) else None
                if isinstance(d, dict):
                    keys = sorted(k for k, v in d.items() if v not in (None, "", [], {}) and not k.startswith("fbFieldValue"))
                    print(f"  {path} → {r.status_code} keys={keys}")
                    print("     " + compact(d, 2500))
                    (OUT / f"detail_{g}.json").write_text(r.text, encoding="utf-8")
                else:
                    print(f"  {path} → {r.status_code} {r.text[:120]!r}")
            except Exception as e:
                print("  실패", path, type(e).__name__)

    print("\n=== 4) 상세 화면 청크의 API 바인딩")
    try:
        idx = S.get(BASE + "/", timeout=20).text
        names = sorted(set(re.findall(r'(?:assets/)?[A-Za-z0-9_-]+\.[a-f0-9]{8}\.js', idx)))
        chunk_names = []
        for m in re.findall(r'["\']([^"\']*Pt(?:Pbanc|LcgPbanc|LoanProduct)[A-Za-z]*View\.[a-f0-9]{8}\.js)["\']', idx):
            chunk_names.append(m)
        # index 에 없으면 main 번들에서 찾는다
        if not chunk_names:
            for n in names:
                if n.startswith("index."):
                    js = S.get(f"{BASE}/{n}", timeout=30).text
                    chunk_names = sorted(set(re.findall(r'(Pt(?:Pbanc|LcgPbanc|LoanProduct)[A-Za-z]*View\.[a-f0-9]{8}\.js)', js)))
                    break
        print("  chunks:", chunk_names)
        for n in chunk_names[:4]:
            n = n.split("/")[-1]
            js = S.get(f"{BASE}/{n}", timeout=30).text
            print(f"\n  [{n}] {len(js)}자")
            print("   apiBind:", re.findall(r'apiBind:\{[^}]{0,160}\}', js)[:6])
            print("   useResource/W(\"/..\"):", sorted(set(re.findall(r'\b[A-Za-z_$]{1,3}\("(/[A-Za-z][A-Za-z0-9/]+)"\)', js)))[:20])
            print("   /api 문자열:", sorted(set(re.findall(r'[`"](/api/[^`"$]{2,80})', js)))[:30])
            for m in list(re.finditer(r'loadData\(', js))[:3]:
                print("   loadData 근처:", js[max(0, m.start() - 300):m.end() + 200].replace("\n", " "))
    except Exception as e:
        print("  실패", type(e).__name__, e)


if __name__ == "__main__":
    main()
