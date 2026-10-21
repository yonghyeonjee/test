"""AI 활용 시리즈 — 티스토리 단독 글(글·차트·공식 사이트 화면). 데이터는 pipeline/data/ai_series/<slug>.json 한 파일.

    python -u pipeline/ai_series.py --slug vibe-coding-top10            # out/post.json + shots/*.png + shots/manifest.json
    python -u pipeline/ai_series.py --slug vibe-coding-top10 --no-shots # 차트만(샌드박스 시험용 — 바깥 사이트에 못 닿는다)
    python -u pipeline/ai_series.py --pick --date 2026-10-22             # 그날 낼 slug (plan.json)
    python -u pipeline/ai_series.py --check                              # 모든 글 JSON 검사(SEO·링크·사진 규칙)

글 JSON: {slug, slogan, title, summary, keywords[], body[블록], charts[], shots[], sources[]}
  블록: p · h2 · h3 · list · table · note · image{key} · series (시리즈 목록, 발행 때 링크로 바뀐다)
  charts: {key, kind: hero|hbar|pair|price|matrix|card, …, caption, alt, file}
  shots:  {key, url, caption, alt, file, fallback{title, lines[]}} — 러너 브라우저로 첫 화면(1280×800)을 찍는다.
          봇 차단(403·Just a moment)이면 fallback 정보 카드를 대신 그린다.
숫자는 글 JSON 에 적힌 것(출처 sources 에 있는 공개 자료)만 쓴다. 여기서 지어내지 않는다.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import textwrap
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

DATA = Path(__file__).parent / "data" / "ai_series"
OUT = "shots"
SERIES_NAME = "AI 활용 시리즈"
BLOG = "abcfact.tistory.com"

DISMISS_JS = """() => {
  const words = ['accept all','accept all cookies','accept','agree','i agree','got it','allow all','ok','동의','모두 허용','모든 쿠키 허용','모두 수락','수락','모두 거부','확인','닫기','close','no thanks','reject all','decline'];
  for (const b of document.querySelectorAll('button')) {           // 링크(a)는 누르지 않는다 — 다른 쪽으로 가 버린다
    const t = (b.innerText || '').trim().toLowerCase();
    if (t && t.length < 25 && words.includes(t)) { try { b.click(); } catch (e) {} }
  }
  for (const e of document.querySelectorAll('body *')) {             // 화면을 덮는 고정 배너(쿠키·뉴스레터·채팅)를 숨긴다
    const s = getComputedStyle(e);
    if (s.position === 'fixed' && /cookie|쿠키|개인정보|consent/i.test(e.innerText || '') && (e.innerText || '').length < 600) { e.style.display = 'none'; continue; }
    if ((s.position === 'fixed' || s.position === 'sticky') && parseInt(s.zIndex || '0') >= 100) {
      const r = e.getBoundingClientRect();
      if (r.top > 120 && r.height > 40) e.style.display = 'none';
      else if (r.height > innerHeight * 0.5 && r.width > innerWidth * 0.5) e.style.display = 'none';
    }
  }
}"""


def load(slug: str) -> dict:
    p = next((x for x in sorted(DATA.glob("*.json")) if x.stem.split("-", 1)[-1] == slug or x.stem == slug), None)
    if p is None:
        raise SystemExit(f"{slug}: pipeline/data/ai_series 에 없다")
    return json.loads(p.read_text(encoding="utf-8"))


def plan() -> list[dict]:
    return json.loads((DATA / "plan.json").read_text(encoding="utf-8"))


def series_index() -> list[dict]:
    """시리즈 목록(번호·제목·주소 슬러그). 아직 글 파일이 없는 편은 기획표의 제목을 쓴다."""
    out = []
    for e in plan():
        try:
            d = load(e["slug"])
            out.append({"no": e["no"], "title": d["title"], "slogan": d.get("slogan", "")})
        except SystemExit:
            out.append({"no": e["no"], "title": e["title"], "slogan": e["slogan"]})
    return out


# ---------- 차트 ----------
def _fig():
    from chart_top_roles import setup_font, W, H, DPI
    setup_font()
    import matplotlib.pyplot as plt
    return plt, W, H, DPI


def _foot(fig, text):
    from chart_top_roles import INK2
    fig.text(0.985, 0.014, text, ha="right", va="bottom", fontsize=8.5, color=INK2)


def _head(fig, title, sub=""):
    from chart_top_roles import INK, INK2
    fig.text(0.05, 0.93, title, fontsize=15, weight="bold", color=INK, va="top")
    if sub:
        fig.text(0.05, 0.86, sub, fontsize=10, color=INK2, va="top")


def draw(spec: dict, path: str) -> None:
    from chart_top_roles import strip, BLUE, BLUE_DARK, BLUE_LIGHT, INK, INK2, GRID, SURFACE
    plt, W, H, DPI = _fig()
    import numpy as np
    k = spec["kind"]
    if k == "hero":
        fig = plt.figure(figsize=(W / DPI, H / DPI), dpi=DPI)
        fig.patch.set_facecolor(BLUE_DARK)
        fig.text(0.06, 0.80, spec.get("kicker", SERIES_NAME), fontsize=13, color=BLUE_LIGHT, weight="bold")
        lines = textwrap.wrap(spec["title"], 18)
        for i, ln in enumerate(lines[:3]):
            fig.text(0.06, 0.62 - i * 0.13, ln, fontsize=30, color="white", weight="bold")
        fig.text(0.06, 0.12, spec.get("sub", ""), fontsize=12, color="#dbe8fb")
        fig.text(0.94, 0.12, spec.get("date", ""), fontsize=11, color="#dbe8fb", ha="right")
        fig.savefig(path, facecolor=fig.get_facecolor()); plt.close(fig); return
    if k == "card":                                  # 화면을 못 찍은 사이트 대신 쓰는 정보 카드
        fig = plt.figure(figsize=(W / DPI, H / DPI), dpi=DPI)
        fig.text(0.07, 0.80, spec["title"], fontsize=26, weight="bold", color=INK)
        if spec.get("url"):
            fig.text(0.07, 0.71, spec["url"], fontsize=12, color=BLUE)
        for i, ln in enumerate(spec.get("lines", [])[:6]):
            fig.text(0.07, 0.58 - i * 0.085, "· " + ln, fontsize=13, color=INK2)
        fig.add_artist(plt.Rectangle((0.04, 0.08), 0.92, 0.84, fill=False, edgecolor=GRID, linewidth=1.5, transform=fig.transFigure))
        _foot(fig, spec.get("source", ""))
        fig.savefig(path); plt.close(fig); return
    if k in ("hbar", "price"):
        labels, vals = spec["labels"], spec["values"]
        hl = set(spec.get("highlight", []))
        fig, ax = plt.subplots(figsize=(W / DPI, H / DPI), dpi=DPI)
        fig.subplots_adjust(left=spec.get("left", 0.24), right=0.95, top=0.79, bottom=0.1)
        _head(fig, spec["title"], spec.get("sub", ""))
        ys = np.arange(len(labels))[::-1]
        ax.barh(ys, vals, height=0.62, color=[BLUE_DARK if i in hl else BLUE for i in range(len(vals))], linewidth=0)
        ax.set_yticks(ys, labels, fontsize=10); ax.set_xticks([]); strip(ax, bottom=False)
        vmax = max(vals) or 1
        fmt = spec.get("fmt", "{:,}")
        for y, v, t in zip(ys, vals, spec.get("value_labels") or [fmt.format(v) for v in vals]):
            ax.text(v + vmax * 0.012, y, t, va="center", fontsize=9.5, color=INK)
        ax.set_xlim(0, vmax * 1.2)
        _foot(fig, spec.get("source", ""))
        fig.savefig(path); plt.close(fig); return
    if k == "dot":                                   # 점수처럼 0 에서 시작하면 차이가 안 보이는 값: 점 그림
        labels, vals = spec["labels"], spec["values"]
        hl = set(spec.get("highlight", []))
        fig, ax = plt.subplots(figsize=(W / DPI, H / DPI), dpi=DPI)
        fig.subplots_adjust(left=spec.get("left", 0.3), right=0.95, top=0.79, bottom=0.14)
        _head(fig, spec["title"], spec.get("sub", ""))
        ys = np.arange(len(labels))[::-1]
        lo, hi = spec["xmin"], spec.get("xmax", max(vals) + (max(vals) - spec["xmin"]) * 0.15)
        for y, v, i in zip(ys, vals, range(len(vals))):
            c = BLUE_DARK if i in hl else BLUE
            ax.hlines(y, lo, v, color=GRID, linewidth=1.2)
            ax.plot([v], [y], "o", color=c, markersize=9)
            ax.text(v + (hi - lo) * 0.015, y, f"{v:,}", va="center", fontsize=9.5, color=INK)
        ax.set_yticks(ys, labels, fontsize=10); ax.set_xlim(lo, hi)
        ax.tick_params(axis="x", labelsize=9, colors=INK2); strip(ax, bottom=True)
        _foot(fig, spec.get("source", ""))
        fig.savefig(path); plt.close(fig); return
    if k == "pair":                                  # 두 시점·두 계열 묶음 막대
        cats, a, b_ = spec["labels"], spec["a"], spec["b"]
        fig, ax = plt.subplots(figsize=(W / DPI, H / DPI), dpi=DPI)
        fig.subplots_adjust(left=0.06, right=0.97, top=0.78, bottom=0.16)
        _head(fig, spec["title"], spec.get("sub", ""))
        xs = np.arange(len(cats)); w = 0.36
        ax.bar(xs - w / 2, a, w, color=BLUE_LIGHT, label=spec["a_label"], linewidth=0)
        ax.bar(xs + w / 2, b_, w, color=BLUE_DARK, label=spec["b_label"], linewidth=0)
        ax.set_xticks(xs, cats, fontsize=10); ax.set_yticks([]); strip(ax)
        for x, v in zip(xs, a):
            ax.annotate(f"{v:,}", (x - w / 2, v), xytext=(0, 3), textcoords="offset points", ha="center", fontsize=9, color=INK2)
        for x, v in zip(xs, b_):
            ax.annotate(f"{v:,}", (x + w / 2, v), xytext=(0, 3), textcoords="offset points", ha="center", fontsize=9, color=INK)
        ax.legend(frameon=False, fontsize=9, loc="upper right"); ax.set_ylim(0, max(a + b_) * 1.2)
        _foot(fig, spec.get("source", ""))
        fig.savefig(path); plt.close(fig); return
    if k == "matrix":                                # 표 그림(역할 비교 등)
        rows, cols, cells = spec["rows"], spec["cols"], spec["cells"]
        fig = plt.figure(figsize=(W / DPI, H / DPI), dpi=DPI)
        _head(fig, spec["title"], spec.get("sub", ""))
        top, left = 0.78, 0.05
        cw = (0.95 - 0.27) / len(cols); rh = min(0.09, 0.66 / (len(rows) + 1))
        for j, c in enumerate(cols):
            fig.text(0.27 + cw * j + cw / 2, top, c, ha="center", va="center", fontsize=11, weight="bold", color=INK)
        for i, r in enumerate(rows):
            y = top - rh * (i + 1)
            fig.add_artist(plt.Rectangle((left, y - rh / 2), 0.9, rh, color=SURFACE if i % 2 else "#f1f0ec", transform=fig.transFigure, zorder=0))
            fig.text(left + 0.01, y, r, ha="left", va="center", fontsize=10, color=INK2)
            for j, c in enumerate(cols):
                v = cells[i][j]
                fig.text(0.27 + cw * j + cw / 2, y, v, ha="center", va="center", fontsize=10,
                         color=BLUE_DARK if v.startswith("◎") else INK, weight="bold" if v.startswith("◎") else "normal")
        _foot(fig, spec.get("source", ""))
        fig.savefig(path); plt.close(fig); return
    raise SystemExit(f"모르는 차트 {k}")


# ---------- 화면 사진 ----------
def take_shots(shots: list[dict]) -> dict[str, bool]:
    """러너에서만. 키마다 찍었으면 True. 봇 차단이면 False(정보 카드로 대신)."""
    import subprocess
    ok: dict[str, bool] = {}
    if not shots:
        return ok
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "playwright"], check=True)
    chrome = next((c for c in ("/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium") if os.path.exists(c)), None)
    if not chrome:
        subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
    from playwright.sync_api import sync_playwright  # noqa: PLC0415
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
    with sync_playwright() as p:
        br = p.chromium.launch(executable_path=chrome) if chrome else p.chromium.launch()
        for s in shots:
            path = f"{OUT}/{s['file']}"
            try:
                ctx = br.new_context(viewport={"width": 1280, "height": 800}, locale=s.get("locale", "ko-KR"), user_agent=ua)
                page = ctx.new_page()
                r = page.goto(s["url"], wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(5000)
                title = page.title()
                blocked = (r is not None and r.status >= 400) or "just a moment" in title.lower() or "attention required" in title.lower() \
                    or "access denied" in title.lower() or "404" in title or "not found" in title.lower() or "페이지를 찾을 수 없" in title
                if not blocked:
                    page.evaluate(DISMISS_JS); page.wait_for_timeout(1200)
                    if s.get("scroll"):
                        page.mouse.wheel(0, int(s["scroll"])); page.wait_for_timeout(1200)
                    host0 = re.sub(r"^www\.", "", s["url"].split("/")[2])
                    if host0 not in page.url:                     # 배너를 닫다가 다른 사이트로 넘어갔다
                        page.goto(s["url"], wait_until="domcontentloaded", timeout=60000); page.wait_for_timeout(4000)
                    page.screenshot(path=path)
                    if os.environ.get("SHOT_PREVIEW"):              # 확인용: 작게 JPEG 로 기록에 찍는다
                        import base64
                        jpg = page.screenshot(type="jpeg", quality=30)
                        b = base64.b64encode(jpg).decode()
                        print(f"--B64 {s['key']}--"); print("\n".join(b[i:i + 200] for i in range(0, len(b), 200))); print("--END--")
                ok[s["key"]] = not blocked
                print(f"  화면 {'찍음' if not blocked else '막힘'}: {s['url']} → {page.url} ({title[:60]})")
                ctx.close()
            except Exception as e:  # noqa: BLE001
                ok[s["key"]] = False
                print(f"  화면 실패: {s['url']}: {type(e).__name__}: {str(e)[:120]}")
        br.close()
    return ok


# ---------- 검사 ----------
LINK = re.compile(r"\]\((https?://[^)]+)\)")


def check(post: dict) -> list[str]:
    """SEO·링크·사진 규칙. 위반 목록(비면 통과)."""
    errs = []
    t = post["title"]
    if not (20 <= len(t) <= 70):
        errs.append(f"제목 길이 {len(t)}(20~70)")
    if len(post.get("keywords", [])) < 5:
        errs.append("태그 5개 이상")
    if not post.get("slogan") or re.search(r"[^\w가-힣\-]", post["slogan"]):
        errs.append("slogan(짧은 주소) 필요: 한글·영문·숫자·하이픈만")
    body = post["body"]
    text = json.dumps(body, ensure_ascii=False)
    h2 = [b for b in body if b["type"] == "h2"]
    if len(h2) < 4:
        errs.append("h2 4개 이상")
    keys = {b["key"] for b in body if b["type"] == "image"}
    have = {c["key"] for c in post.get("charts", [])} | {s["key"] for s in post.get("shots", [])}
    if keys - have:
        errs.append(f"그림 정의 없음: {sorted(keys - have)}")
    if len(post.get("shots", [])) < 2:
        errs.append("공식 사이트 화면 2장 이상")
    if not any(c["kind"] == "hero" for c in post.get("charts", [])):
        errs.append("머리 그림(hero) 필요")
    for c in post.get("charts", []) + post.get("shots", []):
        if not c.get("alt") or not re.match(r"^[a-z0-9\-]+\.png$", c.get("file", "")):
            errs.append(f"{c.get('key')}: alt 와 영문 파일 이름(.png) 필요")
    hosts = [re.sub(r"^www\.", "", u.split("/")[2]) for u in LINK.findall(text)]
    from collections import Counter
    cnt = Counter(hosts)
    if cnt and cnt.most_common(1)[0][1] > max(3, len(hosts) // 3):
        errs.append(f"바깥 링크가 한 도메인에 몰림: {cnt.most_common(3)}")
    if cnt.get("jiwon.knowhow-it.com", 0) > 1:
        errs.append("jiwon 링크는 1개 이하")
    if len(set(hosts)) < 4:
        errs.append(f"바깥 링크 도메인 4곳 이상(지금 {len(set(hosts))})")
    if not any(b["type"] == "series" for b in body):
        errs.append("시리즈 목록 블록 필요")
    first = post["summary"]
    if not any(k.split()[0] in first for k in post["keywords"][:3]):
        errs.append("요약 첫 문단에 핵심 키워드")
    return errs


def build(slug: str, shots: bool = True) -> dict:
    post = load(slug)
    os.makedirs(OUT, exist_ok=True)
    man: list[dict] = []
    for c in post.get("charts", []):
        draw(c, f"{OUT}/{c['file']}")
        man.append({"key": c["key"], "file": c["file"], "caption": c.get("caption", ""), "alt": c.get("alt", "")})
    got = take_shots(post.get("shots", [])) if shots else {}
    for s in post.get("shots", []):
        if not got.get(s["key"]):
            fb = s.get("fallback") or {}
            draw({"kind": "card", "title": fb.get("title", s.get("name", "")), "url": s["url"], "lines": fb.get("lines", []),
                  "source": f"공식 사이트 {s['url']} 기준 정리"}, f"{OUT}/{s['file']}")
            cap = fb.get("caption") or s.get("caption", "")
        else:
            cap = s.get("caption", "")
        man.append({"key": s["key"], "file": s["file"], "caption": cap, "alt": s.get("alt", "")})
    # 본문 순서대로 사진을 올리도록 매니페스트를 정렬
    order = [b["key"] for b in post["body"] if b["type"] == "image"]
    man.sort(key=lambda m: order.index(m["key"]) if m["key"] in order else 999)
    with open(f"{OUT}/manifest.json", "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
    out = {k: post[k] for k in ("slug", "slogan", "title", "summary", "keywords", "body")}
    out.update({"kind": "ai", "category": "IT", "standalone": True, "series": series_index()})
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug")
    ap.add_argument("--pick", action="store_true")
    ap.add_argument("--date")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--no-shots", action="store_true")
    ap.add_argument("--out", default="out/post.json")
    a = ap.parse_args()
    if a.pick:
        d = a.date or (dt.datetime.utcnow() + dt.timedelta(hours=9)).date().isoformat()
        hit = next((e for e in plan() if e["date"] == d), None)
        print(hit["slug"] if hit else "")
        return 0
    if a.check:
        bad = 0
        for e in plan():
            try:
                errs = check(load(e["slug"]))
            except SystemExit as ex:
                errs = [str(ex)]
            print(f"{e['no']:>2} {e['slug']}: {'통과' if not errs else '; '.join(errs)}")
            bad += bool(errs)
        return 1 if bad else 0
    if not a.slug:
        raise SystemExit("--slug 가 필요하다")
    errs = check(load(a.slug))
    if errs:
        raise SystemExit(f"{a.slug}: 규칙 위반 — " + "; ".join(errs))
    post = build(a.slug, shots=not a.no_shots)
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(post, f, ensure_ascii=False, indent=1)
    print(f"{post['slug']}: {post['title']}\nSLUG={post['slug']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
