"""
tistory_mutual.py — 티스토리 포럼(블로그 소개)에서 맞구독을 원하는 블로그를 하루 몇 곳 찾아가 구독하고, 그 포럼 글에 댓글을 남긴다.

  python -u pipeline/tistory_mutual.py --count 3          # 실제로 구독·댓글
  python -u pipeline/tistory_mutual.py --count 3 --dry    # 찾기만(누르지 않음) — 버튼 위치를 화면으로 찍어 로그에 남긴다

- 대상: 포럼 최근 글 가운데 내 글이 아니고, 제목·본문에 맞구독·맞팔·구독·답방이 들어 있고, 내가 아직 댓글을 안 단 글.
- 댓글은 그 블로그 최신 글 제목을 RSS 로 읽어 넣는다("○○ 잘 읽고 구독했어요" — 실제로 열어 본 글).
- 이미 댓글을 단 글은 다시 가지 않는다(댓글 목록의 내 userId 로 판단). 따로 기록 표는 없다.
- 로그인은 TISTORY_COOKIE(관리 화면 쿠키 — TSSESSION 이 .tistory.com 전체에 통한다). 값은 찍지 않는다.
"""

from __future__ import annotations

import argparse
import base64
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

FORUM = "https://www.tistory.com/community/forum"
API = "https://www.tistory.com/legacy/community/forum"
MY_BLOG = "https://abcfact.tistory.com"
MY_USER_ID = 4917966
WANT = re.compile(r"맞구독|맞팔|구독|답방|서로이웃|소통")
CHROME = next((c for c in ("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium") if os.path.exists(c)), None)


def comment_text(title: str) -> str:
    head = f"「{title[:40]}」 잘 읽고 구독했어요!" if title else "블로그 잘 둘러보고 구독했어요!"
    return (f"{head} 저는 공공 채용·생활 정보와 AI 활용법을 정리하고 있어요. "
            f"맞구독 부탁드려요 :) {MY_BLOG}")


def cookies_for(raw: str) -> list[dict]:
    out = []
    for part in raw.replace("Cookie:", "").split(";"):
        if "=" in part:
            k, v = part.strip().split("=", 1)
            if k:
                out.append({"name": k, "value": v, "domain": ".tistory.com", "path": "/", "secure": True})
    return out


def latest_title(req, blog: str) -> str:
    try:
        r = req.get(blog.rstrip("/") + "/rss", timeout=20000)
        if r.ok:
            item = ET.fromstring(r.text()).find("./channel/item/title")
            return (item.text or "").strip() if item is not None else ""
    except Exception:  # noqa: BLE001
        pass
    return ""


def shot(page, label: str) -> None:
    jpg = page.screenshot(type="jpeg", quality=45)
    print(f"--B64 {label}--\n{base64.b64encode(jpg).decode()}\n--END--")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=3)
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    raw = os.environ.get("TISTORY_COOKIE", "").strip()
    if not raw:
        sys.exit("TISTORY_COOKIE 가 비어 있다")

    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "playwright"], check=True)
    if not CHROME:
        subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=CHROME) if CHROME else pw.chromium.launch()
        ctx = b.new_context(locale="ko-KR", viewport={"width": 1280, "height": 900})
        ctx.add_cookies(cookies_for(raw))
        page = ctx.new_page()
        calls: list[str] = []
        def on_resp(r):                   # 티스토리로 보낸 쓰기 요청만(통계·광고 제외) — 구독·댓글 API 확인용
            q = r.request
            if q.method in ("POST", "PUT", "DELETE") and "tistory.com" in q.url and "tiara" not in q.url:
                try:
                    body = r.text()[:300]
                except Exception:  # noqa: BLE001
                    body = ""
                calls.append(f"{q.method} {r.status} {q.url} {(q.post_data or '')[:200]} → {body}")
        page.on("response", on_resp)

        entries = (page.request.get(f"{API}/entries.json").json().get("data") or {}).get("entries") or []
        print(f"포럼 최근 글 {len(entries)}편")
        done = 0
        for e in entries:
            if done >= a.count:
                break
            if e.get("userId") == MY_USER_ID or not WANT.search(f"{e.get('title', '')} {e.get('content', '')}"):
                continue
            cm = (page.request.get(f"{API}/entry/{e['id']}/comments.json?lastId=-1").json().get("data") or {}).get("comments") or []
            if any(c.get("userId") == MY_USER_ID for c in cm):
                continue
            blog = e.get("userDefaultUrl") or ""
            title = latest_title(page.request, blog)
            text = comment_text(title)
            print(f"\n== {e['id']} · {e.get('userName')} · {blog} · 최신 글: {title or '(없음)'}")

            # 1) 블로그에 가서 구독
            page.goto(blog, wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(2500)
            btn = page.locator("text=/구독하기/").first
            already = page.locator("text=/구독중/").count() > 0
            print(f"  구독 버튼: {'있음' if btn.count() else '없음'}{' · 이미 구독 중' if already else ''}")
            if a.dry:
                shot(page, f"blog_{e['id']}")
            elif btn.count() and not already:
                btn.click()
                page.wait_for_timeout(2000)
                print("  구독함")

            # 2) 포럼 글에 댓글
            page.goto(f"{FORUM}?id={e['id']}", wait_until="domcontentloaded", timeout=45000)
            page.wait_for_timeout(2500)
            box = page.locator("textarea").first
            print(f"  댓글 칸: {'있음' if box.count() else '없음'} · 남길 말: {text}")
            if a.dry:
                if box.count():
                    box.scroll_into_view_if_needed()
                shot(page, f"forum_{e['id']}")
            elif box.count():
                box.fill(text)
                page.locator("button:has-text('완료')").first.click()
                page.wait_for_timeout(2000)
                print("  댓글 남김")
            done += 1
        print(f"\n{done}곳 {'(dry — 누르지 않음)' if a.dry else '처리'}")
        print("보낸 요청:")
        for c in calls:
            print("  " + c)
        b.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
