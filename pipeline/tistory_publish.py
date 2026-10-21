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
  python pipeline/tistory_publish.py --slug X --images shots/manifest.json   # 화면 사진을 본문에 끼워 발행

기본은 요약(summary)이다. 사이트(/story/<slug>)에 같은 글이 전문으로 있으니, 티스토리에는
들머리·절마다 첫 문단·원문 링크만 올려 검색엔진이 두 쪽을 같은 글로 보지 않게 한다.

환경변수
  TISTORY_COOKIE     필수. 로그인한 브라우저에서 abcfact.tistory.com/manage 요청의 Cookie 헤더 전체.
  TISTORY_HOST       기본 abcfact.tistory.com
  TISTORY_CATEGORY   카테고리 id(정수). 비우면 글마다 알맞은 것을 고른다(category_for: 자격증 → 일상TIP,
                     기업지원 → B2G, 그 밖의 채용·공무원·복지 → policy). --check 로 목록을 본다.
  SUPABASE_URL, SUPABASE_SERVICE_KEY   글을 읽고 발행 기록(tistory_posts)을 남길 때. --dry 라도 글을 읽는 데 쓴다.

이미지: `pipeline/shot_pages.py` 가 찍은 shots/manifest.json([{"file","caption"}])을 --images 로 주면
`POST /manage/post/attach.json` 으로 올리고, 본문에는 티스토리 치환자 `[##_Image|kage@…|CDM|1.3|{…}_##]` 를,
발행 body 의 attachments 에는 같은 ref 를 넣는다(둘 다 있어야 이미지가 안 지워진다). 첫 장은 들머리 뒤,
그다음부터는 절(h2)마다 첫 블록 뒤에 하나씩 들어간다.
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

# abcfact.tistory.com 의 카테고리 id(--check 가 찍는 목록, 2026-10-17). 새 카테고리를 만들면 여기도 적는다.
CATEGORIES = {"policy": 1170227, "B2G": 1258777, "일상TIP": 1198430, "IT": 946764}
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
    s = _INLINE.sub(sub, s)
    return re.sub(r"`([^`]+)`", r"<code>\1</code>", s)


# ── 블록 → HTML ───────────────────────────────────────────
def block_html(b: dict) -> str:
    t = b.get("type")
    if t == "toc":
        return ""                                   # 티스토리에선 목차 닻이 잘 안 먹는다. 뺀다.
    if t == "p":
        return f"<p>{inline_html(b['text'])}</p>"
    if t == "h2":
        return f"<h2>{inline_html(b['text'])}</h2>"
    if t == "h3":
        return f"<h3>{inline_html(b['text'])}</h3>"
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


def image_html(replacer: str, caption: str | None) -> str:
    cap = f"<p><em>{html.escape(caption, quote=False)}</em></p>" if caption else ""
    return f"<p>{replacer}</p>{cap}"


def weave_images(body: list[dict], images: list[tuple[str, str | None]]) -> list[str]:
    """블록 HTML 사이에 이미지를 끼운다. 첫 장은 첫 절(h2) 앞 문단들 뒤, 그다음부터는 절마다 첫 블록 뒤.
    절보다 사진이 많으면 남은 사진은 맨 뒤에 이어 붙인다."""
    out: list[str] = []
    q = list(images)
    seen_h2 = False
    took_in_section = False
    for i, b in enumerate(body):
        if b.get("type") == "h2":
            if not seen_h2 and q:                       # 첫 절 직전 = 들머리 뒤
                out.append(image_html(*q.pop(0)))
            seen_h2 = True; took_in_section = False
            out.append(block_html(b)); continue
        out.append(block_html(b))
        if seen_h2 and not took_in_section and q and b.get("type") != "toc":
            out.append(image_html(*q.pop(0))); took_in_section = True
    if not seen_h2 and q:
        out.append(image_html(*q.pop(0)))
    out += [image_html(*im) for im in q]
    return out


def place_images(body: list[dict], images: dict[str, tuple[str, str | None]]) -> list[str]:
    """본문에 {"type": "image", "key": …} 블록이 있으면 그 자리에 그 사진을 넣는다(사진 없는 키는 건너뛴다)."""
    out: list[str] = []
    for b in body:
        if b.get("type") == "image":
            im = images.get(b.get("key", ""))
            if im:
                out.append(image_html(*im))
            continue
        out.append(block_html(b))
    return out


def render(post: dict, mode: str = "summary", images: list[tuple[str, str | None]] | None = None,
           keyed: dict[str, tuple[str, str | None]] | None = None) -> str:
    url = f"{SITE}/story/{post['slug']}"
    standalone = bool(post.get("standalone"))          # 티스토리 단독 글: jiwon 원문이 없다
    body = post["body"] if (mode == "full" or standalone) else summary_blocks(post["body"])
    parts = [f"<p>{html.escape(post['summary'], quote=False)}</p>"]
    if mode != "full" and not standalone:
        parts.append(f'<p>이 글은 요약입니다. 표와 공고 목록 전체는 <a href="{url}">{BRAND} 원문</a>에 있습니다.</p>')
    if keyed is not None or any(b.get("type") == "image" for b in body):
        parts += place_images(body, keyed or {})
    else:
        parts += weave_images(body, images or [])
    if not standalone:
        parts.append(
            f'<p>원문: <a href="{url}">{html.escape(post["title"], quote=False)}</a> · '
            f'조건에 맞는 지원사업·채용은 <a href="{SITE}">{BRAND}</a>에서 찾습니다.</p>'
        )
    return "\n".join(p for p in parts if p)


def find_existing(t: "Tistory", title: str, slogan: str = "", pages: int = 3) -> str:
    """같은 글이 이미 있으면 그 번호(제목이 같거나 주소가 /entry/<slogan>). 단독 글은 발행 기록 표에 못 남으니 이걸로 중복을 막는다."""
    from urllib.parse import quote, unquote
    want = {quote(slogan), slogan} if slogan else set()
    try:
        for pg in range(1, pages + 1):
            items = t.recent_posts(pg)
            if not items:
                break
            for it in items:
                tail = unquote(it["url"].rstrip("/").rsplit("/", 1)[-1]) if it.get("url") else ""
                if it["title"].strip() == title.strip() or (want and (tail in want or tail.rstrip("-1") in want)):
                    return it["id"]
    except Exception:  # noqa: BLE001
        pass
    return ""


def series_links(t: "Tistory | None", series: list[dict], me: str) -> dict:
    """시리즈 다른 편 중 이미 올라간 것만 링크로(제목·주소로 찾는다). 아직 안 나간 편은 글자로만 둔다."""
    found: dict[str, str] = {}
    if t is not None:
        try:
            from urllib.parse import unquote
            items = t.recent_posts(1) + t.recent_posts(2)
            for s_ in series:
                for it in items:
                    tail = unquote(it.get("url", "").rstrip("/").rsplit("/", 1)[-1])
                    if it["title"].strip() == s_["title"].strip() or (s_.get("slogan") and tail.startswith(s_["slogan"])):
                        found[s_["slogan"]] = it.get("url") or f"/{it['id']}"
                        break
        except Exception:  # noqa: BLE001
            pass
    rows = []
    for s_ in series:
        if s_.get("slogan") == me:
            rows.append(f"**{s_['no']}편 {s_['title']}** (지금 읽는 글)")
        elif s_.get("slogan") in found:
            href = found[s_["slogan"]]
            href = href if href.startswith("http") else f"https://{DEFAULT_HOST}{href}"
            rows.append(f"{s_['no']}편 [{s_['title']}]({href})")
        else:
            rows.append(f"{s_['no']}편 {s_['title']} (곧 공개)")
    return {"type": "list", "items": rows}


# ── 티스토리 관리자 호출 ──────────────────────────────────
def clean_cookie(raw: str) -> str:
    s = raw.strip()
    if s.lower().startswith("cookie:"):
        s = s[len("cookie:"):].strip()
    return " ".join(s.split())    # 줄바꿈·겹친 공백 정리


def cookie_names(cookie: str) -> list[str]:
    """쿠키 헤더에 든 이름만(값은 절대 찍지 않는다). --check 가 TSSESSION 이 들어 있는지 보여 주는 데 쓴다."""
    out: list[str] = []
    for part in cookie.split(";"):
        name = part.strip().split("=", 1)[0].strip()
        if name and name not in out:
            out.append(name)
    return out


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

    def upload_image(self, path: str, caption: str | None = None, alt: str = "") -> tuple[str, str, str | None]:
        """이미지 올리기 → (본문 치환자, attachments 용 ref, 캡션). docs: tistory-mcp api.md §5."""
        with open(path, "rb") as f:
            data = f.read()
        name = os.path.basename(path)
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "gif": "image/gif", "webp": "image/webp"}.get(
            name.rsplit(".", 1)[-1].lower(), "application/octet-stream")
        r = self._req("POST", "/manage/post/attach.json", files={"file": (name, data, mime)})
        text = r.text
        if looks_like_login(text):
            raise SessionExpired("attach.json 이 로그인 화면을 돌려줬다")
        try:
            up = json.loads(text)
        except ValueError as e:
            raise TistoryError(f"attach.json 응답이 JSON 이 아니다: {text[:300]!r}") from e
        ref = attachment_ref(up)
        w, h = png_size(data)
        return image_replacer(ref, w, h, alt=alt or (caption or "")), ref, caption

    def recent_posts(self, page: int = 1) -> list[dict]:
        """관리자 글 목록(`GET /manage/posts.json`) → [{id, title, visibility, url}]. --update 에 쓸 숫자 id 를 여기서 본다."""
        data = self._req("GET", f"/manage/posts.json?category=-3&page={page}&searchKeyword=&searchType=title&visibility=all").json()
        items = data.get("items") or data.get("posts") or data.get("list") or [] if isinstance(data, dict) else data
        out = []
        for it in items or []:
            if isinstance(it, dict) and it.get("id") is not None:
                date = next((str(it[k]) for k in ("published", "publishedDate", "date", "created", "regdate", "modified") if it.get(k)), "")
                out.append({"id": str(it["id"]), "title": str(it.get("title", "")), "visibility": str(it.get("visibility", "")),
                            "url": str(it.get("permalink") or it.get("url") or it.get("entryUrl") or ""), "date": date,
                            "keys": sorted(it)})
        return out

    def post_detail(self, post_id: str) -> dict:
        """관리자 글 하나(`GET /manage/post/{id}.json`). 본문 길이·발행 시각을 보는 데 쓴다."""
        r = self._req("GET", f"/manage/post/{post_id}.json")
        if looks_like_login(r.text):
            raise SessionExpired("post.json 이 로그인 화면을 돌려줬다")
        data = r.json()
        return data.get("post", data) if isinstance(data, dict) else {}

    def publish(self, *, title: str, content: str, category: int, tags: list[str], visibility: str,
                attachments: list[str] | None = None, update_id: str | None = None, slogan: str = "") -> tuple[str, str]:
        """새 글을 올린다. update_id(숫자)를 주면 그 글을 통째로 고쳐 쓴다(PUT /manage/post/{id}.json).
        slogan(문자 주소 슬러그)을 비우면 서버가 제목으로 새로 만든다 — 고쳐 쓸 때는 기존 슬러그를 줘야 주소가 `-1` 로 밀리지 않는다."""
        body = {
            "id": "0", "title": title, "content": content, "slogan": slogan,
            "visibility": VISIBILITY[visibility], "category": int(category),
            "tag": ",".join(t.replace(",", " ") for t in tags[:MAX_TAGS]),
            "published": 1, "password": "", "uselessMarginForEntry": 1,
            "cclCommercial": 0, "cclDerive": 0, "type": "post", "attachments": list(attachments or []),
            "recaptchaValue": "", "draftSequence": None, "totalWritingTimeMs": 0,
        }
        if update_id:
            body["id"] = str(update_id)
            r = self._req("PUT", f"/manage/post/{update_id}.json", json=body)
        else:
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


def attachment_ref(up: dict) -> str:
    """attach.json 응답 → 영구 ref. url 의 query(서명)만 남기고 `kage@{key}/{filename}` 앞에 붙인다. `&` 는 `&amp;`."""
    try:
        url = str(up["url"]); key = str(up["key"]); filename = str(up["filename"])
    except KeyError as e:
        raise TistoryError(f"attach.json 응답에 {e} 가 없다: {json.dumps(up, ensure_ascii=False)[:300]}") from e
    search = url[url.index("?"):] if "?" in url else ""
    return f"kage@{key}/{filename}{search.replace('&', '&amp;')}"


def image_replacer(ref: str, width: int, height: int, style: str = "alignCenter", alt: str = "") -> str:
    if not width or not height:
        style = "widthOrigin"
    m = {"originWidth": width, "originHeight": height, "style": style}
    if alt:
        m["alt"] = alt[:120]                     # 검색엔진이 읽는 대체 글. 티스토리가 모르면 무시한다
    meta = json.dumps(m, separators=(",", ":"), ensure_ascii=False)
    return f"[##_Image|{ref}|CDM|1.3|{meta}_##]"


def png_size(data: bytes) -> tuple[int, int]:
    """PNG 머리(IHDR)에서 가로·세로. PNG 가 아니면 (0, 0)."""
    if data[:8] == b"\x89PNG\r\n\x1a\n" and data[12:16] == b"IHDR":
        return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    return 0, 0


def parse_entry_url(host: str, entry: str, raw: str = "") -> tuple[str, str]:
    """post.json 응답의 entryUrl → (글 id, 글 주소). 다른 도메인이거나 모양이 다르면 실패로 본다.
    블로그 설정이 '숫자 주소'면 `/{n}`, '문자 주소'면 `/entry/{slug}` 로 온다. 둘 다 받는다."""
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
    if m:
        return m.group(1), f"https://{host}/{m.group(1)}"
    m = re.fullmatch(r"/entry/([^/?#]+)/?", path)
    if m:
        from urllib.parse import unquote
        return unquote(m.group(1)), f"https://{host}/entry/{m.group(1)}"
    raise TistoryError(f"entryUrl 모양이 글이 아니다: {entry}")


# ── 글 고르기·기록 ────────────────────────────────────────
def category_for(post: dict) -> int:
    """글의 성격으로 카테고리를 고른다. 자격증 순위 → 일상TIP, 기업지원 순위 → B2G,
    채용·공무원·복지·브리핑(그 밖의 전부) → policy. TISTORY_CATEGORY 나 --category 가 있으면 그쪽이 이긴다."""
    slug = str(post.get("slug") or "")
    if post.get("category") in CATEGORIES:        # 글이 직접 고른 카테고리(예: world_speed.py 의 IT)
        return CATEGORIES[post["category"]]
    if slug.startswith("top10-license-") or post.get("kind") == "license":
        return CATEGORIES["일상TIP"]
    if slug.startswith("top10-biz-"):
        return CATEGORIES["B2G"]
    return CATEGORIES["policy"]


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


COLS = "slug,kind,subject,title,summary,keywords,body,stats,published_at"


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


def recorded_slogan(sb, slug: str) -> str:
    """tistory_posts 에 남은 주소가 `/entry/<슬러그>` 꼴이면 그 슬러그(디코딩). 없거나 숫자 주소면 빈 문자열."""
    from urllib.parse import unquote
    rows = sb.table("tistory_posts").select("url").eq("slug", slug).execute().data or []
    m = re.search(r"/entry/([^/?#]+)", rows[0]["url"]) if rows and rows[0].get("url") else None
    return unquote(m.group(1)) if m else ""


def recorded_post_id(sb, slug: str) -> str:
    """tistory_posts 에 남은 티스토리 글 번호(숫자). 없거나 숫자가 아니면 빈 문자열."""
    rows = sb.table("tistory_posts").select("post_id").eq("slug", slug).execute().data or []
    pid = str(rows[0].get("post_id") or "") if rows else ""
    return pid if pid.isdigit() else ""


def numeric_id_by_title(t: "Tistory", title: str) -> str:
    """방금 올린 글의 숫자 번호를 관리자 글 목록에서 제목으로 찾는다(best-effort)."""
    try:
        for it in t.recent_posts():
            if it["title"].strip() == title.strip():
                return it["id"]
    except Exception:  # noqa: BLE001 — 번호를 못 찾아도 발행은 성공이다
        pass
    return ""


def record(sb, post: dict, post_id: str, url: str, mode: str, visibility: str) -> None:
    sb.table("tistory_posts").upsert({
        "slug": post["slug"], "post_id": post_id, "url": url, "mode": mode, "visibility": visibility,
    }, on_conflict="slug").execute()


# ── main ─────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="쿠키 확인과 카테고리 목록만")
    ap.add_argument("--slug", help="이 글 하나만(이미 올렸어도 다시 올린다)")
    ap.add_argument("--since", type=int, default=1, help="며칠 전 글까지 볼지(기본 1 = 어제·오늘)")
    ap.add_argument("--limit", type=int, default=5, help="한 번에 올릴 최대 편수")
    ap.add_argument("--mode", choices=["summary", "full"], default=os.environ.get("TISTORY_MODE", "summary"))
    ap.add_argument("--visibility", choices=sorted(VISIBILITY), default=os.environ.get("TISTORY_VISIBILITY", "public"))
    ap.add_argument("--category", type=int, default=int(os.environ.get("TISTORY_CATEGORY") or 0),
                    help="카테고리 id. 0(기본)이면 글마다 category_for 가 고른다(정책·B2G·일상TIP)")
    ap.add_argument("--composer", choices=["top10"], help="jiwon 글을 그대로 옮기지 않고 티스토리용 글을 따로 쓴다(출처는 jiwon). top10 = pipeline/tistory_top10.py")
    ap.add_argument("--update", help="새 글 대신 이 티스토리 글 번호(숫자 id)를 고쳐 쓴다. 번호는 --check 가 찍는 최근 글 목록에서")
    ap.add_argument("--post-json", help="blog_posts 대신 이 JSON 파일의 글 하나를 올린다(티스토리 단독 글, 예: world_speed.py 가 만든 out/post.json)")
    ap.add_argument("--images", help="shots/manifest.json — [{\"file\": 경로, \"caption\": 설명}] 순서대로 본문에 끼운다")
    ap.add_argument("--dry", action="store_true", help="올리지 않고 HTML 만 찍는다")
    a = ap.parse_args()
    manifest: list[dict] = []
    if a.images:
        with open(a.images, encoding="utf-8") as f:
            manifest = json.load(f)
        base = os.path.dirname(a.images)
        for m in manifest:
            if not os.path.isabs(m["file"]) and not os.path.exists(m["file"]):
                m["file"] = os.path.join(base, m["file"])

    host = os.environ.get("TISTORY_HOST", DEFAULT_HOST).replace("https://", "").strip("/")
    cookie = clean_cookie(os.environ.get("TISTORY_COOKIE", ""))

    try:
        if a.check:
            if not cookie:
                sys.exit("TISTORY_COOKIE 가 비어 있다")
            names = cookie_names(cookie)
            print(f"쿠키 길이 {len(cookie)}자, 이름 {len(names)}개: " + ", ".join(names))
            if "TSSESSION" not in names:
                print("::warning::쿠키에 TSSESSION 이 없다 — 로그인된 abcfact.tistory.com/manage 요청의 Cookie 값 전체를 넣어야 한다")
            cats = Tistory(host, cookie).categories()
            print(f"쿠키 살아 있음: {host}")
            print("카테고리 id → 이름 (비우면 글마다 고른다: " + ", ".join(f"{k}={v}" for k, v in CATEGORIES.items()) + "):")
            for cid, name in cats:
                print(f"  {cid:>8}  {name}")
            if not cats:
                print("  (카테고리 없음 — 0 으로 올라간다)")
            try:
                t = Tistory(host, cookie)
                recent = t.recent_posts() + t.recent_posts(2)
                if recent:
                    print("글 목록 항목 이름:", ", ".join(recent[0]["keys"]))
                print("최근 글 (id · 공개 · 발행 시각 · 본문 글자 수 · 제목) — --update 에 쓰는 번호:")
                for it in recent[:25]:
                    n = "?"
                    try:
                        d = t.post_detail(it["id"])
                        body = re.sub(r"<[^>]+>|\[##_[^\]]*_##\]", "", str(d.get("content", "")))
                        n = str(len(re.sub(r"\s+", "", body)))
                        it["date"] = it["date"] or str(d.get("published") or d.get("date") or "")
                    except Exception:  # noqa: BLE001
                        pass
                    print(f"  {it['id']:>8}  {it['visibility']:<9} {it['date'][:19]:<19} {n:>6}자  {it['title'][:60]}")
            except Exception as e:  # noqa: BLE001 — 목록은 덤이다. 실패해도 check 는 성공
                print(f"  (최근 글 목록을 못 읽었다: {type(e).__name__}: {e})")
            return 0

        if a.post_json:
            with open(a.post_json, encoding="utf-8") as f:
                posts = [json.load(f)]
            a.slug = posts[0]["slug"]
            posts[0]["standalone"] = True
            a.mode = "full"                  # 단독 글은 원문이 따로 없으니 요약하지 않는다
            try:
                sb = supabase_client()       # 기록(tistory_posts)용. 없어도 올리는 데는 지장 없다
            except Exception as e:  # noqa: BLE001
                print(f"  (Supabase 없이 올린다: {type(e).__name__})"); sb = None
        else:
            sb = supabase_client()
            posts = pick_posts(sb, a.slug, a.since, a.limit)
        if not posts:
            print("올릴 글이 없다(이미 다 올렸거나 기간 안에 쓴 글이 없다)")
            return 0
        if a.composer and not a.post_json:
            # 티스토리용 글을 따로 쓴다. 원문(blog_posts)은 자료·출처로만 쓰고 slug 는 기록용으로 유지한다.
            from tistory_top10 import COMPOSERS      # top10.py 글은 generic, 옛 직무 글은 tistory_top_roles 로 넘긴다
            posts = [COMPOSERS[a.composer](p) for p in posts]
            if a.mode != "full":
                a.mode = "full"          # 작성기가 쓴 글은 요약하지 않는다(요약 안내문도 안 붙는다)

        if a.dry:
            fake = [(f"[이미지 {i+1}: {m['file']}]", m.get("caption")) for i, m in enumerate(manifest)]
            fkeyed = {m["key"]: f for m, f in zip(manifest, fake) if m.get("key")} or None
            for p in posts:
                print(f"\n===== [{p['kind']}] {p['slug']} · {p['title']}  (mode={a.mode}, visibility={a.visibility}, category={a.category or category_for(p)})")
                if p.get("series"):
                    p = {**p, "body": [series_links(None, p["series"], p.get("slogan", "")) if b.get("type") == "series" else b for b in p["body"]]}
                print(render(p, a.mode, fake, fkeyed))
            return 0

        if not cookie:
            sys.exit("TISTORY_COOKIE 가 비어 있다")
        if a.update and (len(posts) != 1 or not a.slug):
            sys.exit("--update 는 --slug 로 글 하나를 집었을 때만 쓴다")
        if a.post_json and not a.update:
            prev = find_existing(Tistory(host, cookie), posts[0]["title"], posts[0].get("slogan", ""))
            if prev:
                a.update = prev
                print(f"같은 글(번호 {prev})이 이미 있어 고쳐 쓴다")
        if a.slug and not a.update and sb is not None:
            prev = recorded_post_id(sb, a.slug)
            if prev:
                a.update = prev          # 같은 글을 두 번 만들지 않는다 — 기존 티스토리 글을 고쳐 쓴다
                print(f"이미 올린 글(번호 {prev})이 있어 고쳐 쓴다")
        t = Tistory(host, cookie)
        n = 0
        for p in posts:
            # 사진은 글마다 다시 올린다(한 업로드를 두 글에 나눠 쓰지 않는다).
            present = [m for m in manifest if os.path.exists(m["file"])]
            uploaded = [t.upload_image(m["file"], m.get("caption"), m.get("alt", "")) for m in present]
            for rep, _ref, _cap in uploaded:
                print(f"  사진 올림: {rep[:60]}…")
            keyed = {m["key"]: (rep, cap) for m, (rep, _r, cap) in zip(present, uploaded) if m.get("key")} if any(m.get("key") for m in present) else None
            if p.get("series"):
                p = {**p, "body": [series_links(t, p["series"], p.get("slogan", "")) if b.get("type") == "series" else b for b in p["body"]]}
            post_id, url = t.publish(title=p["title"], content=render(p, a.mode, [(rep, cap) for rep, _r, cap in uploaded], keyed),
                                     category=a.category or category_for(p), tags=list(p.get("keywords") or []), visibility=a.visibility,
                                     attachments=[ref for _rep, ref, _cap in uploaded], update_id=a.update,
                                     slogan=(recorded_slogan(sb, p["slug"]) if (a.update and sb is not None) else "") or (p.get("slogan", "") if p.get("standalone") else ""))
            num = a.update or numeric_id_by_title(t, p["title"]) or post_id
            if sb is not None:
                try:
                    record(sb, p, num, url, a.mode, a.visibility)
                except Exception as e:  # noqa: BLE001 — 단독 글은 blog_posts 에 없어 외래키에 걸릴 수 있다. 올린 건 유효하다.
                    print(f"  (발행 기록을 못 남겼다 — 다시 올릴 땐 --update {num} 을 쓴다: {type(e).__name__}: {str(e)[:120]})")
            print(f"{'고침' if a.update else '올림'}: {p['slug']} → {url} (번호 {num})")
            n += 1
        print(f"{n}편 올렸다")
        return 0
    except SessionExpired as e:
        print(f"::error::티스토리 쿠키가 만료됐다({e}). 브라우저에서 다시 로그인해 TISTORY_COOKIE 를 갱신한다(README '티스토리' 절).",
              file=sys.stderr)
        return EXIT_EXPIRED


if __name__ == "__main__":
    sys.exit(main())
