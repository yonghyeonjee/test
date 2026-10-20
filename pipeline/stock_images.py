"""
stock_images.py — 글에 넣을 스톡 사진을 Openverse(CC0·CC BY, 열쇠 없이 검색)에서 찾아 온다. GitHub 러너에서 돈다(2026-10-20).

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


def search(q: str, n: int = 12) -> list[dict]:
    r = requests.get(API, params={"q": q, "license": "cc0,by,by-sa", "aspect_ratio": "wide", "size": "large,medium",
                                  "mature": "false", "page_size": n}, headers={"User-Agent": UA}, timeout=60)
    r.raise_for_status()
    return r.json().get("results", [])


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
            im = fetch(r.get("thumbnail") or r.get("url"))
            if im is None:
                continue
            im.thumbnail((400, 300))
            thumbs.append((r, im))
            time.sleep(0.3)
        index[f"q{qi}"] = [{"i": i + 1, "id": r["id"], "title": r.get("title"), "creator": r.get("creator"),
                            "license": f"{r.get('license')} {r.get('license_version') or ''}".strip(),
                            "source": r.get("foreign_landing_url"), "w": r.get("width"), "h": r.get("height")}
                           for i, (r, _) in enumerate(thumbs)]
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
        r = requests.get(f"{API}{meta['id']}/", headers={"User-Agent": UA}, timeout=60).json()
        im = fetch(r["url"])
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
