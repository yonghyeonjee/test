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
    apis, words = set(), set()
    for src in scripts:
        url = src if src.startswith("http") else BASE + (src if src.startswith("/") else "/" + src)
        try:
            js = S.get(url, timeout=30).text
        except Exception as e:
            print("  js 실패", url, type(e).__name__)
            continue
        print(f"  js {url} {len(js)}자")
        for m in re.findall(r'["\'`](/api/[A-Za-z0-9_/\-\.{}$]+)["\'`]', js):
            apis.add(m)
        for m in re.findall(r'[A-Za-z]*(?:[Pp]banc|[Cc]ombine)[A-Za-z]*', js):
            words.add(m)
        # SPA 가 자주 쓰는 모양: "combinePbancList" 근처의 URL 조각
        for m in re.finditer(r'[Cc]ombinePbanc[A-Za-z]*', js):
            a, b = max(0, m.start() - 300), min(len(js), m.end() + 300)
            snippet = js[a:b].replace("\n", " ")
            print("  near combinePbanc:", snippet[:600])
            break

    print("\n=== /api/ 경로 후보", len(apis))
    for a in sorted(apis):
        print("  ", a)
    print("\n=== pbanc/combine 낱말", len(words))
    print("  ", sorted(words)[:80])
    (OUT / "api-candidates.txt").write_text("\n".join(sorted(apis)), encoding="utf-8")

    # 3) 후보 두드리기 — 목록처럼 보이는 것만
    picks = [a for a in sorted(apis) if re.search(r"pbanc|combine|list", a, re.I)]
    guesses = [
        "/api/pbanc/combinePbancList", "/api/combinePbancList", "/api/pbanc/combine/list",
        "/api/bsnsPbanc/combinePbancList", "/api/cmmn/pbanc/combinePbancList",
    ]
    for p in guesses:
        if p not in picks:
            picks.append(p)
    print("\n=== 두드려 볼 경로", picks[:25])
    for p in picks[:25]:
        url = BASE + p.replace("{", "").replace("}", "")
        for method, kw in [
            ("GET", {"params": {"page": 1, "size": 10, "pageIndex": 1, "pageNo": 1}}),
            ("POST", {"json": {"page": 1, "size": 10, "pageIndex": 1, "pageNo": 1, "combine": "combine"}}),
        ]:
            try:
                r = S.request(method, url, timeout=25, **kw)
            except Exception as e:
                print(f"\n--- {method} {p}: 실패 {type(e).__name__}")
                continue
            show(f"{method} {p}", r)
            if r.ok and "json" in r.headers.get("content-type", ""):
                safe = re.sub(r"[^A-Za-z0-9]+", "_", p)
                (OUT / f"{method}{safe}.json").write_text(r.text[:200000], encoding="utf-8")


if __name__ == "__main__":
    main()
