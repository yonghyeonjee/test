"""운영 화면 탐침. 샌드박스에서는 사이트에 닿지 않아 Actions 러너에서 읽는다.

    python -u pipeline/probe_url.py /map,/business/search,/p/WLF00001769

쪽마다 상태·길이·제목·눈에 띄는 숫자(N곳 · N건)와 점검 글귀를 찍는다. 인증키 없음.
"""
import re
import sys
import time

import requests

BASE = "https://jiwon.knowhow-it.com"
UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com) probe"


def probe(path: str) -> None:
    url = path if path.startswith("http") else BASE + path
    t = time.time()
    r = requests.get(url, headers={"User-Agent": UA}, timeout=40)
    ms = int((time.time() - t) * 1000)
    html = r.text
    title = re.search(r"<title>(.*?)</title>", html, re.S)
    print(f"\n== {url}\n   {r.status_code} {len(html):,}B {ms}ms  title={title.group(1).strip() if title else '-'}")
    for pat, label in [
        (r"(\d[\d,]*)곳 · (\d[\d,]*)건", "지도 점·건수"),
        (r"접수 중인 지원사업 <b[^>]*>([\d,]+)건</b>과\s*채용 <b[^>]*>([\d,]+)건</b>", "지도 본문 건수"),
        (r"전국 공통 사업 ([\d,]+)건", "전국 공통"),
        (r"근무 지역이 적히지 않은 채용 ([\d,]+)건", "지역 없는 채용"),
        (r'aria-controls="portal-suggest"[^>]*placeholder="([^"]*)"', "검색창 보기글"),
        (r'placeholder="([^"]*)"[^>]*aria-controls="portal-suggest"', "검색창 보기글"),
        (r'<meta name="robots" content="([^"]*)"', "robots"),
        (r'<link rel="canonical" href="([^"]*)"', "canonical"),
        (r"calendar\.google\.com/calendar/render\?[^\"]{0,80}", "구글 캘린더 링크"),
        (r"leaflet", "leaflet 포함"),
        (r"내 위치에서 거리 보기|내 위치로 보기", "내 위치 단추"),
    ]:
        m = re.search(pat, html)
        if m:
            g = [x for x in m.groups() if x] if m.groups() else [m.group(0)]
            print(f"   {label}: {' / '.join(g)[:120]}")
    n_li = len(re.findall(r"<ol[^>]*>", html))
    print(f"   ol 수={n_li}  'leaflet' 횟수={html.count('leaflet')}  '시·도 가운데' 횟수={html.count('시·도 가운데')}")


def main() -> None:
    paths = (sys.argv[1] if len(sys.argv) > 1 else "/map").split(",")
    bad = 0
    for p in paths:
        try:
            probe(p.strip())
        except Exception as e:  # noqa: BLE001 - 탐침은 전부 보여 준다
            bad += 1
            print(f"\n== {p}: 실패 {e}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
