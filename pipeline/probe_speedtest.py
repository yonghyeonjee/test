"""Ookla Speedtest Global Index(https://www.speedtest.net/global-index)를 러너의 브라우저로 열어
고정 인터넷·모바일 국가 순위표를 글자로 찍는다. 샌드박스는 speedtest.net 에 닿지 않아 러너에서 본다.

    python -u pipeline/probe_speedtest.py            # 두 표 모두, 상위 40 + 대한민국 줄
    python -u pipeline/probe_speedtest.py 60         # 상위 60

출력: 자료 달, 표마다 (순위, 나라, 중앙값 다운로드 Mbps) 와 쪽에 보이는 숫자 묶음. 마지막에 JSON 한 덩어리
(--JSON-- … --END--)로 다시 찍어 손으로 옮겨 적기 쉽게 한다. 숫자는 꾸미지 않고 쪽에 보이는 그대로다.
"""
import json
import os
import re
import subprocess
import sys

URL = "https://www.speedtest.net/global-index"
CHROME = next((c for c in ("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium")
               if os.path.exists(c)), None)


def setup() -> None:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "playwright"], check=True)
    if not CHROME:
        subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)


def grab(page) -> dict:
    """표가 들어 있는 모든 <table> 과, 표가 아니라 div 로 그린 목록(class 에 rank/country 가 든 것)을 글자로."""
    return page.evaluate("""() => {
      const out = { title: document.title, tables: [], lists: [], headings: [] };
      document.querySelectorAll('h1,h2,h3,h4').forEach(h => out.headings.push(h.innerText.trim().slice(0, 120)));
      document.querySelectorAll('table').forEach(t => {
        const rows = [...t.querySelectorAll('tr')].map(tr => [...tr.querySelectorAll('th,td')].map(c => c.innerText.trim().replace(/\\s+/g, ' ')));
        out.tables.push(rows.filter(r => r.length));
      });
      const seen = new Set();
      document.querySelectorAll('[class*="rank"],[class*="country"],[class*="Rank"],[class*="Country"]').forEach(e => {
        const p = e.closest('li, tr, [class*="row"], [class*="Row"]') || e;
        const t = p.innerText.trim().replace(/\\s+/g, ' ');
        if (t && t.length < 200 && !seen.has(t)) { seen.add(t); out.lists.push(t); }
      });
      const m = document.body.innerText.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\\s+20\\d\\d/g) || [];
      out.months = [...new Set(m)].slice(0, 6);
      return out;
    }""")


def main() -> None:
    top = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].strip().isdigit() else 40
    setup()
    from playwright.sync_api import sync_playwright  # noqa: PLC0415

    result: dict = {"url": URL}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME) if CHROME else p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 900}, locale="en-US",
                                  user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")
        page = ctx.new_page()
        page.goto(URL, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(6000)
        for tab in ("fixed", "mobile"):
            # 탭 단추가 있으면 누른다(글자로 찾는다). 없으면 같은 쪽을 다시 읽는다.
            try:
                btn = page.get_by_role("button", name=re.compile(tab, re.I)).first
                if btn and btn.is_visible():
                    btn.click(); page.wait_for_timeout(2500)
            except Exception as e:  # noqa: BLE001
                print(f"  ({tab} 단추 못 누름: {type(e).__name__})")
            try:
                link = page.get_by_role("link", name=re.compile(rf"^\s*{tab}\s*$", re.I)).first
                if link and link.is_visible():
                    link.click(); page.wait_for_timeout(2500)
            except Exception:  # noqa: BLE001
                pass
            g = grab(page)
            result[tab] = g
            print(f"\n== {tab}: 제목 {g['title']!r} 달 {g['months']} 표 {len(g['tables'])}개 목록줄 {len(g['lists'])}개")
            print("   머리글:", " | ".join(g["headings"][:12]))
            for ti, t in enumerate(g["tables"]):
                print(f"   -- 표 {ti} ({len(t)}줄)")
                for r in t[: top + 1]:
                    print("     ", " | ".join(r))
                for r in t:
                    if any("Korea" in c for c in r):
                        print("      ★", " | ".join(r))
            for line in g["lists"][: top]:
                print("     ·", line)
            for line in g["lists"]:
                if "Korea" in line:
                    print("      ★", line)
        # 쪽 전체 글자도 한 번(표가 div 로 그려졌을 때 대비) — 앞 6,000자
        txt = page.evaluate("() => document.body.innerText")
        result["text_head"] = txt[:6000]
        print("\n== 쪽 글자 앞부분\n" + txt[:6000])
        os.makedirs("shots", exist_ok=True)
        page.screenshot(path="shots/speedtest-global-index.png", full_page=True)
        ctx.close(); browser.close()
    print("\n--JSON--")
    print(json.dumps(result, ensure_ascii=False)[:60000])
    print("--END--")


if __name__ == "__main__":
    main()
