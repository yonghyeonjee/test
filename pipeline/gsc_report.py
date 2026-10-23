#!/usr/bin/env python3
"""서치 콘솔 자료를 API 로 뽑아 기록에 찍는다(손으로 내보내지 않아도 되게).

    python pipeline/gsc_report.py [--a 2026-10-01:2026-10-10] [--b 2026-10-11:] [--inspect 40]

1) 날짜별 클릭·노출(9월부터, 아직 확정 안 된 최근 날짜 포함)
2) 두 기간(A·B) 비교 — 쪽 종류별, 노출이 가장 많이 준 쪽·검색어, 검색 노출 유형(채용 정보 등)
3) A 기간에 노출이 많던 쪽을 URL 검사(색인 여부·마지막 크롤링·구글이 고른 정본·noindex 여부)
4) 사이트맵 상태
인증은 pipeline/google_auth.py(서비스 계정 또는 계정 로그인). 읽기 전용 범위만 쓴다.
URL 검사는 하루 2,000건 한도라 기본 40건.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import os
import re
import sys
import urllib.parse

import requests

from google_auth import WEBMASTERS_RO, access_token, mode

API = "https://searchconsole.googleapis.com"
HOST = "jiwon.knowhow-it.com"
KST = dt.timezone(dt.timedelta(hours=9))


def period(s: str, default_end: str) -> tuple[str, str]:
    a, _, b = s.partition(":")
    return a, (b or default_end)


def kind_of(url: str) -> str:
    p = urllib.parse.urlparse(url).path
    if re.fullmatch(r"/jobs/a\d+", p):
        return "채용 상세(잡알리오)"
    if re.fullmatch(r"/jobs/\d+", p):
        return "채용 상세(나라일터)"
    if p.startswith("/jobs"):
        return "채용 목록·기관·지역"
    if p.startswith("/p/"):
        return "지원사업 상세"
    if p.startswith("/story") or p.startswith("/blog"):
        return "글"
    if p in ("", "/"):
        return "첫 화면"
    return "그 밖의 쪽(" + "/" + p.strip("/").split("/")[0] + ")"


class GSC:
    def __init__(self, token: str):
        self.h = {"Authorization": f"Bearer {token}"}

    def get(self, path: str):
        r = requests.get(API + path, headers=self.h, timeout=60)
        r.raise_for_status()
        return r.json()

    def post(self, path: str, body: dict):
        r = requests.post(API + path, headers=self.h, json=body, timeout=60)
        if r.status_code >= 400:
            raise RuntimeError(f"{r.status_code} {path}: {r.text[:300]}")
        return r.json()


def pick_site(g: GSC) -> str:
    want = os.environ.get("GSC_SITE", "").strip()
    sites = g.get("/webmasters/v3/sites").get("siteEntry", [])
    print("== 이 계정이 볼 수 있는 속성")
    for s in sites:
        print(f"  {s['siteUrl']}  ({s['permissionLevel']})")
    if want:
        return want
    for cand in (f"https://{HOST}/", f"sc-domain:{HOST}", "sc-domain:knowhow-it.com"):
        if any(s["siteUrl"] == cand for s in sites):
            return cand
    for s in sites:
        if "knowhow-it.com" in s["siteUrl"]:
            return s["siteUrl"]
    raise SystemExit("jiwon.knowhow-it.com 속성이 보이지 않습니다. 이 계정(또는 서비스 계정)을 서치 콘솔 사용자로 넣어야 합니다.")


def query(g: GSC, site: str, start: str, end: str, dims: list[str], limit: int = 1000) -> list[dict]:
    body = {"startDate": start, "endDate": end, "dimensions": dims, "rowLimit": limit, "dataState": "all"}
    if site.startswith("sc-domain:"):
        # 도메인 속성이면 다른 하위 도메인도 섞인다. 이 사이트 쪽만.
        body["dimensionFilterGroups"] = [{"filters": [{"dimension": "page", "operator": "contains", "expression": HOST}]}]
    path = f"/webmasters/v3/sites/{urllib.parse.quote(site, safe='')}/searchAnalytics/query"
    return g.post(path, body).get("rows", [])


def table(rows: list[tuple], head: tuple) -> None:
    print("  " + " | ".join(str(h) for h in head))
    for r in rows:
        print("  " + " | ".join(str(x) for x in r))


def main() -> None:
    today = dt.datetime.now(KST).date().isoformat()
    ap = argparse.ArgumentParser()
    ap.add_argument("--a", default="2026-10-01:2026-10-10")
    ap.add_argument("--b", default="2026-10-11:")
    ap.add_argument("--since", default="2026-09-01")
    ap.add_argument("--inspect", type=int, default=40)
    ap.add_argument("--hubs", action="store_true", help="목차·허브 쪽과 최근 글을 URL 검사한다(리치 결과까지)")
    ap.add_argument("--urls", default="", help="따로 검사할 주소(쉼표)")
    a = ap.parse_args()
    if not mode():
        raise SystemExit("인증 정보가 없습니다: GOOGLE_INDEXING_SA 또는 GOOGLE_OAUTH_CLIENT_ID·SECRET·REFRESH_TOKEN")
    g = GSC(access_token([WEBMASTERS_RO]) or "")
    site = pick_site(g)
    print(f"\n속성: {site}  (인증: {mode()})")
    A, B = period(a.a, today), period(a.b, today)

    print(f"\n== 날짜별({a.since}~{today}, 확정 전 날짜 포함)")
    days = query(g, site, a.since, today, ["date"], 500)
    table([(r["keys"][0], int(r["clicks"]), int(r["impressions"]), f"{r['position']:.1f}") for r in days], ("날짜", "클릭", "노출", "평균순위"))

    pa = {r["keys"][0]: r for r in query(g, site, *A, ["page"], 5000)}
    pb = {r["keys"][0]: r for r in query(g, site, *B, ["page"], 5000)}
    print(f"\n== 쪽 종류별 노출  A {A[0]}~{A[1]}  /  B {B[0]}~{B[1]}")
    ka, kb, na, nb = collections.Counter(), collections.Counter(), collections.Counter(), collections.Counter()
    for u, r in pa.items():
        ka[kind_of(u)] += r["impressions"]; na[kind_of(u)] += 1
    for u, r in pb.items():
        kb[kind_of(u)] += r["impressions"]; nb[kind_of(u)] += 1
    table([(k, int(ka[k]), na[k], int(kb[k]), nb[k]) for k in sorted(set(ka) | set(kb), key=lambda k: -ka[k])],
          ("종류", "A 노출", "A 쪽 수", "B 노출", "B 쪽 수"))

    print("\n== 노출이 가장 많이 준 쪽 30")
    drop = sorted(pa, key=lambda u: -(pa[u]["impressions"] - pb.get(u, {}).get("impressions", 0)))[:30]
    table([(u.replace(f"https://{HOST}", ""), int(pa[u]["impressions"]), int(pb.get(u, {}).get("impressions", 0)),
            f"{pa[u]['position']:.1f}", f"{pb[u]['position']:.1f}" if u in pb else "-") for u in drop],
          ("쪽", "A 노출", "B 노출", "A 순위", "B 순위"))

    qa = {r["keys"][0]: r for r in query(g, site, *A, ["query"], 5000)}
    qb = {r["keys"][0]: r for r in query(g, site, *B, ["query"], 5000)}
    print(f"\n== 검색어 수  A {len(qa)}  B {len(qb)}.  노출이 가장 많이 준 검색어 25")
    dq = sorted(qa, key=lambda q: -(qa[q]["impressions"] - qb.get(q, {}).get("impressions", 0)))[:25]
    table([(q, int(qa[q]["impressions"]), int(qb.get(q, {}).get("impressions", 0)), f"{qa[q]['position']:.1f}") for q in dq],
          ("검색어", "A 노출", "B 노출", "A 순위"))

    try:
        sa = {r["keys"][0]: r for r in query(g, site, *A, ["searchAppearance"], 50)}
        sb = {r["keys"][0]: r for r in query(g, site, *B, ["searchAppearance"], 50)}
        print("\n== 검색 노출 유형")
        table([(k, int(sa.get(k, {}).get("impressions", 0)), int(sb.get(k, {}).get("impressions", 0))) for k in sorted(set(sa) | set(sb))],
              ("유형", "A 노출", "B 노출"))
    except RuntimeError as e:
        print(f"\n검색 노출 유형: 건너뜀 {e}")

    # B 기간에 노출은 있는데 클릭이 없는 검색어 — 제목·설명문을 손볼 후보. 순위 10 안인데 클릭 0 이면 제목이 문제.
    print("\n== B 기간: 노출 있고 클릭 없는 검색어(제목·설명문 손볼 후보)")
    noclick = sorted((q for q in qb if qb[q]["clicks"] == 0 and qb[q]["impressions"] >= 3), key=lambda q: -qb[q]["impressions"])[:20]
    table([(q, int(qb[q]["impressions"]), f"{qb[q]['position']:.1f}") for q in noclick], ("검색어", "B 노출", "B 순위")) if noclick else print("  없음")

    actions: list[str] = []

    def inspect_one(u: str) -> None:
        try:
            res = g.post("/v1/urlInspection/index:inspect", {"inspectionUrl": u, "siteUrl": site, "languageCode": "ko"})
        except RuntimeError as e:
            print(f"  {u}: 실패 {e}")
            raise
        ir = res.get("inspectionResult", {})
        x = ir.get("indexStatusResult", {})
        rr = ir.get("richResultsResult", {})
        canon = x.get("googleCanonical") or ""
        short = u.replace(f"https://{HOST}", "") or "/"
        rich = ""
        if rr:
            items = rr.get("detectedItems", [])
            kinds = []
            for it in items:
                issues = [i for sub in it.get("items", []) for i in sub.get("issues", [])]
                bad = [i for i in issues if i.get("severity") == "ERROR"]
                kinds.append(f"{it.get('richResultType')}{'(오류 ' + str(len(bad)) + ')' if bad else ''}")
                for i in bad[:2]:
                    actions.append(f"리치 결과 오류 {short}: {it.get('richResultType')} — {i.get('issueMessage')}")
            rich = f" | 리치 {rr.get('verdict')} {', '.join(kinds)}"
        print(f"  {short} | {x.get('verdict')} | {x.get('coverageState')} | 색인 {x.get('indexingState')}"
              f" | 크롤 {(x.get('lastCrawlTime') or '-')[:16]} | {x.get('pageFetchState')} | robots {x.get('robotsTxtState')}"
              + (f" | 구글 정본 {canon}" if canon and canon != u else "") + rich)
        cs = x.get("coverageState") or ""
        if "색인이 생성되지 않음" in cs or "not indexed" in cs.lower():
            actions.append(f"색인 안 됨 {short}: {cs}")
        if x.get("indexingState") not in (None, "INDEXING_ALLOWED"):
            actions.append(f"색인 막힘 {short}: {x.get('indexingState')}")
        if canon and canon != u:
            actions.append(f"정본 다름 {short} → {canon}")
        return x

    if a.hubs or a.urls:
        # 한글 경로는 사이트맵과 같게 퍼센트 부호화해 검사한다 — 날것으로 넣으면 구글이 "알려지지 않은 URL" 이라고 한다(2026-10-23).
        hubs = [f"https://{HOST}" + "/".join(urllib.parse.quote(seg) for seg in p.split("/"))
                for p in ("/", "/jobs", "/policies", "/orgs", "/map", "/calendar", "/story", "/blog", "/license",
                          "/housing", "/business", "/jobs/region/경기도", "/jobs/region/서울특별시", "/area/경기도", "/area/서울특별시")] if a.hubs else []
        extra = [u.strip() for u in a.urls.split(",") if u.strip()]
        if a.hubs:
            # 최근 글 셋: 사이트맵 posts 갈래의 /story/ 가운데 앞쪽.
            try:
                xml = requests.get(f"https://{HOST}/sitemap/posts.xml", timeout=30).text
                stories = [m for m in re.findall(r"<loc>(.*?)</loc>", xml) if "/story/" in m]
                hubs += stories[-3:]
            except Exception:  # noqa: BLE001
                pass
        print(f"\n== URL 검사: 허브·글 {len(hubs) + len(extra)}쪽(리치 결과 포함)")
        tally = collections.Counter()
        for u in hubs + extra:
            try:
                x = inspect_one(u)
            except RuntimeError as e:
                if "429" in str(e) or "403" in str(e):
                    break
                continue
            tally[x.get("coverageState", "?")] += 1
        print("  요약: " + ", ".join(f"{k} {v}" for k, v in tally.most_common()))

    print(f"\n== URL 검사: A 기간 노출 상위 {a.inspect}쪽")
    top = sorted(pa, key=lambda u: -pa[u]["impressions"])[: a.inspect]
    tally = collections.Counter()
    for u in top:
        try:
            x = inspect_one(u)
        except RuntimeError as e:
            if "429" in str(e) or "403" in str(e):
                break
            continue
        tally[x.get("coverageState", "?")] += 1
    print("  요약: " + ", ".join(f"{k} {v}" for k, v in tally.most_common()))

    print("\n== 손볼 것(자동 추림)")
    if noclick:
        actions.append("클릭 없는 검색어 " + ", ".join(noclick[:5]) + " — 해당 쪽 제목·설명문에 검색어를 앞세울 것")
    for ln in actions[:40] or ["없음"]:
        print("  - " + ln)

    print("\n== 사이트맵")
    try:
        sm = g.get(f"/webmasters/v3/sites/{urllib.parse.quote(site, safe='')}/sitemaps").get("sitemap", [])
        for s in sm:
            cont = ", ".join(f"{c.get('type')} 제출 {c.get('submitted')}" for c in s.get("contents", []))
            print(f"  {s.get('path')} | 제출 {str(s.get('lastSubmitted'))[:10]} | 읽음 {str(s.get('lastDownloaded'))[:10]}"
                  f" | 대기 {s.get('isPending')} | 오류 {s.get('errors')} 경고 {s.get('warnings')} | {cont}")
    except requests.HTTPError as e:
        print(f"  실패 {e}")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        print(f"실패: {e}", file=sys.stderr)
        sys.exit(1)
