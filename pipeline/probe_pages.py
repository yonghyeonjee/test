"""바깥 사이트 몇 쪽을 러너의 브라우저로 열어 글자를 찍는다(샌드박스는 이 사이트들에 닿지 않는다).

    python -u pipeline/probe_pages.py "price:https://cursor.com/pricing text:https://zdnet.co.kr/view/?no=1 shot:https://claude.ai"

    price:URL  가격·요금제 줄만(달러·원·month·Free·Pro… 가 든 줄) 앞 4,000자
    text:URL   쪽 글자 앞 7,000자
    shot:URL   1280×800 첫 화면을 JPEG 로 줄여 base64 로 찍는다(화면 품질 확인용, 쿠키 배너 닫기 시도 포함)
    json:URL   JSON API 응답 앞 3,000자(브라우저 없이 requests)
    head:URL   상태·최종 주소·제목과 글자 앞 300자(링크가 살아 있는지 확인용)
    links:URL  쪽 안의 링크(글자 | 주소) 앞 120개 — 공식 사이트 안의 정확한 하위 쪽 주소를 찾을 때
여러 개는 빈칸으로 나눈다. 값은 바깥 공개 쪽 그대로이고 꾸미지 않는다.
"""
import base64
import os
import re
import subprocess
import sys

CHROME = next((c for c in ("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium")
               if os.path.exists(c)), None)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
PRICE = re.compile(r"(\$|US\$|₩|원|€|/mo|month|monthly|year|annual|free|pro|plus|max|ultra|team|business|enterprise|credit|token|요금|무료|월)", re.I)

DISMISS_JS = """() => {
  const words = ['accept all','accept','agree','got it','allow all','i understand','동의','모두 허용','확인','close','dismiss','no thanks'];
  for (const b of document.querySelectorAll('button, [role=button], a')) {
    const t = (b.innerText || '').trim().toLowerCase();
    if (t && t.length < 30 && words.some(w => t === w || t.startsWith(w))) { try { b.click(); } catch (e) {} }
  }
  // 화면을 덮는 고정 배너(쿠키·뉴스레터)를 숨긴다
  for (const e of document.querySelectorAll('body *')) {
    const s = getComputedStyle(e);
    if ((s.position === 'fixed' || s.position === 'sticky') && parseInt(s.zIndex || '0') >= 1000) {
      const r = e.getBoundingClientRect();
      if (r.height > 60 && (r.bottom > innerHeight - 5 || r.height > innerHeight * 0.5)) e.style.display = 'none';
    }
  }
}"""


def main() -> None:
    args = [a for a in re.split(r"\s+", (sys.argv[1] if len(sys.argv) > 1 else "").strip()) if a]
    need_browser = any(not a.startswith("json:") for a in args)
    if need_browser:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "playwright"], check=True)
        if not CHROME:
            subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
    import requests
    pw = browser = None
    if need_browser:
        from playwright.sync_api import sync_playwright  # noqa: PLC0415
        pw = sync_playwright().start()
        browser = pw.chromium.launch(executable_path=CHROME) if CHROME else pw.chromium.launch()
    for a in args:
        mode, _, url = a.partition(":")
        print(f"\n===== {mode} {url}", flush=True)
        try:
            if mode == "json":
                r = requests.get(url, timeout=30, headers={"User-Agent": UA, "Accept": "application/json"})
                print(f"status {r.status_code}"); print(r.text[:3000]); continue
            ctx = browser.new_context(viewport={"width": 1280, "height": 800}, locale="en-US", user_agent=UA)
            page = ctx.new_page()
            resp = page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(5000)
            print(f"status {resp.status if resp else '?'} final {page.url} title {page.title()[:120]!r}")
            if mode == "shot":
                page.evaluate(DISMISS_JS); page.wait_for_timeout(1200)
                jpg = page.screenshot(type="jpeg", quality=45)
                b64 = base64.b64encode(jpg).decode()
                print(f"--B64 {len(jpg)}--")
                for i in range(0, len(b64), 160):
                    print(b64[i:i + 160])
                print("--END--")
            else:
                txt = page.evaluate("() => document.body.innerText")
                if mode == "links":
                    ls = page.evaluate("() => [...document.querySelectorAll('a[href]')].map(a => (a.innerText||'').trim().replace(/\\s+/g,' ').slice(0,40) + ' | ' + a.href)")
                    print("\n".join(x for x in ls if not x.startswith(' |'))[:9000])
                elif mode == "head":
                    print(re.sub(r"\s+", " ", txt)[:300])
                elif mode == "price":
                    lines = [ln.strip() for ln in txt.split("\n") if ln.strip() and len(ln.strip()) < 220 and PRICE.search(ln)]
                    out = "\n".join(lines)
                    print(out[:4000])
                else:
                    print(re.sub(r"\n{3,}", "\n\n", txt)[:7000])
            ctx.close()
        except Exception as e:  # noqa: BLE001
            print(f"실패: {type(e).__name__}: {str(e)[:200]}")
    if browser:
        browser.close(); pw.stop()


if __name__ == "__main__":
    main()
