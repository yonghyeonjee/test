"""스크립트로 그리는 기관 게시판을 브라우저(Playwright)로 읽는다.

서울 서버가 HTML 로는 글을 못 읽은 게시판 목록을 내주면(/api/cron/orgsites?step=jsboards, robots.txt 허용분만),
크롬으로 열어 다 그려진 뒤의 글 목록(제목·주소·날짜)을 읽어 서버로 돌려보낸다(POST). 거르기와 저장은 서버가 한다.
GitHub Actions(미국)에서 돈다 — 외국 IP 를 막는 누리집은 열리지 않고 건너뛴다.
"""
import json
import os
import re
import shutil
import sys
import time

import requests

SITE = os.environ.get("SITE", "https://jiwon.knowhow-it.com")
AUTH = {"Authorization": f"Bearer {os.environ['CRON_SECRET']}"}
UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com/about; public notice index)"

EXTRACT = r"""
() => {
  const DATE = /(20\d{2})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/;
  const NAV = /^(처음|이전|다음|마지막|더보기|목록|홈|home|top|로그인|회원가입|사이트맵|검색|닫기|열기|\d+)$/i;
  const fnv = (t) => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); };
  const out = []; const seen = new Set(); const now = Date.now();
  for (const a of document.querySelectorAll('a')) {
    let title = (a.innerText || a.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
    title = title.replace(/^(글\s?)?제목\s*[:：]?\s*/, '');
    for (let k = 0; k < 4; k++) title = title.replace(/\s*(새\s?글|첨부\s?파일(\s?있음)?|new|hot|N)\s*$/i, '').trim();
    if (title.length < 6 || title.length > 200 || NAV.test(title)) continue;
    // 같은 줄(행) 안의 날짜
    const row = a.closest('tr, li, dl, article') || a.parentElement;
    const m = row ? DATE.exec(row.innerText.replace(title, ' ')) : null;
    if (!m) continue;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (isNaN(d) || d > now + 7 * 864e5 || d < now - 3 * 365 * 864e5) continue;
    const href = a.getAttribute('href') || '';
    const js = !href || /^(javascript:|#)/i.test(href);
    const url = js ? location.href.replace(/#.*$/, '') + '#t=' + fnv(title) : new URL(href, location.href).href.replace(/#.*$/, '');
    if (seen.has(url)) continue; seen.add(url);
    out.push({ title, url, posted: d.toISOString().slice(0, 10) });
  }
  return out.slice(0, 40);
}
"""


def main() -> None:
    boards = requests.get(f"{SITE}/api/cron/orgsites?step=jsboards", headers=AUTH, timeout=90).json().get("boards", [])
    print(f"브라우저로 읽을 게시판 {len(boards)}곳")
    if not boards:
        return
    from playwright.sync_api import sync_playwright  # noqa: PLC0415

    chrome = shutil.which("google-chrome") or None
    ok = got = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chrome) if chrome else p.chromium.launch()
        ctx = browser.new_context(user_agent=UA, locale="ko-KR")
        for b in boards:
            page = ctx.new_page()
            try:
                try:
                    page.goto(b["board"], wait_until="networkidle", timeout=25000)
                except Exception:  # noqa: BLE001 — 광고·통계 요청이 끝나지 않는 곳
                    page.goto(b["board"], wait_until="domcontentloaded", timeout=25000)
                    page.wait_for_timeout(3000)
                items = page.evaluate(EXTRACT)
                r = requests.post(f"{SITE}/api/cron/orgsites", headers=AUTH, timeout=60,
                                  json={"org": b["org"], "kind": b["kind"], "board": b["board"], "items": items}).json()
                ok += 1
                got += int(r.get("got") or 0)
                print(f"  {b['org'][:30]:30} 읽음 {len(items):2}  넣음 {r.get('got')}  {r.get('err') or ''}")
            except Exception as e:  # noqa: BLE001 — 하나가 안 열려도 나머지는 본다
                print(f"  {b['org'][:30]:30} 실패 {type(e).__name__}: {str(e)[:120]}")
            finally:
                page.close()
            time.sleep(2)  # 기관마다 2초 쉰다
        browser.close()
    print(f"열린 곳 {ok}/{len(boards)}, 넣은 글 {got}")


if __name__ == "__main__":
    main()
