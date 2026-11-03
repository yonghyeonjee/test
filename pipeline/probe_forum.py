"""
probe_forum.py — 티스토리 커뮤니티 글 한 쪽을 러너 브라우저로 열어, 화면 글자와 그 쪽이 부르는 JSON API(주소·앞부분)를 찍는다.
로그인 없이 공개 쪽만 본다. probe.yml 로만 돈다:  script=probe_forum.py  arg=<커뮤니티 글 주소>
"""

import json
import os
import re
import subprocess
import sys

CHROME = next((c for c in ("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium") if os.path.exists(c)), None)
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "playwright"], check=True)
if not CHROME:
    subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
from playwright.sync_api import sync_playwright  # noqa: E402

url = sys.argv[1]
seen = []
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME) if CHROME else pw.chromium.launch()
    page = b.new_page(locale="ko-KR")

    def on_resp(r):
        ct = r.headers.get("content-type", "")
        if "json" in ct:
            try:
                body = r.text()
            except Exception:  # noqa: BLE001
                body = ""
            seen.append((r.request.method, r.url, r.status, body[:1500]))
    page.on("response", on_resp)
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except Exception:  # noqa: BLE001
        pass
    for _ in range(3):
        page.mouse.wheel(0, 4000); page.wait_for_timeout(1500)
    print("===== TEXT")
    print(re.sub(r"\n{3,}", "\n\n", page.inner_text("body"))[:6000])
    print("===== LINKS")
    for a in page.query_selector_all("a")[:200]:
        h = a.get_attribute("href") or ""
        if "tistory.com" in h and "community" not in h:
            print((a.inner_text() or "").strip()[:40].replace("\n", " "), "|", h)
    print("===== JSON")
    for m, u, s, body in seen:
        print(f"--- {m} {s} {u}\n{body}")
    b.close()
