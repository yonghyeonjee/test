"""
stock_images.py — 글에 넣을 스톡 사진을 위키미디어 공용(CC0·CC BY·CC BY-SA·퍼블릭 도메인, 열쇠 없이 검색)에서 찾아 온다. GitHub 러너에서 돈다(2026-10-20).

  sheets "apartment korea|bank counter"      검색어마다 후보 12장의 미리보기를 한 장(격자)으로 모아 stock/sheets/q1.jpg … 와 stock/index.json
  pick   "q1:3=jeonse-1-cover,q2:7=jeonse-2-bank"   고른 후보를 원본 크기로 받아 1600px 로 줄여 web/public/img/story/<이름>.jpg 로.
                                                    출처(작가·저작권 표시)는 web/public/img/story/credits.json 에 모은다.
"""
import io
import json
import os
import sys
import time

import requests
from PIL import Image, ImageDraw

API = "https://api.openverse.org/v1/images/"
UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com/about; stock)"
OUT = "web/public/img/story"


COMMONS = "https://commons.wikimedia.org/w/api.php"
OK_LIC = ("cc0", "cc-by", "cc by", "public domain", "pd")


def search_openverse(q: str, n: int) -> list[dict]:
    last = None
    for attempt in range(3):
        try:
            r = requests.get(API, params={"q": q, "license": "cc0,by,by-sa", "aspect_ratio": "wide", "size": "large,medium",
                                          "mature": "false", "page_size": n}, headers={"User-Agent": UA}, timeout=90)
            r.raise_for_status()
            return [{"id": x["id"], "title": x.get("title"), "creator": x.get("creator"),
                     "license": f"{x.get('license')} {x.get('license_version') or ''}".strip().upper(),
                     "source": x.get("foreign_landing_url"), "w": x.get("width"), "h": x.get("height"),
                     "thumb": x.get("thumbnail") or x.get("url"), "full": x.get("url"), "from": "openverse"} for x in r.json().get("results", [])]
        except Exception as e:  # noqa: BLE001
            last = e
            print(f"  openverse {attempt + 1}번째 실패: {type(e).__name__}", file=sys.stderr)
            time.sleep(5)
    print(f"  openverse 포기: {last}", file=sys.stderr)
    return []


def search_commons(q: str, n: int) -> list[dict]:
    """위키미디어 공용. 열쇠가 없어도 되고 잘 죽지 않는다. 저작권 표시가 CC0·CC BY·CC BY-SA·퍼블릭 도메인인 사진만."""
    r = requests.get(COMMONS, params={
        "action": "query", "format": "json", "generator": "search", "gsrsearch": f"{q} filetype:bitmap", "gsrnamespace": 6,
        "gsrlimit": n * 3, "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": 400,
    }, headers={"User-Agent": UA}, timeout=60)
    r.raise_for_status()
    out = []
    for pg in (r.json().get("query", {}).get("pages", {}) or {}).values():
        ii = (pg.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata", {}) or {}
        lic = (md.get("LicenseShortName", {}).get("value") or "").strip()
        if not lic or not any(k in lic.lower() for k in OK_LIC):
            continue
        if (ii.get("width") or 0) < 1000 or (ii.get("width") or 0) < (ii.get("height") or 1):
            continue  # 작거나 세로 사진은 머리 그림으로 못 쓴다
        artist = md.get("Artist", {}).get("value") or ""
        artist = " ".join(artist.replace("<", " <").split())  # 태그 섞인 이름을 대충 정리
        import re as _re
        artist = _re.sub(r"<[^>]+>", "", artist).strip()
        out.append({"id": f"commons:{pg['pageid']}", "title": pg.get("title", "").replace("File:", ""), "creator": artist,
                    "license": lic, "source": ii.get("descriptionurl"), "w": ii.get("width"), "h": ii.get("height"),
                    "thumb": ii.get("thumburl"), "full": ii.get("url"), "from": "commons"})
        if len(out) >= n:
            break
    return out


def search(q: str, n: int = 16) -> list[dict]:
    """2026-10-20 Openverse 는 러너에서 자주 끊기고(429·시간 초과) 미리보기 주소도 죽어 있어 위키미디어 공용만 쓴다."""
    return search_commons(q, n)


def fetch(url: str) -> Image.Image | None:
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=60)
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content)).convert("RGB")
    except Exception as e:  # noqa: BLE001
        print(f"  못 받음 {url[:80]}: {type(e).__name__}", file=sys.stderr)
        return None


def sheets(spec: str) -> None:
    os.makedirs("stock/sheets", exist_ok=True)
    index: dict[str, list[dict]] = {}
    for qi, q in enumerate([s.strip() for s in spec.split("|") if s.strip()], 1):
        rows = search(q)
        print(f"q{qi} {q!r}: {len(rows)}장")
        thumbs = []
        for r in rows:
            im = fetch(r["thumb"])
            if im is None:
                continue
            im.thumbnail((400, 300))
            thumbs.append((r, im))
            time.sleep(0.3)
        index[f"q{qi}"] = [{"i": i + 1, **{k: r[k] for k in ("id", "title", "creator", "license", "source", "w", "h", "full", "from")}}
                           for i, (r, _) in enumerate(thumbs)]
        if not thumbs:
            print(f"  q{qi}: 쓸 사진이 없다", file=sys.stderr)
            continue
        cols, cw, ch = 4, 400, 300
        sheet = Image.new("RGB", (cols * cw, ((len(thumbs) + cols - 1) // cols) * ch), "white")
        d = ImageDraw.Draw(sheet)
        for i, (_, im) in enumerate(thumbs):
            x, y = (i % cols) * cw, (i // cols) * ch
            sheet.paste(im, (x + (cw - im.width) // 2, y + (ch - im.height) // 2))
            d.rectangle([x + 4, y + 4, x + 44, y + 30], fill="black")
            d.text((x + 10, y + 8), str(i + 1), fill="white")
        sheet.save(f"stock/sheets/q{qi}.jpg", quality=80)
    json.dump(index, open("stock/index.json", "w"), ensure_ascii=False, indent=1)


def pick(spec: str) -> None:
    os.makedirs(OUT, exist_ok=True)
    index = json.load(open("stock/index.json"))
    credits_path = f"{OUT}/credits.json"
    credits = json.load(open(credits_path)) if os.path.exists(credits_path) else {}
    for item in [s.strip() for s in spec.split(",") if s.strip()]:
        key, name = item.split("=")
        q, i = key.split(":")
        meta = next(m for m in index[q] if m["i"] == int(i))
        im = fetch(meta["full"])
        if im is None:
            continue
        im.thumbnail((1600, 1600))
        im.save(f"{OUT}/{name}.jpg", quality=82, optimize=True)
        credits[name] = {"title": meta["title"], "creator": meta["creator"], "license": meta["license"], "source": meta["source"]}
        print(f"{name}: {im.width}x{im.height} · {meta['creator']} · {meta['license']}")
    json.dump(credits, open(credits_path, "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    mode, arg = sys.argv[1], sys.argv[2]
    sheets(arg) if mode == "sheets" else pick(arg)
