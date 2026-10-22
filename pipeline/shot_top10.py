"""
shot_top10.py — TOP10 글(blog_posts.stats)의 항목마다 실제 화면을 찍는다. chart_top10.py 보다 먼저 돈다.

  shots/live_N.png   N위 항목의 지금 공고 목록 쪽(항목의 link — /jobs/q/…·/jobs/org/…·/jobs/region/…)
  shots/gojobs.png   나라일터 첫 화면(원 자료)
  shots/alio.png     잡알리오 첫 화면(원 자료)

  python -u pipeline/shot_top10.py --slug top10-civil-2026-10
그다음 chart_top10.py 가 이 사진들을 manifest 에 key 와 함께 넣고, tistory_top10.compose 가 절마다 자리를 잡는다.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
SITES = {"gojobs": ("https://www.gojobs.go.kr", "인사혁신처 나라일터 — 국가·지자체 채용 공고 원 자료 (gojobs.go.kr)"),
         "alio": ("https://job.alio.go.kr", "잡알리오 공공기관 채용정보시스템 — 공공기관 채용 공고 원 자료 (job.alio.go.kr)"),
         "bokjiro": ("https://www.bokjiro.go.kr", "보건복지부 복지로 — 복지 서비스 원 자료 (bokjiro.go.kr)"),
         "bizinfo": ("https://www.bizinfo.go.kr", "기업마당 — 기업 지원사업 원 자료 (bizinfo.go.kr)"),
         "qnet": ("https://www.q-net.or.kr", "한국산업인력공단 큐넷 — 국가자격 시험 원 자료 (q-net.or.kr)")}


def specs(st: dict) -> list[str]:
    out = []
    for i, it in enumerate(st["items"][:10], 1):
        link = (it.get("link") or "").strip()
        if link:
            out.append(f"{link}|live_{i}|{i}위 {it['name']} — 지금 올라와 있는 공고 목록 화면|")
    from tistory_top10 import WRAP_SHOTS
    for k in WRAP_SHOTS.get(st.get("entity"), []):
        u, c = SITES[k]
        out.append(f"{u}|{k}|{c}|")
    return [s.replace(",", " ") for s in out]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug")
    ap.add_argument("--stats")
    a = ap.parse_args()
    if a.stats:
        st = json.load(open(a.stats, encoding="utf-8"))
    else:
        from supabase import create_client
        sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
        rows = sb.table("blog_posts").select("stats").eq("slug", a.slug).execute().data or []
        st = (rows[0].get("stats") if rows else None) or {}
    if "items" not in st:
        print("stats.items 가 없어 화면을 찍지 않는다"); return 0
    sp = specs(st)
    print(f"화면 {len(sp)}장 찍는다")
    return subprocess.run([sys.executable, "-u", str(HERE / "shot_pages.py"), ", ".join(sp)]).returncode


if __name__ == "__main__":
    sys.exit(main())
