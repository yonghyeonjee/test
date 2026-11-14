"""구글봇처럼 쪽을 브라우저로 그려 본 뒤 최종 DOM 의 robots·제목·오류를 찍는다(2026-11-14).

    python -u pipeline/probe_render.py "/jobs,/business,/" 3     # 주소마다 3번씩

11/13 서치 콘솔이 /jobs·/business 를 "NOINDEX 태그로 제외"로 판정했다. 서버 응답은 index 인데,
브라우저에서 그리다 오류가 나면 app/error.tsx 가 noindex 를 꽂는다. 그것이 재현되는지 본다.
실패한 요청(특히 /_next/static 404)과 브라우저 오류를 함께 찍는다.
"""
import os
import subprocess
import sys

BASE = "https://jiwon.knowhow-it.com"
UA = ("Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/131.0.6778.204 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")
CHROME = next((c for c in ("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium")
               if os.path.exists(c)), None)


def main() -> None:
    paths = [p.strip() for p in (sys.argv[1] if len(sys.argv) > 1 else "/jobs,/business,/").split(",") if p.strip()]
    times = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "playwright"], check=True)
    if not CHROME:
        subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
    from playwright.sync_api import sync_playwright  # noqa: PLC0415
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME) if CHROME else p.chromium.launch()
        for path in paths:
            for i in range(times):
                ctx = browser.new_context(user_agent=UA, viewport={"width": 412, "height": 900}, locale="ko-KR")
                page = ctx.new_page()
                errs: list[str] = []
                bad: list[str] = []
                page.on("pageerror", lambda e: errs.append(f"pageerror {getattr(e, 'name', '')}: {str(getattr(e, 'message', e))[:200]}"))
                page.on("console", lambda m: errs.append(f"console {m.text[:200]}") if m.type == "error" else None)
                page.on("response", lambda r: bad.append(f"{r.status} {r.url[:140]}") if r.status >= 400 else None)
                page.on("requestfailed", lambda r: bad.append(f"failed {r.url[:140]} {r.failure}"))
                try:
                    resp = page.goto(BASE + path, wait_until="networkidle", timeout=60000)
                    page.wait_for_timeout(3000)
                    robots = page.eval_on_selector_all('meta[name="robots"]', "els => els.map(e => e.content)")
                    title = page.title()
                    h1 = page.eval_on_selector("h1", "e => e.textContent") if page.query_selector("h1") else ""
                    print(f"== {path} #{i + 1} status {resp.status if resp else '?'} robots {robots} title {title[:60]!r} h1 {str(h1)[:40]!r}")
                except Exception as e:  # noqa: BLE001
                    print(f"== {path} #{i + 1} 실패 {type(e).__name__}: {str(e)[:160]}")
                for x in errs[:6]:
                    print("   ", x)
                for x in bad[:8]:
                    print("   ", x)
                ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
