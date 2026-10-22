"""휴대폰 화면으로 쪽을 열어 LCP 후보가 언제·무엇으로 바뀌는지와 React hydration 오류가 있는지 본다(2026-10-22).
    python -u pipeline/probe_lcp.py "https://jiwon.knowhow-it.com/,https://…"
Lighthouse 가 "글자 LCP 그리기 지연 4초"라 했는데 글자는 서버에서 그려진 것이라, 무엇이 늦게 다시 그리는지 직접 본다.
"""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
from probe_browser import CHROME, setup  # noqa: E402

JS = """
() => new Promise((res) => {
  const out = { lcp: [], cls: [], errors: window.__errs || [] };
  // 자리 흔들림: 언제, 무엇이, 얼마나. 글꼴이 바뀐 시각과 견준다.
  const pc = new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (e.hadRecentInput) continue;
      out.cls.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4),
        src: (e.sources || []).slice(0, 3).map((s) => { const n = s.node; const pr = s.previousRect, cr = s.currentRect;
          return `${n ? n.tagName + '.' + String(n.className).slice(0, 30) : '?'} y${Math.round(pr.y)}→${Math.round(cr.y)} h${Math.round(pr.height)}→${Math.round(cr.height)}`; }) });
    }
  });
  pc.observe({ type: 'layout-shift', buffered: true });
  document.fonts.ready.then(() => { out.fontsReady = Math.round(performance.now()); });
  const po = new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      const el = e.element;
      out.lcp.push({ t: Math.round(e.startTime), size: e.size, tag: el ? el.tagName : null,
                     cls: el ? String(el.className).slice(0, 60) : null, text: el ? (el.textContent || '').slice(0, 40) : null,
                     url: e.url || null });
    }
  });
  po.observe({ type: 'largest-contentful-paint', buffered: true });
  setTimeout(() => { po.disconnect(); pc.disconnect(); out.fcp = Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0); res(out); }, 9000);
})
"""


def main() -> None:
    setup()
    from playwright.sync_api import sync_playwright  # noqa: PLC0415
    urls = [u.strip() for u in (sys.argv[1] if len(sys.argv) > 1 else "https://jiwon.knowhow-it.com/").split(",") if u.strip()]
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME) if CHROME else p.chromium.launch()
        for u in urls:
            ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="ko-KR",
                                user_agent="Mozilla/5.0 (Linux; Android 11; moto g power) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Mobile Safari/537.36")
            # 느린 기기 흉내: CPU 4배 느리게.
            page = ctx.new_page()
            cdp = ctx.new_cdp_session(page)
            cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
            errs: list[str] = []
            page.on("console", lambda m: errs.append(f"[{m.type}] {m.text[:200]}") if m.type in ("error", "warning") else None)
            page.on("pageerror", lambda e: errs.append(f"[pageerror] {str(e)[:200]}"))
            page.add_init_script("window.__errs=[]")
            print(f"\n== {u}")
            page.goto(u, wait_until="domcontentloaded", timeout=60000)
            r = page.evaluate(JS)
            print(f"  FCP {r.get('fcp')}ms")
            for c in r["lcp"]:
                print(f"  LCP 후보 {c['t']}ms size {c['size']} <{c['tag']}> {c['cls']!r} {c['text']!r} {c['url'] or ''}")
            react = [e for e in errs if "Minified React error" in e or "hydrat" in e.lower() or "Hydration" in e]
            print(f"  글꼴 준비 {r.get('fontsReady')}ms, 흔들림 합계 {sum(c['v'] for c in r['cls']):.3f}")
            for c in r["cls"]:
                print(f"  흔들림 {c['t']}ms {c['v']}: " + " | ".join(c["src"]))
            print(f"  콘솔 오류 {len(errs)}개, React/hydration 관련 {len(react)}개")
            for e in (react or errs)[:8]:
                print("   ", e)
            ctx.close()
        b.close()


if __name__ == "__main__":
    main()
