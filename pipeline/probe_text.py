"""배포된 화면의 글을 본다. 주소를 열어 표식 낱말이 처음 나온 곳부터 글만(태그 제거) 찍는다.
사용: python probe_text.py "https://…/license/0011|시험 시기와 난이도|1500"  (주소|표식|글자 수. 쉼표로 여럿)
새 칸이 실제로 그려졌는지 확인할 때 쓴다. 이 저장소의 GitHub Actions 는 서울 서버에 바로 닿는다.
"""
import html
import re
import sys

import requests

UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com/about; probe)"
for spec in [s.strip() for s in (sys.argv[1] if len(sys.argv) > 1 else "").split(",") if s.strip()]:
    url, _, rest = spec.partition("|")
    marker, _, n = rest.partition("|")
    n = int(n or 1500)
    print(f"\n== {url}  표식: {marker!r}")
    try:
        r = requests.get(url, timeout=40, headers={"User-Agent": UA, "Accept-Language": "ko-KR"})
    except Exception as e:  # noqa: BLE001
        print("   실패:", e)
        continue
    t = r.text
    print(f"   status {r.status_code}  len {len(t)}")
    i = t.find(marker) if marker else 0
    if i < 0:
        print("   표식 없음")
        continue
    seg = t[i:i + 12000]
    seg = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", seg, flags=re.S | re.I)
    seg = re.sub(r"</(p|li|tr|h\d|div|section)>", " / ", seg, flags=re.I)
    txt = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", seg))).strip()
    print("   " + txt[:n])
