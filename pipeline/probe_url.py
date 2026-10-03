"""주소 몇 개를 그대로 받아 상태·머리글·본문 앞부분을 찍는다. 운영 장애를 밖에서 볼 때.
사용: python probe_url.py "https://…/a,https://…/b"
"""
import sys
import requests

urls = [u.strip() for u in (sys.argv[1] if len(sys.argv) > 1 else "https://jiwon.knowhow-it.com/").split(",") if u.strip()]
for u in urls:
    try:
        r = requests.get(u, timeout=30, headers={"User-Agent": "Mozilla/5.0 (probe)"}, allow_redirects=False)
        print(f"\n== {u}\n   status {r.status_code}  {r.elapsed.total_seconds()*1000:.0f}ms  len {len(r.content)}")
        for k in ("cache-control", "content-type", "location", "via", "x-nextjs-cache", "x-middleware-rewrite"):
            if k in r.headers: print(f"   {k}: {r.headers[k]}")
        print("   body:", r.text[:400].replace("\n", " "))
    except Exception as e:  # noqa: BLE001
        print(f"\n== {u}\n   실패: {e}")
