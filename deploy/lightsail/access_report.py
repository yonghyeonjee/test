#!/usr/bin/env python3
"""
접속 기록 요약(2026-10-14). server_diag.yml 이 서버에서 돌린다.
  python3 access_report.py [분=60] [기록 파일=/var/log/caddy/access.log]

Caddy 접속 기록(JSON 한 줄씩)에서 최근 N분을 읽어
전체·쪽 요청 수, 응답 코드, 쪽 요청을 많이 낸 IP(이름표와 함께), 이름표·경로 상위를 보인다.
"쪽 요청"은 fail2ban 의 jiwon-flood 와 같은 기준이다(정적 파일·미리 받기 ?_rsc= 는 뺀다).
표준 라이브러리만 쓴다(서버에 따로 깔 것 없음).
"""
from __future__ import annotations

import collections
import datetime as dt
import json
import re
import sys

STATIC = re.compile(r"^/_next/|^/(?:favicon|icon|apple-icon)|\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|map|woff2?|ttf|txt|xml)$", re.I)
ENGINE = re.compile(r"Googlebot|Google-InspectionTool|AdsBot-Google|Mediapartners-Google|APIs-Google|Storebot-Google|GoogleOther|bingbot|Yeti|Daum|DuckDuckBot|Applebot", re.I)


def is_page(uri: str) -> bool:
    path, _, query = uri.partition("?")
    if re.search(r"(?:^|&)_rsc=", query):
        return False
    return not STATIC.search(path)


def short_ua(ua: str, n: int = 70) -> str:
    ua = ua or "(없음)"
    m = re.search(r"([A-Za-z-]*(?:bot|crawl|spider|Yeti|Daum)[A-Za-z0-9./-]*)", ua, re.I)
    if m:
        return m.group(1)[:n]
    return ua[:n]


def main():
    minutes = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    path = sys.argv[2] if len(sys.argv) > 2 else "/var/log/caddy/access.log"
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=minutes)
    total = pages = 0
    status = collections.Counter()
    ip_pages = collections.Counter()
    ip_ua: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    ip_blocked = collections.Counter()
    ua_pages = collections.Counter()
    path_pages = collections.Counter()
    first = last = None
    try:
        f = open(path, encoding="utf-8", errors="replace")
    except OSError as e:
        print(f"기록 없음: {e}")
        return
    with f:
        for line in f:
            try:
                r = json.loads(line)
                ts = dt.datetime.fromisoformat(str(r["ts"]).replace("Z", "+00:00"))
            except (ValueError, KeyError, TypeError):
                continue
            if ts < since:
                continue
            first = first or ts
            last = ts
            req = r.get("request") or {}
            ip = req.get("client_ip") or req.get("remote_ip") or "?"
            uri = req.get("uri") or ""
            ua = ((req.get("headers") or {}).get("User-Agent") or [""])[0]
            code = int(r.get("status") or 0)
            total += 1
            status[code] += 1
            if not is_page(uri):
                continue
            pages += 1
            ip_pages[ip] += 1
            ip_ua[ip][short_ua(ua)] += 1
            if code in (403, 404, 429):
                ip_blocked[ip] += 1
            ua_pages[("검색엔진 " if ENGINE.search(ua) else "") + short_ua(ua, 60)] += 1
            seg = "/".join(uri.split("?")[0].split("/")[:3]) or "/"
            path_pages[seg] += 1

    kst = dt.timezone(dt.timedelta(hours=9))
    span = f"{first.astimezone(kst):%m-%d %H:%M} ~ {last.astimezone(kst):%H:%M} KST" if first else "없음"
    print(f"최근 {minutes}분 ({span})")
    print(f"  전체 요청 {total} · 쪽·API 요청 {pages} · IP {len(ip_pages)}개")
    print("  응답 코드: " + ", ".join(f"{k} {v}" for k, v in sorted(status.items())))
    print("\n-- 쪽 요청 많은 IP (요청 · 막힌 응답 · 이름표)")
    for ip, n in ip_pages.most_common(12):
        ua = ip_ua[ip].most_common(1)[0][0]
        print(f"  {n:6d}  {ip_blocked[ip]:5d}  {ip:<39s} {ua}")
    print("\n-- 이름표 상위 (쪽 요청)")
    for ua, n in ua_pages.most_common(10):
        print(f"  {n:6d}  {ua}")
    print("\n-- 경로 상위 (쪽 요청)")
    for p, n in path_pages.most_common(10):
        print(f"  {n:6d}  {p}")


if __name__ == "__main__":
    main()
