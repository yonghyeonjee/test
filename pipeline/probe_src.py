"""새 수집처 살펴보기. 주소마다 상태·최종 주소·robots.txt 전문, HTML 이면 제목·글 같은 링크·스크립트가 부르는 주소를 찍는다.
사용: python probe_src.py "https://…/a,https://…/b"
"""
import re
import sys

import requests

UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com/about; public notice index)"
urls = [u.strip() for u in (sys.argv[1] if len(sys.argv) > 1 else "").split(",") if u.strip()]
DATE = re.compile(r"(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})")

for u in urls:
    print(f"\n== {u}")
    try:
        r = requests.get(u, timeout=30, headers={"User-Agent": UA, "Accept-Language": "ko-KR"})
    except Exception as e:  # noqa: BLE001
        print("   실패:", e)
        continue
    r.encoding = r.apparent_encoding if not r.encoding or r.encoding.lower() == "iso-8859-1" else r.encoding
    t = r.text
    print(f"   status {r.status_code}  final {r.url}  len {len(t)}  type {r.headers.get('content-type')}")
    if u.endswith("robots.txt") or "json" in (r.headers.get("content-type") or "") or t.lstrip().startswith(("{", "<?xml", "<response")):
        print("   ---\n" + "\n".join("   " + x for x in t[:1800].splitlines()))
        continue
    m = re.search(r"<title[^>]*>(.*?)</title>", t, re.S | re.I)
    print("   title:", (m.group(1).strip() if m else "")[:100])
    rows = []
    for a in re.finditer(r'<a\b([^>]*)>(.*?)</a>', t, re.S | re.I):
        text = re.sub(r"<[^>]+>|\s+", " ", a.group(2)).strip()
        if len(text) < 8:
            continue
        after = re.sub(r"<[^>]+>", " ", t[a.end():a.end() + 400])
        d = DATE.search(after)
        href = re.search(r'href\s*=\s*["\']([^"\']*)', a.group(1))
        onclick = re.search(r'onclick\s*=\s*["\']([^"\']*)', a.group(1))
        rows.append((text[:70], (href.group(1) if href else "")[:90], (onclick.group(1) if onclick else "")[:70], d.group(0) if d else ""))
    dated = [x for x in rows if x[3]]
    print(f"   링크 {len(rows)}개, 날짜 붙은 것 {len(dated)}개")
    for x in (dated or rows)[:15]:
        print("    ·", " | ".join(x))
    calls = sorted(set(re.findall(r'["\'](/[\w/\-]+\.(?:do|json|jsp|ajax|php))', t)))[:25]
    print("   스크립트·폼 주소:", calls)
