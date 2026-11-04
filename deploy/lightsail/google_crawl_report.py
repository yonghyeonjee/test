#!/usr/bin/env python3
"""
구글 크롤 진단(2026-11-04). google_crawl_diag.yml 이 서버에서 돌린다. 표준 라이브러리만.
  sudo python3 google_crawl_report.py [일수=14]

Caddy 접속 기록(회전된 .gz 포함)에서 구글 쪽 요청만 모아
  - 날짜별 요청 수(이름표 종류별: Googlebot 쪽 / Googlebot-Image / InspectionTool / 그 밖)
  - 쪽(/og·정적 제외) 요청의 응답 코드·걸린 시간(p50·p95)·경로
  - /og 요청 수와 서로 다른 주소 수(주소가 날마다 바뀌면 그림을 다시 긁는다)
  - robots.txt·sitemap 읽은 때
  - 구글 IP 대역(66.249.)에서 온 요청 가운데 구글 이름표가 아닌 것
그리고 fail2ban 기록에서 막힌 IP 가운데 구글 대역이거나 구글 이름표로 온 적이 있는 IP 를 찾는다.
"""
from __future__ import annotations

import collections
import datetime as dt
import glob
import gzip
import json
import re
import statistics
import sys

DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 14
SINCE = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=DAYS)
KST = dt.timezone(dt.timedelta(hours=9))

GOOGLE = re.compile(r"Googlebot|Google-InspectionTool|GoogleOther|AdsBot-Google|Mediapartners-Google|APIs-Google|Storebot-Google|"
                    r"Google-Site-Verification|FeedFetcher-Google|Google-Read-Aloud|Google-PageRenderer|GoogleProducer|Google-Extended|"
                    r"Google-Safety|Google-CloudVertexBot|Google-NotebookLM", re.I)
STATIC = re.compile(r"^/_next/|^/(?:favicon|icon|apple-icon)|\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|map|woff2?|ttf)$", re.I)


def family(ua: str) -> str:
    if "Googlebot-Image" in ua: return "Googlebot-Image"
    if "Google-InspectionTool" in ua: return "InspectionTool"
    if "Googlebot" in ua: return "Googlebot(쪽)"
    if "GoogleOther" in ua: return "GoogleOther"
    if "AdsBot" in ua or "Mediapartners" in ua: return "광고봇"
    return "그 밖의 구글"


def lines():
    for p in sorted(glob.glob("/var/log/caddy/access-*.log.gz")) + ["/var/log/caddy/access.log"]:
        op = gzip.open if p.endswith(".gz") else open
        try:
            with op(p, "rt", encoding="utf-8", errors="replace") as f:
                for l in f:
                    yield l
        except Exception as e:  # noqa: BLE001
            print(f"  읽기 실패 {p}: {e}", file=sys.stderr)


def main() -> None:
    by_day = collections.defaultdict(collections.Counter)
    pages = []            # (ts, path, status, dur, fam)
    og_urls = collections.Counter()
    og_dur = []
    status_pages = collections.Counter()
    robots, sitemaps = [], []
    ip_google = collections.Counter()
    nonua_from_google_ip = collections.Counter()
    google_ips = set()
    for l in lines():
        try:
            j = json.loads(l)
        except Exception:  # noqa: BLE001
            continue
        try:
            ts = dt.datetime.fromisoformat(j["ts"].replace("Z", "+00:00"))
        except Exception:  # noqa: BLE001
            continue
        if ts < SINCE:
            continue
        req = j.get("request", {})
        ua = (req.get("headers", {}).get("User-Agent") or [""])[0]
        ip = req.get("client_ip") or req.get("remote_ip") or ""
        uri = req.get("uri", "")
        path = uri.split("?", 1)[0]
        if ip.startswith("66.249.") and not GOOGLE.search(ua):
            nonua_from_google_ip[(ua[:60] or "(없음)")] += 1
        if not GOOGLE.search(ua):
            continue
        fam = family(ua)
        day = ts.astimezone(KST).strftime("%m-%d")
        by_day[day][fam] += 1
        google_ips.add(ip)
        ip_google[ip.rsplit(".", 1)[0] + ".x"] += 1
        st = j.get("status")
        dur = float(j.get("duration") or 0)
        if path.startswith("/og"):
            og_urls[uri] += 1
            og_dur.append(dur)
            by_day[day]["/og"] += 1
            continue
        if path == "/robots.txt":
            robots.append(ts); continue
        if path.startswith("/sitemap"):
            sitemaps.append((ts, path)); continue
        if STATIC.search(path) or re.search(r"(?:^|&)_rsc=", uri.partition("?")[2]):
            by_day[day]["정적"] += 1
            continue
        pages.append((ts, path, st, dur, fam))
        status_pages[st] += 1
        by_day[day]["쪽"] += 1

    fams = ["Googlebot(쪽)", "Googlebot-Image", "InspectionTool", "GoogleOther", "광고봇", "그 밖의 구글"]
    print(f"== 구글 요청 날짜별(KST, 최근 {DAYS}일)")
    print("  날짜  " + "".join(f"{n:>16}" for n in fams) + f"{'쪽(실제)':>10}{'/og':>8}{'정적':>8}")
    for day in sorted(by_day):
        c = by_day[day]
        print(f"  {day} " + "".join(f"{c[n]:>16}" for n in fams) + f"{c['쪽']:>10}{c['/og']:>8}{c['정적']:>8}")

    print(f"\n== 쪽 요청 {len(pages)}건 — 응답 코드: " + ", ".join(f"{k} {v}" for k, v in status_pages.most_common()))
    if pages:
        d = sorted(x[3] for x in pages)
        print(f"  걸린 시간 p50 {statistics.median(d):.2f}s · p95 {d[int(len(d) * 0.95) - 1 if len(d) > 1 else 0]:.2f}s · 최대 {d[-1]:.2f}s · 1초 넘긴 것 {sum(1 for x in d if x > 1)}건")
        pre = collections.Counter(re.sub(r"^(/[^/]*).*", r"\1", p) for _, p, *_ in pages)
        print("  경로 앞머리: " + ", ".join(f"{k} {v}" for k, v in pre.most_common(12)))
        print("  최근 쪽 요청 40건:")
        for ts, p, st, dur, fam in sorted(pages, key=lambda x: x[0])[-40:]:
            print(f"    {ts.astimezone(KST):%m-%d %H:%M} {st} {dur:5.2f}s {fam:16} {p[:90]}")
        slow = [x for x in pages if x[3] > 1]
        if slow:
            print("  1초 넘긴 쪽(최대 15):")
            for ts, p, st, dur, fam in sorted(slow, key=lambda x: -x[3])[:15]:
                print(f"    {ts.astimezone(KST):%m-%d %H:%M} {st} {dur:5.2f}s {p[:90]}")
    if og_urls:
        tot = sum(og_urls.values())
        print(f"\n== /og 요청 {tot}건 · 서로 다른 주소 {len(og_urls)}개 · 걸린 시간 p50 {statistics.median(og_dur):.2f}s · 최대 {max(og_dur):.2f}s")
        print("  가장 많이 긁어 간 /og 주소 5개:")
        for u, n in og_urls.most_common(5):
            print(f"    {n:3} {u[:140]}")
    print(f"\n== robots.txt 읽음 {len(robots)}번" + (f" · 마지막 {max(robots).astimezone(KST):%m-%d %H:%M}" if robots else ""))
    print(f"== 사이트맵 읽음 {len(sitemaps)}번")
    for ts, p in sorted(sitemaps)[-12:]:
        print(f"    {ts.astimezone(KST):%m-%d %H:%M} {p}")
    print("\n== 구글 요청이 온 IP 대역: " + ", ".join(f"{k} {v}" for k, v in ip_google.most_common(10)))
    if nonua_from_google_ip:
        print("== 66.249.* 에서 왔지만 구글 이름표가 아닌 요청: " + ", ".join(f"{k!r} {v}" for k, v in nonua_from_google_ip.most_common(5)))

    # fail2ban
    print("\n== fail2ban 에 막힌 IP(최근 기록)")
    bans = []
    for p in sorted(glob.glob("/var/log/fail2ban.log.*"), reverse=True) + ["/var/log/fail2ban.log"]:
        op = gzip.open if p.endswith(".gz") else open
        try:
            with op(p, "rt", encoding="utf-8", errors="replace") as f:
                for l in f:
                    m = re.search(r"^(\S+ \S+?)(?:,\d+)? fail2ban\.actions\s+\[\d+\]: NOTICE\s+\[([\w-]+)\] (Ban|Unban) (\S+)", l)
                    if m and m.group(3) == "Ban":
                        bans.append((m.group(1), m.group(2), m.group(4)))
        except Exception as e:  # noqa: BLE001
            print(f"  읽기 실패 {p}: {e}")
    print(f"  막힌 횟수 {len(bans)}")
    byjail = collections.Counter(j for _, j, _ in bans)
    print("  감옥별: " + ", ".join(f"{k} {v}" for k, v in byjail.most_common()))
    sus = [(t, j, ip) for t, j, ip in bans if ip.startswith("66.249.") or ip in google_ips]
    if sus:
        print("  !! 구글 대역이거나 구글 이름표로 온 적이 있는 IP 가 막혔다:")
        for t, j, ip in sus:
            print(f"    {t} {j} {ip}")
    else:
        print("  구글 대역(66.249.*)·구글 이름표 IP 는 막힌 적 없음")
    print("  최근 막힌 12건:")
    for t, j, ip in bans[-12:]:
        print(f"    {t} {j} {ip}")


if __name__ == "__main__":
    main()
