"""
shot_pages.py — 운영 사이트 화면을 찍어 블로그 글에 붙일 사진을 만든다. GitHub Actions 러너에서 돈다
(샌드박스에서는 운영 사이트에 닿지 않는다).

    python -u pipeline/shot_pages.py "주소|파일이름|설명|선택자, 주소|파일이름|설명"

  주소      /jobs 처럼 사이트 안 경로, 또는 https:// 로 시작하는 전체 주소
  파일이름  shots/<파일이름>.png 로 저장
  설명      사진 밑에 붙는 한 줄(비워도 된다)
  선택자    있으면 그 요소만, 없으면 첫 화면(1280×900)을 찍는다. `full` 이라고 쓰면 쪽 전체.

결과는 shots/*.png 와 shots/manifest.json([{"file","caption"}]). tistory_publish.py --images 가 읽는다.
Playwright 는 여기서 깐다(probe_browser.py 와 같은 방식 — 러너의 크롬이 있으면 그것을 쓴다).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

BASE = "https://jiwon.knowhow-it.com"
OUT = "shots"
CHROME = next((c for c in ("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium")
               if os.path.exists(c)), None)


def setup() -> None:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "playwright"], check=True)
    if not CHROME:
        subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)


def parse(spec: str) -> list[dict]:
    out = []
    for item in [x.strip() for x in spec.split(",") if x.strip()]:
        parts = [p.strip() for p in item.split("|")]
        while len(parts) < 4:
            parts.append("")
        path, name, caption, selector = parts[:4]
        url = path if path.startswith("http") else BASE + (path if path.startswith("/") else "/" + path)
        out.append({"url": url, "name": name or "shot", "caption": caption, "selector": selector})
    return out


def main() -> int:
    specs = parse(sys.argv[1] if len(sys.argv) > 1 else "/|home|첫 화면")
    setup()
    from playwright.sync_api import sync_playwright

    os.makedirs(OUT, exist_ok=True)
    manifest = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=CHROME) if CHROME else pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 900}, locale="ko-KR", device_scale_factor=1)
        page = ctx.new_page()
        for s in specs:
            file = f"{OUT}/{s['name']}.png"
            try:
                page.goto(s["url"], wait_until="domcontentloaded", timeout=45000)
                try:
                    page.wait_for_load_state("networkidle", timeout=8000)
                except Exception:  # noqa: BLE001 — 광고·분석 요청이 오래 붙어 있으면 그냥 간다
                    pass
                page.wait_for_timeout(1200)
                if s["selector"] and s["selector"] != "full":
                    el = page.locator(s["selector"]).first
                    el.scroll_into_view_if_needed()
                    page.wait_for_timeout(300)
                    el.screenshot(path=file)
                else:
                    page.screenshot(path=file, full_page=(s["selector"] == "full"))
                manifest.append({"file": f"{s['name']}.png", "caption": s["caption"]})
                print(f"찍음: {s['url']} → {file}")
            except Exception as e:  # noqa: BLE001 — 한 장이 실패해도 나머지는 찍는다
                print(f"실패: {s['url']} ({type(e).__name__}: {e})", file=sys.stderr)
        browser.close()
    with open(f"{OUT}/manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f"{len(manifest)}장 → {OUT}/manifest.json")
    return 0 if manifest else 1


if __name__ == "__main__":
    sys.exit(main())
