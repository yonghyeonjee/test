#!/usr/bin/env python3
"""
구글봇 응답 코드를 경로별로 나눠 본다(2026-11-24). server_diag.yml 이 올려서 돌린다(읽기만).
  python3 googlebot_report.py [일수=7] [기록 폴더=/var/log/caddy]

이름표(User-Agent)에 Googlebot·Google-InspectionTool·AdsBot-Google·Mediapartners-Google·GoogleOther 가 든 요청을
응답 코드별로 세고, 403·5xx 는 경로와 이유 짐작(스캐너 경로·robots.txt 로 막은 경로·그 밖)을 함께 보인다.
이름표만으로는 진짜 구글인지 모른다 — 403 이 '그 밖' 에 있으면 그 IP 를 역방향 DNS 로 따로 확인한다.
표준 라이브러리만 쓴다.
"""
from __future__ import annotations

import collections
import datetime as dt
import glob
import gzip
import json
import os
import re
import socket
import sys

GOOGLE = re.compile(r"Googlebot|Google-InspectionTool|AdsBot-Google|Mediapartners-Google|GoogleOther|Storebot-Google", re.I)
# Caddyfile (guard) 의 @scan·@robotsdeny 와 같은 기준.
SCAN = re.compile(r"\.(php|asp|aspx|jsp|cgi)$|^/(wp-|wordpress|\.env|\.git|\.aws|\.ssh|\.vscode|\.DS_Store|cgi-bin/|vendor/|phpmyadmin|pma|boaform|actuator|server-status|HNAP1|owa/|autodiscover|xmlrpc|config)", re.I)
ROBOTS = re.compile(r"^/(?:search|find|api/|account|admin|saved)|^/jobs/(?:.*/)?q/")


def reason(path: str) -> str:
    if SCAN.search(path):
        return "스캐너 경로"
    if ROBOTS.search(path):
        return "robots.txt 로 막은 경로"
    return "그 밖(확인 필요)"


def lines(folder: str):
    files = sorted(glob.glob(os.path.join(folder, "access*.log*")))
    for f in files:
        op = gzip.open if f.endswith(".gz") else open
        try:
            with op(f, "rt", encoding="utf-8", errors="replace") as fh:
                yield from fh
        except OSError as e:
            print(f"못 읽음 {f}: {e}")


def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    folder = sys.argv[2] if len(sys.argv) > 2 else "/var/log/caddy"
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
    kst = dt.timezone(dt.timedelta(hours=9))
    status = collections.Counter()
    by_day = collections.defaultdict(collections.Counter)
    bad = collections.Counter()          # (코드, 이유, 경로 앞머리)
    bad_ip = collections.defaultdict(collections.Counter)
    all_ip = collections.Counter()        # 구글 이름표 요청 전체의 IP
    ua_kind = collections.Counter()
    first = last = None
    for line in lines(folder):
        try:
            r = json.loads(line)
            ts = dt.datetime.fromisoformat(str(r["ts"]).replace("Z", "+00:00"))
        except (ValueError, KeyError, TypeError):
            continue
        if ts < since:
            continue
        req = r.get("request") or {}
        ua = ((req.get("headers") or {}).get("User-Agent") or [""])[0]
        if not GOOGLE.search(ua):
            continue
        first = min(first, ts) if first else ts
        last = max(last, ts) if last else ts
        code = int(r.get("status") or 0)
        uri = req.get("uri") or ""
        path = uri.split("?")[0]
        status[code] += 1
        all_ip[req.get("client_ip") or req.get("remote_ip") or "?"] += 1
        by_day[ts.astimezone(kst).strftime("%m-%d")][code] += 1
        m = GOOGLE.search(ua)
        ua_kind[m.group(0) if m else "?"] += 1
        if code == 403 or code >= 500:
            head = "/".join(path.split("/")[:3]) or "/"
            why = reason(path)
            bad[(code, why, head)] += 1
            ip = req.get("client_ip") or req.get("remote_ip") or "?"
            bad_ip[(code, why)][ip] += 1

    span = f"{first.astimezone(kst):%m-%d %H:%M} ~ {last.astimezone(kst):%m-%d %H:%M} KST" if first else "없음"
    print(f"== 구글 크롤러 요청 최근 {days}일 ({span}) 합계 {sum(status.values())}건")
    print("  응답 코드: " + ", ".join(f"{k} {v}" for k, v in sorted(status.items())))
    print("  이름표: " + ", ".join(f"{k} {v}" for k, v in ua_kind.most_common()))
    print("-- 날짜별(KST)")
    for d in sorted(by_day):
        c = by_day[d]
        print(f"  {d}  합 {sum(c.values()):5d}  " + ", ".join(f"{k} {v}" for k, v in sorted(c.items())))
    print("-- 403·5xx 를 이유·경로별로")
    if not bad:
        print("  없음")
    for (code, why, head), n in sorted(bad.items(), key=lambda x: (-x[1])):
        print(f"  {code}  {n:4d}  {why:<16s} {head}")
    print("-- 403·5xx 의 IP 상위(이유별 3개). '그 밖' 이면 host <IP> 가 googlebot.com·google.com 으로 끝나는지 확인")
    for (code, why), ips in sorted(bad_ip.items()):
        print(f"  {code} {why}: " + ", ".join(f"{ip} {n}" for ip, n in ips.most_common(3)))
        if why.startswith("그 밖"):
            for ip, _ in ips.most_common(3):
                try:
                    host = socket.gethostbyaddr(ip)[0]
                except OSError:
                    host = "(역방향 이름 없음)"
                real = host.endswith((".googlebot.com", ".google.com", ".googleusercontent.com"))
                print(f"      {ip} → {host} {'(구글 맞음)' if real else '(구글 아님 — 이름표를 꾸민 봇)'}")
    # 2026-11-25 이름표를 꾸민 봇이 섞였는지: 요청 많은 IP 를 역방향 DNS 로 가른다(구글은 googlebot.com·google.com).
    print(f"-- 구글 이름표 요청의 IP {len(all_ip)}개. 상위 15개 역방향 DNS")
    real_n = fake_n = 0
    for ip, n in all_ip.most_common(15):
        try:
            host = socket.gethostbyaddr(ip)[0]
        except OSError:
            host = "(역방향 이름 없음)"
        real = host.endswith((".googlebot.com", ".google.com", ".googleusercontent.com"))
        real_n += n if real else 0
        fake_n += 0 if real else n
        print(f"  {n:6d}  {ip:<40s} {host}  {'구글' if real else '꾸민 봇'}")
    print(f"  상위 15개 IP 합: 구글 {real_n} · 꾸민 봇 {fake_n}")


if __name__ == "__main__":
    main()
