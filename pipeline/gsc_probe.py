#!/usr/bin/env python3
"""서치 콘솔로 원인 가리기(읽기 전용). gsc_report.py 의 보조.

    python pipeline/gsc_probe.py sites            # 이 계정의 속성마다 날짜별 노출 — 같은 날 다 떨어졌나(알고리즘·도메인) 이 사이트만인가
    python pipeline/gsc_probe.py sample --k 12    # 사이트맵 묶음마다 k쪽을 URL 검사 — 어떤 종류가 색인에 남았나

sample 은 묶음 안에서 고르게 띄엄띄엄 고른다(같은 쪽을 매번 고르게, 무작위 아님). URL 검사는 하루 2,000건 한도.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import re
import sys
import urllib.parse

import requests

from google_auth import WEBMASTERS_RO, access_token
from gsc_report import GSC, HOST, KST, query

SITE = f"sc-domain:{HOST}"


def sites(g: GSC, since: str, today: str) -> None:
    props = [s["siteUrl"] for s in g.get("/webmasters/v3/sites").get("siteEntry", [])]
    days = [(dt.date.fromisoformat(since) + dt.timedelta(days=i)).isoformat()
            for i in range((dt.date.fromisoformat(today) - dt.date.fromisoformat(since)).days + 1)]
    print(f"== 속성별 날짜별 노출({since}~{today}). 이 사이트만 떨어졌는지, 같은 날 다 떨어졌는지")
    rows = {}
    for p in props:
        try:
            body = {"startDate": since, "endDate": today, "dimensions": ["date"], "rowLimit": 500, "dataState": "all"}
            r = g.post(f"/webmasters/v3/sites/{urllib.parse.quote(p, safe='')}/searchAnalytics/query", body).get("rows", [])
            rows[p] = {x["keys"][0]: int(x["impressions"]) for x in r}
        except RuntimeError as e:
            rows[p] = {}
            print(f"  {p}: 실패 {str(e)[:120]}")
    keep = [p for p in props if sum(rows[p].values()) > 0]
    print("  날짜 | " + " | ".join(keep))
    for d in days:
        print(f"  {d} | " + " | ".join(str(rows[p].get(d, 0)) for p in keep))


def sitemap_urls(url: str) -> list[str]:
    t = requests.get(url, timeout=60, headers={"User-Agent": "Mozilla/5.0 (compatible; jiwon-gsc-probe)"}).text
    return re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", t)


def sample(g: GSC, k: int) -> None:
    index = sitemap_urls(f"https://{HOST}/sitemap.xml")
    children = [u for u in index if u.endswith(".xml")] or [f"https://{HOST}/sitemap.xml"]
    total = collections.Counter()
    print(f"== 사이트맵 묶음마다 {k}쪽 URL 검사")
    for sm in children:
        urls = [u for u in sitemap_urls(sm) if not u.endswith(".xml")]
        if not urls:
            continue
        step = max(1, len(urls) // k)
        pick = urls[::step][:k]
        tally = collections.Counter()
        for u in pick:
            try:
                res = g.post("/v1/urlInspection/index:inspect", {"inspectionUrl": u, "siteUrl": SITE, "languageCode": "ko"})
            except RuntimeError as e:
                print(f"  {u}: 실패 {str(e)[:100]}")
                if "429" in str(e):
                    return
                continue
            x = res.get("inspectionResult", {}).get("indexStatusResult", {})
            state = x.get("coverageState", "?")
            tally[state] += 1
            total[state] += 1
            print(f"    {u.replace(f'https://{HOST}', '')} | {state} | 크롤 {(x.get('lastCrawlTime') or '-')[:10]}")
        print(f"  [{sm.rsplit('/', 1)[-1]}] {len(urls)}쪽 중 {len(pick)}쪽: " + ", ".join(f"{s} {n}" for s, n in tally.most_common()))
    print("== 전체: " + ", ".join(f"{s} {n}" for s, n in total.most_common()))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["sites", "sample"])
    ap.add_argument("--k", type=int, default=12)
    ap.add_argument("--since", default="2026-09-20")
    a = ap.parse_args()
    today = dt.datetime.now(KST).date().isoformat()
    g = GSC(access_token([WEBMASTERS_RO]) or "")
    if a.mode == "sites":
        sites(g, a.since, today)
    else:
        sample(g, a.k)


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        print(f"실패: {e}", file=sys.stderr)
        sys.exit(1)
