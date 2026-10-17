"""
tistory_publish.py — blog_posts 의 글을 티스토리(abcfact.tistory.com)에도 올린다.

티스토리 공개 API 는 끝났다. 관리자 화면이 쓰는 내부 주소(POST /manage/post.json)를
로그인 쿠키로 부른다 — npm 의 tistory-mcp 가 쓰는 것과 같은 길이다. 쿠키는 사람이 한 번
카카오 로그인해 얻는다(README '티스토리' 절). 만료되면 이 스크립트가 종료 코드 2 로 알린다.

  python pipeline/tistory_publish.py --check                 # 쿠키가 살아 있나 + 카테고리 id 목록
  python pipeline/tistory_publish.py --dry                   # 올릴 글을 HTML 로 찍어 보기만
  python pipeline/tistory_publish.py                         # 어제·오늘 쓴 글 중 아직 안 올린 것
  python pipeline/tistory_publish.py --slug jobs-2026-10-16 --visibility private
  python pipeline/tistory_publish.py --mode full             # 요약 대신 전문

기본은 요약(summary)이다. 사이트(/story/<slug>)에 같은 글이 전문으로 있으니, 티스토리에는
들머리·절마다 첫 문단·원문 링크만 올려 검색엔진이 두 쪽을 같은 글로 보지 않게 한다.

환경변수
  TISTORY_COOKIE     필수. 로그인한 브라우저에서 abcfact.tistory.com/manage 요청의 Cookie 헤더 전체.
  TISTORY_HOST       기본 abcfact.tistory.com
  TISTORY_CATEGORY   카테고리 id(정수). 기본 0(미지정). --check 로 목록을 본다.
  SUPABASE_URL, SUPABASE_SERVICE_KEY   글을 읽고 발행 기록(tistory_posts)을 남길 때. --dry 라도 글을 읽는 데 쓴다.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import re
import sys

import requests

SITE = "https://jiwon.knowhow-it.com"
BRAND = "K나라지원"
DEFAULT_HOST = "abcfact.tistory.com"
VISIBILITY = {"private": 0, "protected": 15, "public": 20}   # 티스토리 post.json 의 visibility 정수
MAX_TAGS = 10                                                  # 티스토리 글 하나의 태그 한도
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")

EXIT_EXPIRED = 2


class SessionExpired(Exception):
    """로그인 쪽으로 보내거나 401 — 쿠키가 죽었다."""


class TistoryError(Exception):
    pass


# ── 인라인 문법 → HTML ────────────────────────────────────
# 사이트(web/components/Inline.tsx)와 같은 두 가지만 알아듣는다: **굵게**, [글자](주소).
_INLINE = re.compile(r"\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)")


def abs_url(href: str) -> str:
    return SITE + href if href.startswith("/") else href


def inline_html(text: str) -> str:
    s = html.escape(text, quote=False)
    def sub(m: re.Match) -> str:
        if m.group(1) is not None:
            return f"<b>{m.group(1)}</b>"
        return f'<a href="{html.escape(abs_url(m.group(3)), quote=True)}">{m.group(2)}</a>'
    return _INLINE.sub(sub, s)


# ── 블록 → HTML ───────────────────────────────────────────
def block_html(b: dict) -> str:
    t = b.get("type")
    if t == "toc":
        return ""                                   # 티스토리에선 목차 닻이 잘 안 먹는다. 뺀다.
    if t == "p":
        return f"<p>{inline_html(b['text'])}</p>"
    if t == "h2":
        return f"<h2>{inline_html(b['text'])}</h2>"
    if t == "list":
        return "<ul>" + "".join(f"<li>{inline_html(x)}</li>" for x in b["items"]) + "</ul>"
    if t == "table":
        head = "".join(f"<th>{inline_html(h)}</th>" for h in b["head"])
        rows = "".join("<tr>" + "".join(f"<td>{inline_html(c)}</td>" for c in r) + "</tr>" for r in b["rows"])
        return f"<table><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>"
    if t == "bars":
        unit = b.get("unit", "건")
        rows = "".join(f"<tr><td>{inline_html(i['label'])}</td><td>{i['n']:,}{unit}</td></tr>" for i in b["items"])
        return f"<table><tbody>{rows}</tbody></table>"
    if t == "links":
        return "<ul>" + "".join(
            f'<li><a href="{html.escape(abs_url(i["href"]), quote=True)}">{html.escape(i["label"], quote=False)}</a></li>'
            for i in b["items"]) + "</ul>"
    if t == "note":
        return f"<blockquote>{inline_html(b['text'])}</blockquote>"
    return ""


def summary_blocks(body: list[dict], links_cap: int = 5) -> list[dict]:
    """요약판: 첫 절 앞 문단 하나, 절마다 제목과 첫 본문 블록 하나. 링크 목록은 앞 몇 개만."""
    out: list[dict] = []
    seen_h2 = False
    took = False
    for b in body:
        t = b.get("type")
        if t == "toc":
            continue
        if t == "h2":
            out.append(b); seen_h2 = True; took = False
            continue
        if took or t == "note":
            continue
        if not seen_h2 and t != "p":
            continue
        if t == "links":
            b = {**b, "items": b["items"][:links_cap]}
        if t == "list":
            b = {**b, "items": b["items"][:links_cap]}
        out.append(b); took = True
    # 절은 있는데 본문 블록이 하나도 안 붙은 제목만 남으면 뺀다.
    cleaned: list[dict] = []
    for i, b in enumerate(out):
        nxt = out[i + 1] if i + 1 < len(out) else None
        if b.get("type") == "h2" and (nxt is None or nxt.get("type") == "h2"):
            continue
        cleaned.append(b)
    return cleaned


def render(post: dict, mode: str = "summary") -> str:
    url = f"{SITE}/story/{post['slug']}"
    body = post["body"] if mode == "full" else summary_blocks(post["body"])
    parts = [f"<p>{html.escape(post['summary'], quote=False)}</p>"]
    if mode != "full":
        parts.append(f'<p>이 글은 요약입니다. 표와 공고 목록 전체는 <a href="{url}">{BRAND} 원문</a>에 있습니다.</p>')
    parts += [block_html(b) for b in body]
    parts.append(
        f'<p>원문: <a href="{url}">{html.escape(post["title"], quote=False)}</a> · '
        f'조건에 맞는 지원사업·채용은 <a href="{SITE}">{BRAND}</a>에서 찾습니다.</p>'
    )
    return "\n".join(p for p in parts if p)


# ── 티스토리 관리자 호출 ──────────────────────────────────
def clean_cookie(raw: str) -> str:
    s = raw.strip()
    if s.lower().startswith("cookie:"):
        s = s[len("cookie:"):].strip()
    return " ".join(s.split())    # 줄바꿈·겹친 공백 정리


def looks_like_login(url_or_html: str) -> bool:
    s = url_or_html[:4000]
    return "/auth/login" in s or "accounts.kakao.com" in s or "tistory.com/auth" in s


class Tistory:
    def __init__(self, host: str, cookie: str, timeout: int = 60):
        self.host = host
        self.timeout = timeout
        self.s = requests.Session()
        self.s.headers.update({
            "cookie": cookie,
            "origin": f"https://{host}",
            "referer": f"https://{host}/manage/",
            "user-agent": UA,
            "accept": "application/json, text/plain, */*",
        })

    def _req(self, method: str, path: str, **kw) -> requests.Response:
        r = self.s.request(method, f"https://{self.host}{path}", allow_redirects=False, timeout=self.timeout, **kw)
        check_response(r)
        return r

    def categories(self) -> list[tuple[str, str]]:
        """[(id, 이름)] — 하위 카테고리는 '상위 > 하위'."""
        data = self._req("GET", "/manage/category.json").json()
        out: list[tuple[str, str]] = []
        def walk(nodes, prefix=""):
            for n in nodes or []:
                if not isinstance(n, dict):
                    continue
                cid = n.get("id", n.get("categoryId"))
                name = n.get("name", n.get("label", ""))
                label = f"{prefix}{name}"
                if cid is not None:
                    out.append((str(cid), label))
                walk(n.get("children") or n.get("subCategories") or [], label + " > ")
        root = data.get("categories") if isinstance(data, dict) else data
        if isinstance(root, dict):
            root = root.get("categoryTree") or root.get("categories") or root.get("list") or []
        walk(root)
        return out

    def publish(self, *, title: str, content: str, category: int, tags: list[str], visibility: str) -> tuple[str, str]:
        body = {
            "id": "0", "title": title, "content": content, "slogan": "",
            "visibility": VISIBILITY[visibility], "category": int(category),
            "tag": ",".join(t.replace(",", " ") for t in tags[:MAX_TAGS]),
            "published": 1, "password": "", "uselessMarginForEntry": 1,
            "cclCommercial": 0, "cclDerive": 0, "type": "post", "attachments": [],
            "recaptchaValue": "", "draftSequence": None, "totalWritingTimeMs": 0,
        }
        r = self._req("POST", "/manage/post.json", json=body)
        text = r.text
        if looks_like_login(text):
            raise SessionExpired("post.json 이 로그인 화면을 돌려줬다")
        try:
            data = json.loads(text)
        except ValueError as e:
            raise TistoryError(f"post.json 응답이 JSON 이 아니다: {text[:300]!r}") from e
        entry = str(data.get("entryUrl", "")).strip() if isinstance(data, dict) else ""
        return parse_entry_url(self.host, entry, text)


def check_response(r: requests.Response) -> None:
    if r.status_code == 401:
        raise SessionExpired("401")
    if 300 <= r.status_code < 400:
        loc = r.headers.get("location", "")
        if looks_like_login(loc):
            raise SessionExpired(f"→ {loc}")
        raise TistoryError(f"{r.request.method} {r.url} → {r.status_code} {loc}")
    if not r.ok:
        raise TistoryError(f"{r.request.method} {r.url} → {r.status_code} {r.text[:300]!r}")


def parse_entry_url(host: str, entry: str, raw: str = "") -> tuple[str, str]:
    """post.json 응답의 entryUrl → (글 id, 글 주소). 다른 도메인이거나 모양이 다르면 실패로 본다."""
    if not entry:
        raise TistoryError(f"post.json 응답에 entryUrl 이 없다: {raw[:300]!r}")
    if looks_like_login(entry):
        raise SessionExpired(entry)
    if entry.startswith("http"):
        m = re.match(r"https?://([^/]+)(/.*)?$", entry)
        if not m or m.group(1) != host:
            raise TistoryError(f"entryUrl 의 host 가 다르다: {entry}")
        path = m.group(2) or "/"
    else:
        path = entry if entry.startswith("/") else "/" + entry
    m = re.fullmatch(r"/(\d+)/?", path)
    if not m:
        raise TistoryError(f"entryUrl 모양이 글이 아니다: {entry}")
    return m.group(1), f"https://{host}/{m.group(1)}"


# ── 글 고르기·기록 ────────────────────────────────────────
def today_kst() -> dt.date:
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=9)).date()


def supabase_client():
    from supabase import create_client
    url, key = os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"]
    try:
        from supabase import ClientOptions
        return create_client(url, key, options=ClientOptions(postgrest_client_timeout=120))
    except Exception:  # noqa: BLE001 — 옛 버전은 옵션 이름이 다르다
        return create_client(url, key)


COLS = "slug,kind,subject,title,summary,keywords,body,published_at"


def pick_posts(sb, slug: str | None, since_days: int, limit: int) -> list[dict]:
    if slug:
        rows = sb.table("blog_posts").select(COLS).eq("slug", slug).execute().data or []
        if not rows:
            sys.exit(f"blog_posts 에 slug={slug} 가 없다")
        return rows
    since = (today_kst() - dt.timedelta(days=since_days)).isoformat()
    rows = (sb.table("blog_posts").select(COLS).gte("published_at", since).lte("published_at", today_kst().isoformat())
            .order("published_at").execute().data or [])
    done = {r["slug"] for r in (sb.table("tistory_posts").select("slug").execute().data or [])}
    rows = [r for r in rows if r["slug"] not in done]
    rows.sort(key=lambda r: (r["kind"] != "daily", r["published_at"], r["slug"]))   # 브리핑 먼저
    return rows[:limit]


def record(sb, post: dict, post_id: str, url: str, mode: str, visibility: str) -> None:
    sb.table("tistory_posts").insert({
        "slug": post["slug"], "post_id": post_id, "url": url, "mode": mode, "visibility": visibility,
    }).execute()


# ── main ─────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="쿠키 확인과 카테고리 목록만")
    ap.add_argument("--slug", help="이 글 하나만(이미 올렸어도 다시 올린다)")
    ap.add_argument("--since", type=int, default=1, help="며칠 전 글까지 볼지(기본 1 = 어제·오늘)")
    ap.add_argument("--limit", type=int, default=5, help="한 번에 올릴 최대 편수")
    ap.add_argument("--mode", choices=["summary", "full"], default=os.environ.get("TISTORY_MODE", "summary"))
    ap.add_argument("--visibility", choices=sorted(VISIBILITY), default=os.environ.get("TISTORY_VISIBILITY", "public"))
    ap.add_argument("--category", type=int, default=int(os.environ.get("TISTORY_CATEGORY") or 0))
    ap.add_argument("--dry", action="store_true", help="올리지 않고 HTML 만 찍는다")
    a = ap.parse_args()

    host = os.environ.get("TISTORY_HOST", DEFAULT_HOST).replace("https://", "").strip("/")
    cookie = clean_cookie(os.environ.get("TISTORY_COOKIE", ""))

    try:
        if a.check:
            if not cookie:
                sys.exit("TISTORY_COOKIE 가 비어 있다")
            cats = Tistory(host, cookie).categories()
            print(f"쿠키 살아 있음: {host}")
            print("카테고리 id → 이름 (TISTORY_CATEGORY 에 넣을 값):")
            for cid, name in cats:
                print(f"  {cid:>8}  {name}")
            if not cats:
                print("  (카테고리 없음 — 0 으로 올라간다)")
            return 0

        sb = supabase_client()
        posts = pick_posts(sb, a.slug, a.since, a.limit)
        if not posts:
            print("올릴 글이 없다(이미 다 올렸거나 기간 안에 쓴 글이 없다)")
            return 0

        if a.dry:
            for p in posts:
                print(f"\n===== [{p['kind']}] {p['slug']} · {p['title']}  (mode={a.mode}, visibility={a.visibility}, category={a.category})")
                print(render(p, a.mode))
            return 0

        if not cookie:
            sys.exit("TISTORY_COOKIE 가 비어 있다")
        t = Tistory(host, cookie)
        n = 0
        for p in posts:
            post_id, url = t.publish(title=p["title"], content=render(p, a.mode), category=a.category,
                                     tags=list(p.get("keywords") or []), visibility=a.visibility)
            record(sb, p, post_id, url, a.mode, a.visibility)
            print(f"올림: {p['slug']} → {url}")
            n += 1
        print(f"{n}편 올렸다")
        return 0
    except SessionExpired as e:
        print(f"::error::티스토리 쿠키가 만료됐다({e}). 브라우저에서 다시 로그인해 TISTORY_COOKIE 를 갱신한다(README '티스토리' 절).",
              file=sys.stderr)
        return EXIT_EXPIRED


if __name__ == "__main__":
    sys.exit(main())
