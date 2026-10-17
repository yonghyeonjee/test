"""
chart_top_roles.py — "많이 뽑는 직무 TOP10" 글에 넣을 차트 그림(PNG)을 그린다. 티스토리 글의 사진 자리에 쓴다.

같은 틀의 화면 캡처 10장 대신, 직무마다 다른 그림이 되게 자료로 그린다.
  shots/overview.png  최근 12개월 월별 공고 수(현황 절)
  shots/role_N.png    N위 직무: 자주 뽑는 기관(가로 막대) + 월별 공고 수(세로 막대) + 핵심 숫자 한 줄
  shots/top10.png     직무 TOP10 공고 수(가로 막대, 비교 절)
그리고 shots/manifest.json 을 쓴다 — 이미 있는 shots/open.png(접수 중 공고 화면 캡처)가 있으면 첫 장으로 둔다.
tistory_publish.py --images shots/manifest.json 이 들머리 뒤·절마다 첫 블록 뒤에 순서대로 끼운다.

  python pipeline/chart_top_roles.py --slug jobs-top10-roles-2026-10     # DB(blog_posts.stats)에서 읽어 그린다
  python pipeline/chart_top_roles.py --stats stats.json                 # 숫자 JSON({overview, roles})으로

색은 dataviz 기준 팔레트(계열 1 파랑 #2a78d6, 강조 짙은 파랑 #184f95, 글자 #0b0b0b/#52514e, 바탕 #fcfcfb).
한 그림에 한 색(크기 = 한 색의 진하기), 눈금·축은 연하게, 값 표시는 고르듯이(막대 셋은 전부, 월별은 최고 달만).
한글 글꼴은 러너에 fonts-nanum 을 깐다(워크플로). 없으면 설치된 CJK 글꼴을 찾는다.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import blog_daily as b  # noqa: E402
from blog_top_roles import short_org  # noqa: E402

OUT = "shots"
SURFACE, INK, INK2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e6e5e1"
BLUE, BLUE_DARK, BLUE_LIGHT = "#2a78d6", "#184f95", "#9ec5f4"
W, H, DPI = 1200, 640, 150          # 티스토리 본문 폭(약 740px)에 2배로 또렷하게


def setup_font():
    import matplotlib
    matplotlib.use("Agg")
    from matplotlib import font_manager, rcParams
    wanted = ["NanumGothic", "NanumBarunGothic", "Noto Sans CJK KR", "Noto Sans KR", "Malgun Gothic", "AppleGothic", "WenQuanYi Zen Hei", "Unifont-JP"]
    have = {f.name for f in font_manager.fontManager.ttflist}
    for name in wanted:
        if name in have:
            rcParams["font.family"] = name
            break
    else:
        print("한글 글꼴을 못 찾았다 — 글자가 네모로 나올 수 있다(워크플로는 fonts-nanum 을 깐다)", file=sys.stderr)
    rcParams["axes.unicode_minus"] = False
    rcParams.update({"figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
                     "text.color": INK, "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
                     "axes.edgecolor": GRID, "axes.grid": False, "font.size": 11})


def month_label(m: str) -> str:
    y, mm = m.split("-")
    return f"{y[2:]}.{int(mm):02d}"


def strip(ax, left=False, bottom=True):
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    ax.spines["left"].set_visible(left)
    ax.spines["bottom"].set_visible(bottom)
    ax.tick_params(length=0)


def footer(fig, today: str):
    fig.text(0.985, 0.012, f"출처: {b.BRAND} jiwon.knowhow-it.com · {today} 기준 · 공고 건수(채용 인원 아님)",
             ha="right", va="bottom", fontsize=8.5, color=INK2)


def wrap_org(name: str, width: int = 9) -> str:
    """기관명을 두 줄까지. 빈칸에서 끊고, 길면 글자 수로 끊는다."""
    name = short_org(name)
    if len(name) <= width:
        return name
    parts = name.split()
    if len(parts) >= 2 and all(len(x) <= width + 2 for x in parts[:2]):
        return parts[0] + "\n" + " ".join(parts[1:])[:width + 2]
    return name[:width] + "\n" + name[width:width * 2]


def month_bars(ax, months: list[dict], title: str | None = None, label_peak=True, compact=False):
    """세로 막대: 월별 공고 수. 마지막 달은 아직 다 안 셌으니 연하게, 최고 달은 진하게 + 값."""
    import numpy as np
    xs = np.arange(len(months))
    ns = [m["n"] for m in months]
    peak_i = max(range(len(ns) - 1) if len(ns) > 1 else range(len(ns)), key=lambda i: ns[i]) if ns else None
    colors = [BLUE_LIGHT if i == len(ns) - 1 and len(ns) > 1 else (BLUE_DARK if i == peak_i else BLUE) for i in range(len(ns))]
    ax.bar(xs, ns, width=0.62, color=colors, linewidth=0)
    labels = [month_label(m["m"]) for m in months]
    if compact and len(labels) > 7:                     # 좁은 칸에서는 한 칸 걸러 표시
        labels = [l if i % 2 == len(labels) % 2 else "" for i, l in enumerate(labels)]
    ax.set_xticks(xs, labels, fontsize=8 if compact else 8.5)
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.set_yticks([])
    strip(ax)
    if label_peak and peak_i is not None:
        ax.annotate(f"{ns[peak_i]:,}건", (xs[peak_i], ns[peak_i]), xytext=(0, 4), textcoords="offset points",
                    ha="center", va="bottom", fontsize=9.5, color=INK)
    if len(ns) > 1:
        ax.annotate("집계 중" if compact else "이번 달(집계 중)", (xs[-1], ns[-1]), xytext=(0, 4), textcoords="offset points",
                    ha="center", va="bottom", fontsize=7.5, color=INK2)
    if title:
        ax.set_title(title, loc="left", fontsize=11, color=INK2, pad=8)


def hbar(ax, labels: list[str], values: list[int], title: str | None = None, unit="건"):
    """가로 막대: 위에서 아래로 큰 순. 값은 막대 끝에 전부(항목이 적다)."""
    import numpy as np
    ys = np.arange(len(labels))[::-1]
    ax.barh(ys, values, height=0.58, color=BLUE, linewidth=0)
    ax.set_yticks(ys, labels, fontsize=10)
    ax.set_xticks([])
    strip(ax, bottom=False)
    vmax = max(values) if values else 1
    for y, v in zip(ys, values):
        ax.text(v + vmax * 0.015, y, f"{v:,}{unit}", va="center", ha="left", fontsize=9.5, color=INK)
    ax.set_xlim(0, vmax * 1.18)
    if title:
        ax.set_title(title, loc="left", fontsize=11, color=INK2, pad=8)


def draw_overview(ov: dict, path: str):
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(W / DPI, H / DPI), dpi=DPI)
    fig.subplots_adjust(left=0.05, right=0.97, top=0.78, bottom=0.17)
    fig.text(0.05, 0.93, "최근 12개월 공공기관 채용 공고, 달마다 몇 건이었나", fontsize=15, weight="bold", color=INK, va="top")
    fig.text(0.05, 0.855, f"나라일터·잡알리오 공고 {int(ov['n12']):,}건 · 기관 {int(ov['orgs12']):,}곳 · 지금 접수 중 {int(ov['open_now']):,}건",
             fontsize=10.5, color=INK2, va="top")
    month_bars(ax, ov.get("by_month") or [])
    footer(fig, ov.get("today", ""))
    fig.savefig(path)
    plt.close(fig)


def draw_role(rank: int, r: dict, today: str, path: str):
    import matplotlib.pyplot as plt
    fig = plt.figure(figsize=(W / DPI, H / DPI), dpi=DPI)
    gs = fig.add_gridspec(1, 2, width_ratios=[1.0, 1.35], left=0.17, right=0.97, top=0.70, bottom=0.17, wspace=0.30)
    fig.text(0.05, 0.93, f"{rank}위 {r['name']} — 최근 1년 공고 {int(r['n12']):,}건", fontsize=15, weight="bold", color=INK, va="top")
    win = f"접수 기간 중앙값 {int(r['win_med'])}일" if r.get("win_med") is not None else "접수 기간 자료 없음"
    fig.text(0.05, 0.855, f"지금 접수 중 {int(r['n_open']):,}건 · 공고 낸 기관 {int(r['orgs']):,}곳 · 최근 3개월 {int(r['n90']):,}건 · {win}",
             fontsize=10.5, color=INK2, va="top")
    ax1 = fig.add_subplot(gs[0, 0])
    orgs = (r.get("top_orgs") or [])[:3]
    if orgs:
        hbar(ax1, [wrap_org(o["org"]) for o in orgs], [int(o["n"]) for o in orgs], title="자주 뽑는 기관 (공고 수)")
    else:
        ax1.axis("off"); ax1.text(0, 0.5, "기관 자료 없음", color=INK2)
    ax2 = fig.add_subplot(gs[0, 1])
    months = r.get("by_month") or []
    if months:
        month_bars(ax2, months, title="월별 공고 수", compact=True)
    else:
        ax2.axis("off"); ax2.text(0, 0.5, "월별 자료 없음", color=INK2)
    footer(fig, today)
    fig.savefig(path)
    plt.close(fig)


def draw_top10(roles: list[dict], ov: dict, path: str):
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(W / DPI, (H + 80) / DPI), dpi=DPI)
    fig.subplots_adjust(left=0.19, right=0.95, top=0.80, bottom=0.08)
    fig.text(0.04, 0.94, "공고가 많은 직무 TOP10 — 최근 12개월 공고 수", fontsize=15, weight="bold", color=INK, va="top")
    fig.text(0.04, 0.875, f"전체 {int(ov['n12']):,}건 가운데 상위 세 직무가 {b.pct(sum(int(r['n12']) for r in roles[:3]), int(ov['n12']))}%",
             fontsize=10.5, color=INK2, va="top")
    hbar(ax, [f"{i+1}위 {r['name']}" for i, r in enumerate(roles)], [int(r["n12"]) for r in roles])
    footer(fig, ov.get("today", ""))
    fig.savefig(path)
    plt.close(fig)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", help="blog_posts 의 slug(stats 를 읽는다)")
    ap.add_argument("--stats", help="숫자 JSON({overview, roles})")
    ap.add_argument("--out", default=OUT)
    a = ap.parse_args()
    if a.stats:
        with open(a.stats, encoding="utf-8") as f:
            stats = json.load(f)
    elif a.slug:
        from supabase import create_client
        sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
        rows = sb.table("blog_posts").select("stats").eq("slug", a.slug).execute().data or []
        if not rows or not rows[0].get("stats"):
            sys.exit(f"{a.slug} 의 stats 가 없다")
        stats = rows[0]["stats"]
    else:
        sys.exit("--slug 또는 --stats")

    setup_font()
    ov, roles = stats["overview"], sorted(stats["roles"], key=lambda r: -r["n12"])[:10]
    today = ov.get("today", "")
    os.makedirs(a.out, exist_ok=True)
    manifest: list[dict] = []
    hero = os.path.join(a.out, "open.png")
    if os.path.exists(hero):
        manifest.append({"file": "open.png", "caption": f"지금 접수 중인 공공기관 채용 공고 (출처: {b.BRAND})"})
    draw_overview(ov, os.path.join(a.out, "overview.png"))
    manifest.append({"file": "overview.png", "caption": f"최근 12개월 월별 공고 수 (출처: {b.BRAND})"})
    for i, r in enumerate(roles, 1):
        draw_role(i, r, today, os.path.join(a.out, f"role_{i}.png"))
        manifest.append({"file": f"role_{i}.png", "caption": f"{i}위 {r['name']} — 자주 뽑는 기관과 월별 공고 수 (출처: {b.BRAND})"})
    draw_top10(roles, ov, os.path.join(a.out, "top10.png"))
    manifest.append({"file": "top10.png", "caption": f"직무 TOP10 공고 수 비교 (출처: {b.BRAND})"})
    with open(os.path.join(a.out, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f"{len(manifest)}장 → {a.out}/manifest.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
