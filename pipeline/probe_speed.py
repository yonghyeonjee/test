"""쪽 종류별 응답 속도를 잰다(2026-11-14). 주소마다 n번: 첫 바이트까지(TTFB)·전체·크기·Next 캐시 상태.

    python -u pipeline/probe_speed.py 3
    python -u pipeline/probe_speed.py 3 "/,/jobs,/p/WLF00006158"

러너(미국)에서 서울 서버까지 왕복이 0.15~0.2초쯤 더 붙는다. 견줄 때는 쪽끼리, 같은 날끼리 본다.
Accept-Language 를 단다 — Caddy 가 언어 없는 브라우저 이름표를 막는다(2026-11-15).
"""
import statistics
import sys
import time

import requests

BASE = "https://jiwon.knowhow-it.com"
DEFAULT = ["/", "/jobs", "/policies", "/business", "/license", "/housing", "/blog",
           "/jobs/region/%EA%B2%BD%EA%B8%B0%EB%8F%84", "/jobs/org/%EA%B2%BD%EA%B8%B0%EB%8F%84%20%EC%84%B1%EB%82%A8%EC%8B%9C",
           "/area/%EA%B2%BD%EA%B8%B0%EB%8F%84", "/license/1320", "/p/WLF00006158",
           "/housing/jeonse/youth", "/blog/jeonse-loan-switch-case", "/llms.txt", "/sitemap.xml"]
UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36"


def one(url: str):
    t0 = time.perf_counter()
    r = requests.get(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip, br", "Accept-Language": "ko-KR,ko;q=0.9"},
                     timeout=60, stream=True)
    ttfb = time.perf_counter() - t0
    body = r.content
    total = time.perf_counter() - t0
    return r.status_code, ttfb, total, len(body), r.headers.get("x-nextjs-cache", "-")


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    paths = sys.argv[2].split(",") if len(sys.argv) > 2 and sys.argv[2] else DEFAULT
    print(f"{'쪽':58} {'상태':>5} {'TTFB 중앙':>9} {'TTFB 최대':>9} {'전체':>6} {'KB':>6}  캐시")
    for p in paths:
        rows = []
        for _ in range(n):
            try:
                rows.append(one(BASE + p))
            except Exception as e:  # noqa: BLE001
                rows.append((0, 60.0, 60.0, 0, type(e).__name__))
        tt = [x[1] for x in rows]
        print(f"{p[:58]:58} {rows[-1][0]:>5} {statistics.median(tt):>8.2f}s {max(tt):>8.2f}s "
              f"{statistics.median([x[2] for x in rows]):>5.2f}s {rows[-1][3] // 1024:>6}  " + " ".join(x[4] for x in rows))


if __name__ == "__main__":
    main()
