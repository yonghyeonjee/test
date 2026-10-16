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
BOTUA = re.compile(r"bot|crawl|spider|slurp|preview|fetch|curl|wget|python|headless|externalhit|indexer", re.I)
ENGINE = re.compile(r"Googlebot|Google-InspectionTool|AdsBot-Google|Mediapartners-Google|APIs-Google|Storebot-Google|GoogleOther|bingbot|Yeti|Daum|DuckDuckBot|Applebot", re.I)


def is_page(uri: str) -> bool:
    path, _, query = uri.partition("?")
    if re.search(r"(?:^|&)_rsc=", query):
        return False
    return not STATIC.search(path)


def short_ua(ua: str, n: int = 70) -> str:
    ua = ua or "(없음)"
    # "meta-externalagent/1.1 (+…/crawler)" 처럼 Mozilla 로 시작하지 않으면 맨 앞 이름이 봇 이름이다.
    if not ua.startswith("Mozilla"):
        return ua.split(" ")[0][:n]
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
    ua_full = collections.Counter()
    net_pages = collections.Counter()
    net_ua: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    path_pages = collections.Counter()
    # 사람 브라우저가 쪽을 열 때 보낸 리퍼러(직전 쪽)의 호스트. 우리 방문 집계(visit_log)와 맞춰 보려고.
    ref_hosts = collections.Counter()
    # 구글에서 온 쪽 요청: 미리 받기(Sec-Purpose: prefetch)인지, 같은 IP 가 뒤이어 방문 집계(/api/visit)를 보냈는지.
    google_hits: list[tuple[str, bool]] = []
    visit_ips: set[str] = set()
    google_ua = collections.Counter()
    google_ip = collections.Counter()
    google_lang = collections.Counter()
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
            if uri.startswith("/api/visit"):
                visit_ips.add(ip)
            if not is_page(uri):
                continue
            pages += 1
            ip_pages[ip] += 1
            ip_ua[ip][short_ua(ua)] += 1
            if code in (403, 404, 429):
                ip_blocked[ip] += 1
            ua_pages[("검색엔진 " if ENGINE.search(ua) else "") + short_ua(ua, 60)] += 1
            ua_full[ua[:160] or "(없음)"] += 1
            # 여러 IP 로 나눠 긁는 수집기는 IP 하나로는 안 보인다. 대역(/24, IPv6 는 /48)으로 묶는다.
            net = ".".join(ip.split(".")[:3]) + ".0/24" if "." in ip else ":".join(ip.split(":")[:3]) + "::/48"
            net_pages[net] += 1
            net_ua[net][short_ua(ua)] += 1
            seg = "/".join(uri.split("?")[0].split("/")[:3]) or "/"
            path_pages[seg] += 1
            ref = ((req.get("headers") or {}).get("Referer") or [""])[0]
            if ref and not BOTUA.search(ua) and not uri.startswith("/api/"):
                host = re.sub(r"^https?://([^/]+).*$", r"\1", ref).lower()
                if host and "knowhow-it.com" not in host:
                    ref_hosts[host] += 1
                if "google." in host:
                    hd = req.get("headers") or {}
                    purpose = ((hd.get("Sec-Purpose") or hd.get("Purpose") or [""])[0]).lower()
                    google_hits.append((ip, "prefetch" in purpose or "prerender" in purpose))
                    google_ua[ua[:90] or "(없음)"] += 1
                    google_ip[ip] += 1
                    google_lang[(hd.get("Accept-Language") or ["(없음)"])[0][:20]] += 1

    kst = dt.timezone(dt.timedelta(hours=9))
    span = f"{first.astimezone(kst):%m-%d %H:%M} ~ {last.astimezone(kst):%H:%M} KST" if first else "없음"
    print(f"최근 {minutes}분 ({span})")
    print(f"  전체 요청 {total} · 쪽·API 요청 {pages} · IP {len(ip_pages)}개")
    print("  응답 코드: " + ", ".join(f"{k} {v}" for k, v in sorted(status.items())))
    print("\n-- 쪽 요청 많은 IP (요청 · 막힌 응답 · 이름표)")
    for ip, n in ip_pages.most_common(12):
        ua = ip_ua[ip].most_common(1)[0][0]
        print(f"  {n:6d}  {ip_blocked[ip]:5d}  {ip:<39s} {ua}")
    print("\n-- 대역 상위 (쪽 요청 · IP 수 · 이름표). 여러 IP 로 나눠 긁는 것은 여기서 보인다")
    for net, n in net_pages.most_common(8):
        ips = sum(1 for ip in ip_pages if (".".join(ip.split(".")[:3]) + ".0/24" if "." in ip else ":".join(ip.split(":")[:3]) + "::/48") == net)
        print(f"  {n:6d}  {ips:4d}  {net:<24s} {net_ua[net].most_common(1)[0][0]}")
    print("\n-- 이름표 상위 (쪽 요청)")
    for ua, n in ua_pages.most_common(10):
        print(f"  {n:6d}  {ua}")
    print("\n-- 이름표 전체 문자열 상위 5")
    for ua, n in ua_full.most_common(5):
        print(f"  {n:6d}  {ua}")
    print("\n-- 바깥에서 들어온 리퍼러 (사람 이름표, 쪽 요청)")
    for h, n in ref_hosts.most_common(12):
        print(f"  {n:6d}  {h}")
    if google_hits:
        pre = sum(1 for _, p in google_hits if p)
        real = [ip for ip, p in google_hits if not p]
        counted = sum(1 for ip in real if ip in visit_ips)
        print(f"  구글에서 온 쪽 요청 {len(google_hits)}건: 미리 받기 {pre} · 실제 열람 {len(real)} (그중 방문 집계를 보낸 IP {counted})")
        # 리퍼러는 꾸밀 수 있다. 구글 유입이 진짜인지 이름표·IP·언어로 본다(가짜는 한 IP·한 이름표에 몰린다).
        print(f"  구글 리퍼러 IP {len(google_ip)}개. 이름표 상위:")
        for u, n in google_ua.most_common(5):
            print(f"    {n:5d}  {u}")
        print("  IP 상위: " + ", ".join(f"{ip} {n}" for ip, n in google_ip.most_common(5)))
        print("  언어 상위: " + ", ".join(f"{l} {n}" for l, n in google_lang.most_common(4)))
    print("\n-- 경로 상위 (쪽 요청)")
    for p, n in path_pages.most_common(10):
        print(f"  {n:6d}  {p}")


if __name__ == "__main__":
    main()
