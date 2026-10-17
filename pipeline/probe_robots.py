"""배포된 쪽의 색인 표시를 본다. 주소마다 상태 코드, robots 메타, 정본 주소, JobPosting 유무를 찍는다.
사용: python probe_robots.py "https://…/jobs/305891,https://…/license/0011"   (쉼표로 여럿)
사이트맵 주소(…/sitemap/<갈래>.xml)를 주면 <loc> 개수만 센다.
2026-10-17 색인 회복 작업(noindex,follow 규칙)이 실제로 나가는지 확인하려고 만들었다.
"""
import re
import sys

import requests

UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com/about; probe)"
for url in [s.strip() for s in (sys.argv[1] if len(sys.argv) > 1 else "").split(",") if s.strip()]:
    try:
        r = requests.get(url, timeout=60, headers={"User-Agent": UA, "Accept-Language": "ko-KR"})
    except Exception as e:  # noqa: BLE001
        print(f"{url}\n   실패: {type(e).__name__}")
        continue
    t = r.text
    if url.endswith(".xml"):
        print(f"{url}\n   status {r.status_code}  loc {len(re.findall(r'<loc>', t))}")
        continue
    robots = re.findall(r'<meta[^>]+name="robots"[^>]*content="([^"]*)"', t) or re.findall(r'<meta[^>]+content="([^"]*)"[^>]*name="robots"', t)
    canon = re.findall(r'<link[^>]+rel="canonical"[^>]*href="([^"]*)"', t)
    posting = "yes" if '"JobPosting"' in t else "no"
    print(f"{url}\n   status {r.status_code}  robots {robots or '-'}  canonical {canon[:1] or '-'}  JobPosting {posting}")
