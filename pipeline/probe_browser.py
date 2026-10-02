"""화면을 실제 브라우저(Chromium)로 열어 본다. GitHub Actions 러너에서 돈다.

    python -u pipeline/probe_browser.py map,dong,home,business,detail
    python -u pipeline/probe_browser.py "ref:https://example.com/page"

샌드박스에서는 운영 사이트와 지도 타일에 닿지 않아 이 탐침으로 본다. 사진 대신
글자로 찍는다 — 핀 수, 이름표 겹침, 타일 응답, 카드 글귀, 많이 찾는 말, 그리고
참고 사이트는 화면 구조(제목·단추·블록의 자리와 글자)와 쓰는 지도 SDK.

probe.yml 이 requests 만 깔아 주므로 Playwright 는 여기서 깐다.
"""
import json
import re
import subprocess
import os
import sys
import time

BASE = "https://jiwon.knowhow-it.com"
GEO = {"latitude": 37.3800, "longitude": 126.8029}  # 시흥시청
MOBILE = {"width": 390, "height": 844}


def sh(cmd: list[str]) -> None:
    print("$", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


# 러너 이미지에 깔려 있는 크롬. 있으면 그것을 쓴다 — playwright install --with-deps 는
# apt 로 글꼴을 받는데, 미러가 느린 날은 그것만으로 10분 제한을 넘겼다.
CHROME = next((c for c in ("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium")
               if os.path.exists(c)), None)


def setup() -> None:
    sh([sys.executable, "-m", "pip", "install", "-q", "playwright"])
    if CHROME:
        print("러너의 브라우저를 쓴다:", CHROME, flush=True)
        return
    sh([sys.executable, "-m", "playwright", "install", "chromium"])


def _err(e) -> str:
    stack = (getattr(e, "stack", "") or "").replace("\n", " ⏎ ")[:420]
    return f"pageerror {getattr(e, 'name', '')}: {getattr(e, 'message', e)} @ {stack}"


def hook(page, errs: list[str]) -> None:
    page.on("pageerror", lambda e: errs.append(_err(e)))
    page.on("console", lambda m: errs.append(f"console {m.text[:160]}") if m.type == "error" else None)


OVERLAP_JS = """() => {
  const r = [...document.querySelectorAll('.pm-pin:not(.pm-dot)')].map(e => e.getBoundingClientRect());
  let n = 0;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = r[i], b = r[j];
    if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) n++;
  }
  const labels = [...document.querySelectorAll('.pm-pin:not(.pm-dot) b')].map(e => e.textContent).slice(0, 14);
  return { labeled: r.length, dots: document.querySelectorAll('.pm-pin.pm-dot').length, overlaps: n, labels };
}"""


def check_map(browser) -> None:
    print("\n== /map")
    ctx = browser.new_context(viewport=MOBILE, geolocation=GEO, permissions=["geolocation"], locale="ko-KR")
    page = ctx.new_page()
    errs: list[str] = []
    hook(page, errs)
    tiles: dict[str, list[int]] = {}

    def on_resp(r):
        host = re.sub(r"^https?://([^/]+)/.*$", r"\1", r.url)
        if r.request.resource_type == "image" and ("tile" in host or "vworld" in host or "cartocdn" in host):
            tiles.setdefault(host, []).append(r.status)

    page.on("response", on_resp)
    t = time.time()
    r = page.goto(BASE + "/map", wait_until="domcontentloaded")
    print(f"   status {r.status}  html {len(r.body()):,}B  {int((time.time() - t) * 1000)}ms")
    page.wait_for_selector(".pm-pin", timeout=20000)
    page.wait_for_timeout(2500)
    print("   멀리서:", json.dumps(page.evaluate(OVERLAP_JS), ensure_ascii=False))
    print("   타일:", {h: f"{len(s)}개, 상태 {sorted(set(s))}" for h, s in tiles.items()})
    print("   불러온 타일 img:", page.locator("img.leaflet-tile-loaded").count())
    page.get_by_role("button", name=re.compile("내 위치로 보기")).click()
    page.wait_for_timeout(3000)
    meline = page.locator("text=기준").first.inner_text() if page.locator("text=기준").count() else "(없음)"
    print("   내 위치 적용:", meline[:60])
    print("   내 위치 30km:", json.dumps(page.evaluate(OVERLAP_JS), ensure_ascii=False))
    head = page.locator('section[aria-label="공고 카드"] h2')
    print("   카드 목록:", head.first.inner_text() if head.count() else "(없음)")
    cards = page.locator(".pm-lcard").all_inner_texts()[:3]
    print("   첫 카드:", [c.replace("\n", " | ")[:140] for c in cards])
    print("   상태 배지:", sorted(set(page.locator(".pm-st").all_inner_texts()))[:8])
    if page.locator(".pm-lcard").count() > 1:
        page.locator(".pm-lcard").nth(1).click(position={"x": 24, "y": 60})
        page.wait_for_timeout(2500)
    card = page.locator(".pm-card").first.inner_text() if page.locator(".pm-card").count() else "(카드 없음)"
    print("   지도 카드:", card.replace("\n", " | ")[:320])
    print("   오류:", errs[:6] or "없음")
    ctx.close()


DONG_JS = """() => {
  const c = document.querySelector('[role="application"]');
  const box = c ? c.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
  const lab = [...document.querySelectorAll('.pm-pin.pm-dong.pm-at-tip')];
  const r = [...document.querySelectorAll('.pm-pin:not(.pm-dot):not(.pm-dongdot)')].map(e => e.getBoundingClientRect());
  let n = 0;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = r[i], b = r[j];
    if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) n++;
  }
  // 가운데에 가장 가까운 동 이름표(고른 동이 서야 한다)
  const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
  let mid = null, md = 1e9;
  for (const e of lab) { const q = e.getBoundingClientRect(); const d = Math.hypot(q.left + q.width / 2 - cx, q.bottom - cy); if (d < md) { md = d; mid = e.textContent; } }
  const engine = document.querySelector('.leaflet-container') ? 'leaflet' : (window.kakao && window.kakao.maps) ? 'kakao' : (window.naver && window.naver.maps) ? 'naver' : '?';
  return { engine, dongPins: document.querySelectorAll('.pm-pin.pm-dong').length, labeled: lab.length,
           offices: document.querySelectorAll('.pm-pin.pm-office').length, overlaps: n, mid, midPx: Math.round(md),
           labels: lab.map(e => e.textContent).slice(0, 12) };
}"""


def check_dong(browser) -> None:
    """동네 단계: 지역 고르기 셋째 칸(읍·면·동) → 동 핀·이름표·카드, 내 위치 → 근처 동·가까운 센터."""
    for name, vp in (("휴대폰", MOBILE), ("PC", {"width": 1366, "height": 900})):
        print(f"\n== /map 동네 단계 ({name})")
        ctx = browser.new_context(viewport=vp, geolocation=GEO, permissions=["geolocation"], locale="ko-KR")
        page = ctx.new_page()
        errs: list[str] = []
        hook(page, errs)
        apis: list[str] = []
        page.on("response", lambda r: apis.append(f"{r.status} {r.url.split('/api/map/')[1][:60]}") if "/api/map/" in r.url else None)
        page.goto(BASE + "/map", wait_until="domcontentloaded")
        page.wait_for_selector(".pm-pin", timeout=20000)
        page.select_option('select[aria-label="시·도"]', "경기도")
        page.select_option('select[aria-label="시·군·구"]', "시흥시")
        page.wait_for_selector('select[aria-label="읍·면·동"]', timeout=15000)
        opts = page.locator('select[aria-label="읍·면·동"] option').all_inner_texts()
        print("   시흥시 읍·면·동:", len(opts) - 1, "곳 —", ", ".join(opts[1:8]), "…")
        val = page.locator('select[aria-label="읍·면·동"] option', has_text="정왕1동").first.get_attribute("value")
        page.select_option('select[aria-label="읍·면·동"]', val)
        page.wait_for_timeout(4000)
        d = page.evaluate(DONG_JS)
        print("   동 핀:", json.dumps(d, ensure_ascii=False))
        bar = page.locator(".card.mt-6").first.inner_text().replace("\n", " ")
        print("   도구줄 끝:", bar[-90:])
        pin = page.locator(".pm-pin.pm-dong.pm-at-tip", has_text="정왕1동").first
        if pin.count():
            pin.click(force=True)
            page.wait_for_timeout(2000)
            card = page.locator(".pm-dcard").first.inner_text() if page.locator(".pm-dcard").count() else "(카드 없음)"
            print("   동 카드:", card.replace("\n", " | ")[:260])
            chip = page.locator(".pm-filter-region").first.inner_text() if page.locator(".pm-filter-region").count() else "(없음)"
            print("   목록 거르기:", chip.replace("\n", " "))
        else:
            print("   정왕1동 이름표가 안 보임")
        page.get_by_role("button", name=re.compile("내 위치로 보기")).click()
        page.wait_for_timeout(4000)
        near = page.locator("p", has_text="가까운 행정복지센터")
        print("   내 위치(시흥시청):", near.first.inner_text().replace("\n", " ")[:120] if near.count() else "(근처 줄 없음)")
        print("   내 위치 동 핀:", json.dumps(page.evaluate(DONG_JS), ensure_ascii=False))
        print("   지도 API:", apis[:8])
        print("   오류:", errs[:6] or "없음")
        ctx.close()


def check_home(browser, path: str) -> None:
    print(f"\n== {path}")
    ctx = browser.new_context(viewport=MOBILE, locale="ko-KR")
    page = ctx.new_page()
    errs: list[str] = []
    hook(page, errs)
    t = time.time()
    r = page.goto(BASE + path, wait_until="networkidle")
    print(f"   status {r.status}  {int((time.time() - t) * 1000)}ms")
    box = page.locator('input[aria-controls="portal-suggest"]')
    if box.count():
        bb = box.first.bounding_box()
        print(f"   검색창 위치 y={int(bb['y'])} (화면 높이 {MOBILE['height']}) 보기글={box.first.get_attribute('placeholder')!r}")
    chips = page.locator('div:has(> span:text("많이 찾는 말")) > a').all_inner_texts()
    print("   많이 찾는 말:", chips)
    # 포털형 첫 화면: 휴대폰 첫 화면 안에 검색창·바로가기·조건 카드가 드는가, 아래 탭 막대.
    spots = page.evaluate("""() => {
      const at = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; };
      return { shortcuts: at('nav[aria-label="바로가기"]'), find: at('#find'), bottomBar: at('nav[aria-label="빠른 이동"]'),
               shortcutN: document.querySelectorAll('nav[aria-label="바로가기"] a').length,
               headerSearch: !!document.querySelector('[data-site-header] input[data-search]') };
    }""")
    print("   [휴대폰] 자리:", json.dumps(spots, ensure_ascii=False))
    print("   오류:", errs[:6] or "없음")
    ctx.close()
    # 넓은 화면: 오른쪽 기둥 상자들
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, locale="ko-KR")
    page = ctx.new_page()
    derr: list[str] = []
    hook(page, derr)
    page.goto(BASE + path, wait_until="networkidle")
    aside = page.evaluate("""() => {
      const a = document.querySelector('aside[aria-label="한눈에 보기"]');
      if (!a) return null;
      const r = a.getBoundingClientRect();
      return { x: Math.round(r.left), w: Math.round(r.width),
               boxes: [...a.querySelectorAll('h2')].filter((h) => h.offsetParent).map((h) => h.innerText.trim()),
               rank: [...a.querySelectorAll('ol li')].map((li) => li.innerText.replace(/\\s+/g, ' ').trim()).slice(0, 10) };
    }""")
    print("   [데스크톱] 오른쪽 기둥:", json.dumps(aside, ensure_ascii=False))
    print("   [데스크톱] 오류:", derr[:6] or "없음")
    ctx.close()


def check_detail(browser, path: str) -> None:
    print(f"\n== {path}")
    ctx = browser.new_context(viewport=MOBILE, locale="ko-KR")
    page = ctx.new_page()
    errs: list[str] = []
    hook(page, errs)
    page.goto(BASE + path, wait_until="networkidle")
    page.wait_for_timeout(1500)
    print("   작은 지도:", page.locator(".leaflet-container").count(), "타일:", page.locator("img.leaflet-tile-loaded").count(),
          "핀:", page.locator(".pm-pin").all_inner_texts()[:2])
    print("   캘린더 링크:", page.locator('a[href^="https://calendar.google.com"]').count())
    print("   오류:", errs[:6] or "없음")
    ctx.close()


OUTLINE_JS = """() => {
  const out = [];
  const seen = new Set();
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const txt = (e) => (e.innerText || e.getAttribute('aria-label') || e.getAttribute('alt') || '').replace(/\\s+/g, ' ').trim();
  const sel = 'header, nav, main, section, article, aside, footer, h1, h2, h3, h4, button, [role=button], [role=tab], a.btn, table, ul, ol, img, iframe, canvas, [class*=map], [id*=map], [class*=card], [class*=tab], [class*=summary], [class*=info]';
  for (const e of document.querySelectorAll(sel)) {
    if (!vis(e) || seen.has(e)) continue;
    seen.add(e);
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    const t = txt(e);
    const isBlock = ['HEADER','NAV','MAIN','SECTION','ARTICLE','ASIDE','FOOTER','TABLE','UL','OL','IFRAME','CANVAS'].includes(e.tagName) || /map|card|tab|summary|info/i.test((e.className && e.className.baseVal === undefined ? e.className : '') + ' ' + e.id);
    out.push({
      y: Math.round(r.top + scrollY), x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height),
      tag: e.tagName.toLowerCase(), id: e.id || undefined,
      cls: (typeof e.className === 'string' ? e.className : '').split(/\\s+/).slice(0, 3).join('.') || undefined,
      bg: cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : undefined,
      radius: cs.borderRadius !== '0px' ? cs.borderRadius : undefined,
      text: isBlock ? t.slice(0, 90) : t.slice(0, 50),
      src: e.tagName === 'IFRAME' || e.tagName === 'IMG' ? (e.getAttribute('src') || '').slice(0, 90) : undefined,
    });
    if (out.length > 170) break;
  }
  out.sort((a, b) => a.y - b.y || a.x - b.x);
  return out;
}"""


def check_ref(browser, url: str) -> None:
    print(f"\n== 참고: {url}")
    for vp, tag in ((MOBILE, "휴대폰"), ({"width": 1280, "height": 900}, "데스크톱")):
        ctx = browser.new_context(viewport=vp, locale="ko-KR",
                                  user_agent=None if tag == "데스크톱" else
                                  "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36")
        page = ctx.new_page()
        scripts: list[str] = []
        page.on("request", lambda q: scripts.append(q.url) if q.resource_type == "script" else None)
        try:
            # 포털은 오래 붙어 있는 요청이 있어 networkidle 을 기다리면 끝나지 않는다.
            r = page.goto(url, wait_until="domcontentloaded", timeout=45000)
            try:
                page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:  # noqa: BLE001
                pass
        except Exception as e:  # noqa: BLE001
            print(f"   [{tag}] 못 열었다: {e}")
            ctx.close()
            continue
        page.wait_for_timeout(2500)
        print(f"   [{tag}] status {r.status if r else '-'} title={page.title()!r} 높이={page.evaluate('document.body.scrollHeight')}")
        # 바탕색·글꼴·검색창(입력칸과 그 테두리 상자)의 크기와 색.
        look = page.evaluate("""() => {
          const cs = (e) => getComputedStyle(e);
          const q = document.querySelector('input[type=search], input[name=query], input#query, input[role=combobox]');
          let box = q, hops = 0;
          while (box && hops < 6 && cs(box).borderTopWidth === '0px') { box = box.parentElement; hops++; }
          const r = (e) => e ? e.getBoundingClientRect() : null;
          return {
            body: cs(document.body).backgroundColor, html: cs(document.documentElement).backgroundColor,
            font: cs(document.body).fontFamily.slice(0, 80), size: cs(document.body).fontSize, color: cs(document.body).color,
            input: q ? { x: Math.round(r(q).left), y: Math.round(r(q).top + scrollY), w: Math.round(r(q).width), h: Math.round(r(q).height), font: cs(q).fontSize, ph: q.placeholder } : null,
            box: box ? { x: Math.round(r(box).left), w: Math.round(r(box).width), h: Math.round(r(box).height), border: cs(box).borderTopWidth + ' ' + cs(box).borderTopColor, radius: cs(box).borderRadius, bg: cs(box).backgroundColor } : null,
          };
        }""")
        print(f"   [{tag}] 모양:", json.dumps(look, ensure_ascii=False))
        sdk = sorted({re.sub(r'^https?://([^/?]+).*$', r'\1', s) for s in scripts if re.search(r'map|kakao|naver|google', s, re.I)})
        print(f"   [{tag}] 지도 관련 스크립트 호스트:", sdk)
        # 데스크톱은 첫 화면(위 1,400px) 구조만 짧게 — 기둥 폭·검색창·바로가기·오른쪽 기둥을 본다.
        if tag == "데스크톱":
            print("   [데스크톱] 화면 구조(위 1400px):")
            for o in [o for o in page.evaluate(OUTLINE_JS) if o["y"] < 1400][:90]:
                bits = [f"y{o['y']}", f"x{o['x']}", f"{o['w']}x{o['h']}", o["tag"]]
                for k in ("cls", "bg", "radius"):
                    if o.get(k):
                        bits.append(f"{k}={o[k]}")
                if o.get("text"):
                    bits.append(f"“{o['text'][:60]}”")
                print("     -", " ".join(bits))
        if tag == "휴대폰":
            body = page.evaluate("document.body.innerText").replace("\t", " ")
            body = re.sub(r"\n{2,}", "\n", body)
            print("   본문 글자(앞 3500자):")
            for line in body[:3500].split("\n"):
                if line.strip():
                    print("     |", line.strip()[:120])
            print("   화면 구조(위에서부터):")
            for o in page.evaluate(OUTLINE_JS):
                bits = [f"y{o['y']}", f"{o['w']}x{o['h']}", o["tag"]]
                for k in ("id", "cls", "bg", "radius", "src"):
                    if o.get(k):
                        bits.append(f"{k}={o[k]}")
                if o.get("text"):
                    bits.append(f"“{o['text']}”")
                print("     -", " ".join(bits))
        ctx.close()


def main() -> None:
    args = [a.strip() for a in (sys.argv[1] if len(sys.argv) > 1 else "map,home").split(",") if a.strip()]
    setup()
    from playwright.sync_api import sync_playwright  # noqa: PLC0415 — 위에서 깐 뒤에 부른다

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME) if CHROME else p.chromium.launch()
        for a in args:
            try:
                if a == "map":
                    check_map(browser)
                elif a == "dong":
                    check_dong(browser)
                elif a == "home":
                    check_home(browser, "/")
                elif a == "business":
                    check_home(browser, "/business")
                elif a == "detail":
                    check_detail(browser, "/p/WLF00001769")
                elif a.startswith("ref:"):
                    check_ref(browser, a[4:])
                elif a.startswith("/search") or a.startswith("/business/search"):
                    check_home(browser, a)
                elif a.startswith("/"):
                    check_detail(browser, a)
            except Exception as e:  # noqa: BLE001 — 하나가 실패해도 나머지는 본다
                print(f"\n== {a}: 실패 {type(e).__name__}: {str(e)[:300]}")
        browser.close()


if __name__ == "__main__":
    main()
