#!/usr/bin/env python3
"""검색엔진 봇이 날마다 얼마나 긁어 가는지. 회전된 기록(.gz)까지 다 읽어 이레치를 센다.

    sudo python3 bot_report.py            # /var/log/caddy/access*.log*
    sudo python3 bot_report.py 경로...

구글이 안 오는지, 와서 403·404 를 받는지, 어느 쪽을 보는지가 한눈에 보여야 "왜 노출이 안 되나"에 답할 수 있다.
쪽·API 요청만 센다(정적 파일·미리 받기 제외). 시각은 KST 날짜로 묶는다.
"""
import glob
import gzip
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
BOTS = [
    ("Googlebot", re.compile(r"Googlebot|Google-InspectionTool|GoogleOther", re.I)),
    ("bingbot", re.compile(r"bingbot", re.I)),
    ("Yeti(네이버)", re.compile(r"Yeti", re.I)),
    ("Daum", re.compile(r"Daum", re.I)),
    ("Applebot", re.compile(r"Applebot", re.I)),
    ("OAI-SearchBot", re.compile(r"OAI-SearchBot", re.I)),
]
STATIC = re.compile(r"^/_next/|\.(?:png|jpe?g|gif|webp|avif|svg|ico|css|js|map|woff2?|ttf|txt|xml)(?:[?]|$)|[?&]_rsc=")


def lines(paths):
    for p in paths:
        opener = gzip.open if p.endswith(".gz") else open
        try:
            with opener(p, "rt", encoding="utf-8", errors="replace") as f:
                for line in f:
                    yield line
        except OSError as e:
            print(f"  읽기 실패 {p}: {e}", file=sys.stderr)


def main():
    paths = sys.argv[1:] or sorted(glob.glob("/var/log/caddy/access-*.log.gz")) + ["/var/log/caddy/access.log"]
    by_day = defaultdict(Counter)      # day -> bot -> n
    g_status = Counter()               # Googlebot 응답 코드
    g_paths = Counter()                # Googlebot 경로 앞머리
    g_last = None
    for raw in lines(paths):
        try:
            r = json.loads(raw)
        except ValueError:
            continue
        req = r.get("request", {})
        uri = req.get("uri", "")
        if STATIC.search(uri):
            continue
        ua = (req.get("headers", {}).get("User-Agent") or [""])[0]
        bot = next((n for n, rx in BOTS if rx.search(ua)), None)
        if not bot:
            continue
        ts = r.get("ts")
        try:
            day = datetime.fromtimestamp(float(ts), KST).strftime("%m-%d") if isinstance(ts, (int, float)) else datetime.fromisoformat(str(ts).replace("Z", "+00:00")).astimezone(KST).strftime("%m-%d")
        except (ValueError, TypeError):
            day = "?"
        by_day[day][bot] += 1
        if bot == "Googlebot":
            g_status[str(r.get("status"))] += 1
            g_paths["/" + uri.split("?")[0].strip("/").split("/")[0]] += 1
            g_last = (day, ts)
    names = [n for n, _ in BOTS]
    print("== 검색엔진 봇 일별 쪽 요청(KST, 회전 기록 포함)")
    print("  날짜  " + "".join(f"{n:>14}" for n in names))
    for day in sorted(by_day):
        print(f"  {day} " + "".join(f"{by_day[day][n]:>14}" for n in names))
    total_g = sum(c["Googlebot"] for c in by_day.values())
    print(f"\n== Googlebot 합계 {total_g}건")
    if total_g:
        print("  응답 코드: " + ", ".join(f"{k} {v}" for k, v in g_status.most_common()))
        print("  경로 앞머리: " + ", ".join(f"{k} {v}" for k, v in g_paths.most_common(10)))
        print(f"  마지막 요청: {g_last}")
    else:
        print("  구글 봇이 한 번도 오지 않았습니다. 서치콘솔의 '페이지' 보고서와 '크롤링 통계'를 봐야 합니다.")


if __name__ == "__main__":
    main()
