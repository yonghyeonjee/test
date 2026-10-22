"""
chart_top10.py — top10.py 가 쓴 글(blog_posts.stats)로 티스토리 글에 넣을 차트 PNG 를 그린다. 주제가 무엇이든 같은 틀.

  shots/overview.png   현황: 월별 막대(채용) 또는 구성 막대(지원사업·자격증)
  shots/item_N.png     N위: 왼쪽 항목 막대(자주 뽑는 기관 / 주로 뽑는 직무 / 많은 분야 / 합격률), 오른쪽 월별·연도별 막대, 위에 핵심 숫자
  shots/top10.png      TOP10 가로 막대
  shots/manifest.json  (shots/open.png 가 있으면 첫 장으로)

  python pipeline/chart_top10.py --slug top10-civil-2026-10
  python pipeline/chart_top10.py --stats stats.json --out shots

그리기 규칙은 chart_top_roles.py 와 같다(dataviz 팔레트, 한 색, 최고 막대만 진하게·값 표시, 눈금 연하게).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import blog_daily as b  # noqa: E402
from chart_top_roles import DPI, H, INK, INK2, W, footer, hbar, month_bars, setup_font, wrap_org  # noqa: E402

OUT = "shots"


def _year_bars(ax, series: list[dict], title: str):
    """연도별(자격증) 막대 — month_bars 와 같은 모양, 라벨은 연도."""
    import numpy as np
    xs = np.arange(len(series))
    ns = [s["n"] for s in series]
    from chart_top_roles import BLUE, BLUE_DARK, GRID, strip
    peak = max(range(len(ns)), key=lambda i: ns[i]) if ns else None
    ax.bar(xs, ns, width=0.5, color=[BLUE_DARK if i == peak else BLUE for i in range(len(ns))], linewidth=0)
    ax.set_xticks(xs, [s["m"][:4] for s in series], fontsize=9)
    ax.set_yticks([]); ax.yaxis.grid(True, color=GRID, linewidth=0.8); ax.set_axisbelow(True)
    strip(ax)
    for x, n in zip(xs, ns):
        ax.annotate(f"{n:,}", (x, n), xytext=(0, 4), textcoords="offset points", ha="center", va="bottom", fontsize=9, color=INK)
    ax.set_title(title, loc="left", fontsize=11, color=INK2, pad=8)


def draw_overview(st: dict, path: str):
    import matplotlib.pyplot as plt
    ov, unit = st["overview"], st["unit"]
    fig, ax = plt.subplots(figsize=(W / DPI, H / DPI), dpi=DPI)
    fig.subplots_adjust(left=0.06, right=0.97, top=0.78, bottom=0.17)
    head = {"keyword": "최근 12개월 공고, 달마다 몇 건이었나", "org": "최근 12개월 공고, 달마다 몇 건이었나", "region": "최근 12개월 공고, 달마다 몇 건이었나",
            "welfare_region": "지금 신청할 수 있는 지원사업은 누구를 위한 것인가", "welfare_topic": "지금 신청할 수 있는 지원사업은 누구를 위한 것인가",
            "license": "국가자격 종목은 어느 등급에 많은가"}[st["entity"]]
    fig.text(0.05, 0.93, head, fontsize=15, weight="bold", color=INK, va="top")
    sub = " · ".join(f.replace("**", "") for f in ov["facts"][:3])
    fig.text(0.05, 0.855, sub[:110], fontsize=10, color=INK2, va="top")
    if ov.get("by_month"):
        month_bars(ax, ov["by_month"])
    elif ov.get("bars", {}).get("items"):
        fig.subplots_adjust(left=0.22)
        hbar(ax, [x["label"] for x in ov["bars"]["items"]], [int(x["n"]) for x in ov["bars"]["items"]], unit=unit)
    footer(fig, ov.get("today", ""))
    fig.savefig(path); plt.close(fig)


def draw_item(rank: int, it: dict, st: dict, path: str):
    import matplotlib.pyplot as plt
    unit = st["unit"]
    fig = plt.figure(figsize=(W / DPI, H / DPI), dpi=DPI)
    gs = fig.add_gridspec(1, 2, width_ratios=[1.0, 1.35], left=0.17, right=0.97, top=0.70, bottom=0.17, wspace=0.30)
    n_label = f"{int(it['n']):,}{unit}"
    fig.text(0.05, 0.93, f"{rank}위 {it['name']} — {'최근 1년 공고' if st['entity'] in ('keyword','org','region') else '사업' if st['entity'].startswith('welfare') else '필기 응시자'} {n_label}",
             fontsize=15, weight="bold", color=INK, va="top")
    sub = " · ".join(f.replace("**", "") for f in it["facts"][1:4])
    fig.text(0.05, 0.855, sub[:105], fontsize=10, color=INK2, va="top")
    ax1 = fig.add_subplot(gs[0, 0])
    bars = it.get("bars", {}).get("items") or []
    if bars:
        u = "%" if "합격률" in it["bars"]["title"] else unit
        hbar(ax1, [wrap_org(x["label"]) for x in bars[:3]], [int(x["n"]) for x in bars[:3]], title=it["bars"]["title"], unit=u)
    else:
        ax1.axis("off"); ax1.text(0, 0.5, "자료 없음", color=INK2)
    ax2 = fig.add_subplot(gs[0, 1])
    series = it.get("by_month") or []
    if series and st["entity"] == "license":
        _year_bars(ax2, series, "연도별 필기 응시자")
    elif series:
        month_bars(ax2, series, title="월별 공고 수", compact=True)
    else:
        # 월별이 없는 항목(지원사업): 신청 가능·상시·현금 막대
        hbar(ax2, ["사업 수", "신청 가능", "상시 접수", "현금 지급"], [int(it["n"]), int(it.get("n_open") or 0), int(it.get("always") or 0), int(it.get("cash") or 0)],
             title="사업 구성", unit=unit)
    footer(fig, st["overview"].get("today", ""))
    fig.savefig(path); plt.close(fig)


def draw_top10(st: dict, path: str):
    import matplotlib.pyplot as plt
    items, unit, ov = st["items"][:10], st["unit"], st["overview"]
    fig, ax = plt.subplots(figsize=(W / DPI, (H + 80) / DPI), dpi=DPI)
    fig.subplots_adjust(left=0.24, right=0.95, top=0.80, bottom=0.08)
    fig.text(0.04, 0.94, f"{st['name']}", fontsize=15, weight="bold", color=INK, va="top")
    total = int(ov.get("n_total") or 0)
    sub = f"전체 {total:,}{unit} 가운데 상위 세 항목이 {b.pct(sum(int(i['n']) for i in items[:3]), total)}%" if total else ""
    fig.text(0.04, 0.875, sub, fontsize=10.5, color=INK2, va="top")
    hbar(ax, [f"{i+1}위 {it['name']}"[:16] for i, it in enumerate(items)], [int(it["n"]) for it in items], unit=unit)
    footer(fig, ov.get("today", ""))
    fig.savefig(path); plt.close(fig)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug")
    ap.add_argument("--stats")
    ap.add_argument("--out", default=OUT)
    a = ap.parse_args()
    if a.stats:
        with open(a.stats, encoding="utf-8") as f:
            st = json.load(f)
    elif a.slug:
        from supabase import create_client
        sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
        rows = sb.table("blog_posts").select("stats").eq("slug", a.slug).execute().data or []
        if not rows or not rows[0].get("stats") or "items" not in rows[0]["stats"]:
            sys.exit(f"{a.slug} 의 stats(items)가 없다 — top10.py 로 쓴 글이어야 한다")
        st = rows[0]["stats"]
    else:
        sys.exit("--slug 또는 --stats")
    setup_font()
    os.makedirs(a.out, exist_ok=True)
    manifest = []
    have = lambda f: os.path.exists(os.path.join(a.out, f))   # noqa: E731 — shot_pages·shot_top10 이 먼저 찍어 둔 화면
    alt = st["name"].replace("TOP10", "").strip()
    if have("open.png"):
        manifest.append({"key": "open", "file": "open.png", "caption": f"지금 접수 중인 공공기관 채용 공고 화면 (출처: {b.BRAND})", "alt": "지금 접수 중인 공공기관 채용 공고 목록 화면"})
    draw_overview(st, os.path.join(a.out, "overview.png"))
    manifest.append({"key": "overview", "file": "overview.png", "caption": f"현황 (출처: {b.BRAND})", "alt": f"{alt} 현황 차트"})
    for i, it in enumerate(st["items"][:10], 1):
        draw_item(i, it, st, os.path.join(a.out, f"item_{i}.png"))
        manifest.append({"key": f"item_{i}", "file": f"item_{i}.png", "caption": f"{i}위 {it['name']} (출처: {b.BRAND})", "alt": f"{alt} {i}위 {it['name']} 차트"})
        if have(f"live_{i}.png"):
            manifest.append({"key": f"live_{i}", "file": f"live_{i}.png", "caption": f"{i}위 {it['name']} — 지금 올라와 있는 공고 목록 화면", "alt": f"{it['name']} 채용 공고 목록 화면"})
    draw_top10(st, os.path.join(a.out, "top10.png"))
    manifest.append({"key": "top10", "file": "top10.png", "caption": f"{st['name']} 비교 (출처: {b.BRAND})", "alt": f"{alt} 순위 비교 차트"})
    from shot_top10 import SITES
    for k, (_u, cap) in SITES.items():
        if have(f"{k}.png"):
            manifest.append({"key": k, "file": f"{k}.png", "caption": cap, "alt": cap.split(" — ")[0] + " 화면"})
    with open(os.path.join(a.out, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f"{len(manifest)}장 → {a.out}/manifest.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
