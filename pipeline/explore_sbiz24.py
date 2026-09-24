"""
explore_sbiz24.py — 소상공인24(sbiz24.kr) 통합공고 목록이 어느 API 로 오는지 찾는다.

화면은 SPA(#/combinePbancList)라 HTML 에 목록이 없다. 브라우저가 부르는
JSON API 를 찾아야 한다. 이 샌드박스에서는 그 사이트에 닿지 않아 Actions
러너에서 돌린다.

  1) robots.txt 를 읽고 /api 가 막혀 있는지 본다.
  2) 첫 화면 HTML 에서 JS 번들 주소를 뽑아 내려받고, 그 안의 문자열에서
     "/api/…" 경로와 pbanc·combine 이 든 낱말을 모은다.
  3) 후보 경로에 GET·POST 를 보내 무엇이 오는지 찍는다.

여기서 찍힌 것을 보고 진짜 수집기를 쓴다. 이 파일은 짐작으로 몇 가지
경로를 두드려 보지만, 그건 탐침이라 그렇다 — 수집기에는 확인된 것만 넣는다.
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
S.headers.update({"User-Agent": UA, "Accept": "application/json, text/plain, */*", "Accept-Language": "ko-KR,ko;q=0.9"})


def show(tag, r, n=700):
    ct = r.headers.get("content-type", "")
    body = r.text or ""
    print(f"\n--- {tag}\n    {r.status_code} {ct} {len(body)}자")
    print("    " + body[:n].replace("\n", "\n    "))
    try:
        j = r.json()
        if isinstance(j, dict):
            print("    keys:", list(j.keys())[:20])
            for k, v in j.items():
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    print(f"    {k}[0] keys:", list(v[0].keys())[:40])
                    print(f"    {k}[0]:", json.dumps(v[0], ensure_ascii=False)[:900])
                elif isinstance(v, dict):
                    for k2, v2 in v.items():
                        if isinstance(v2, list) and v2 and isinstance(v2[0], dict):
                            print(f"    {k}.{k2}[0] keys:", list(v2[0].keys())[:40])
                            print(f"    {k}.{k2}[0]:", json.dumps(v2[0], ensure_ascii=False)[:900])
        elif isinstance(j, list) and j and isinstance(j[0], dict):
            print("    [0] keys:", list(j[0].keys())[:40])
            print("    [0]:", json.dumps(j[0], ensure_ascii=False)[:900])
    except Exception:
        pass


def main():
    # 1) robots
    try:
        r = S.get(f"{BASE}/robots.txt", timeout=20)
        print("=== robots.txt", r.status_code)
        print(r.text[:1500])
    except Exception as e:
        print("robots.txt 실패:", type(e).__name__, e)

    # 2) 첫 화면 → JS 번들
    try:
        r = S.get(f"{BASE}/", timeout=20)
        html = r.text
        print(f"\n=== index {r.status_code} {len(html)}자")
        (OUT / "index.html").write_text(html, encoding="utf-8")
    except Exception as e:
        print("index 실패:", type(e).__name__, e)
        sys.exit(0)

    scripts = re.findall(r'<script[^>]+src="([^"]+)"', html)
    print("scripts:", scripts[:30])

    def fetch_js(src):
        url = src if src.startswith("http") else BASE + "/" + src.lstrip("./")
        try:
            js = S.get(url, timeout=30).text
        except Exception as e:
            print("  js 실패", url, type(e).__name__)
            return url, ""
        print(f"  js {url} {len(js)}자")
        return url, js

    # 1차 번들 → 공고 화면의 지연 로딩 청크 이름을 찾는다.
    # Vue 라우터가 import("./PtCombinePbancList.xxxx.js") 처럼 적어 둔다.
    chunks = set()
    for src in scripts:
        url, js = fetch_js(src)
        (OUT / Path(url).name).write_text(js, encoding="utf-8")
        for m in re.findall(r'import\("\./([A-Za-z0-9_\-]*(?:[Pp]banc|[Cc]ombine|[Aa]pi|[Hh]ttp|[Rr]equest)[A-Za-z0-9_\-]*\.[0-9a-f]{6,10}\.js)"\)', js):
            chunks.add(m)
        # 공통 요청 래퍼가 든 청크(vendor·index)에서 baseURL 을 본다.
        for m in re.findall(r'baseURL\s*:\s*["\'`]([^"\'`]{1,80})["\'`]', js):
            print("  baseURL:", m)

    print("\n=== 공고 관련 청크", sorted(chunks))
    apis = {}
    for name in sorted(chunks):
        url, js = fetch_js(name)
        if not js:
            continue
        (OUT / name).write_text(js, encoding="utf-8")
        for m in re.finditer(r'["\'`](/?api/[A-Za-z0-9_/\-\.{}$]+)["\'`]', js):
            path = m.group(1)
            a, b = max(0, m.start() - 420), min(len(js), m.end() + 420)
            apis.setdefault(path, []).append(js[a:b].replace("\n", " "))
        # 경로 문자열이 조각나 있을 수 있어, 요청 호출 자리도 따로 본다.
        for m in re.finditer(r'\.(post|get)\(', js):
            a, b = max(0, m.start() - 260), min(len(js), m.end() + 360)
            snip = js[a:b].replace("\n", " ")
            if "pbanc" in snip.lower() or "api" in snip.lower():
                print(f"\n  [{name}] .{m.group(1)}( 근처:\n    {snip[:620]}")

    print("\n=== 청크에서 찾은 /api 경로", len(apis))
    for path, snips in sorted(apis.items()):
        print(f"\n--- {path}")
        for sn in snips[:2]:
            print("    " + sn[:840])

    # 2) 두드리기. 청크에서 찾은 경로 + 근처에서 보인 파라미터 이름을 그대로 쓴다.
    param_names = set()
    for snips in apis.values():
        for sn in snips:
            for m in re.findall(r'\b(page[A-Za-z]*|[a-z]+Page|pageUnit|pageSize|recordCountPerPage|srch[A-Za-z]*|search[A-Za-z]*|pbanc[A-Za-z]*|combine[A-Za-z]*|sortOrder|sort[A-Za-z]*)\s*:', sn):
                param_names.add(m)
    print("\n=== 근처 파라미터 이름", sorted(param_names))

    base_params = {"pageIndex": 1, "pageNo": 1, "page": 1, "currentPage": 1,
                   "pageUnit": 10, "pageSize": 10, "recordCountPerPage": 10, "size": 10,
                   "combine": "combine"}
    picks = [p for p in apis if re.search(r"pbanc|combine|list|search", p, re.I)]
    print("\n=== 두드려 볼 경로", picks[:30])
    for p in picks[:30]:
        url = BASE + "/" + p.lstrip("/").replace("{", "").replace("}", "").replace("$", "")
        for method, kw in [("GET", {"params": base_params}), ("POST", {"json": base_params}),
                           ("POST", {"data": base_params})]:
            try:
                r = S.request(method, url, timeout=25, **kw)
            except Exception as e:
                print(f"\n--- {method} {p}: 실패 {type(e).__name__}")
                continue
            show(f"{method}({'form' if 'data' in kw else 'json' if 'json' in kw else 'query'}) {p}", r)
            if r.ok and "json" in r.headers.get("content-type", ""):
                safe = re.sub(r"[^A-Za-z0-9]+", "_", p)
                (OUT / f"{method}{safe}.json").write_text(r.text[:200000], encoding="utf-8")


if __name__ == "__main__":
    main()
