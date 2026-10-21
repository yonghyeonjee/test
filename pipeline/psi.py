"""구글 PageSpeed Insights(Lighthouse)로 휴대폰 기준 점수와 SEO·모바일 감사 결과를 찍는다(2026-10-21).
    python -u pipeline/psi.py "https://jiwon.knowhow-it.com/,https://jiwon.knowhow-it.com/jobs/304285"
키 없이도 돈다(분당 몇 번). PSI_KEY 환경변수가 있으면 붙인다(출력에는 안 찍는다).
"""
import os
import sys

import requests

API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"


def run(url: str, strategy: str) -> None:
    params = {"url": url, "strategy": strategy, "category": ["performance", "accessibility", "best-practices", "seo"]}
    key = os.environ.get("PSI_KEY", "").strip()
    if key:
        params["key"] = key
    r = requests.get(API, params=params, timeout=120)
    if r.status_code != 200:
        print(f"  ! {r.status_code} {r.text[:200]}")
        return
    j = r.json()
    lh = j.get("lighthouseResult", {})
    cats = lh.get("categories", {})
    print("  점수: " + ", ".join(f"{k} {round((v.get('score') or 0) * 100)}" for k, v in cats.items()))
    au = lh.get("audits", {})
    lab = {k: au[k]["displayValue"] for k in ("first-contentful-paint", "largest-contentful-paint", "total-blocking-time",
                                               "cumulative-layout-shift", "speed-index") if k in au}
    print("  실험실: " + ", ".join(f"{k} {v}" for k, v in lab.items()))
    le = j.get("loadingExperience", {})
    if le.get("metrics"):
        print(f"  실사용({le.get('overall_category')}): " + ", ".join(
            f"{k} {v.get('percentile')}({v.get('category')})" for k, v in le["metrics"].items()))
    else:
        print("  실사용 자료 없음(방문이 적어 CrUX 에 안 잡힘)")
    for cat in ("seo", "accessibility", "best-practices"):
        refs = cats.get(cat, {}).get("auditRefs", [])
        bad = []
        for ref in refs:
            a = au.get(ref["id"], {})
            s = a.get("score")
            if s is not None and s < 1 and a.get("scoreDisplayMode") not in ("notApplicable", "manual", "informative"):
                bad.append(f"{ref['id']}({a.get('displayValue') or ''})")
        print(f"  {cat} 미흡: " + (", ".join(bad) if bad else "없음"))
    opp = []
    for k, a in au.items():
        if a.get("details", {}).get("type") == "opportunity" and (a.get("details", {}).get("overallSavingsMs") or 0) >= 300:
            opp.append(f"{k} {a['details']['overallSavingsMs']:.0f}ms")
    if opp:
        print("  성능 기회: " + ", ".join(sorted(opp, key=lambda s: -float(s.split()[-1][:-2]))[:6]))
    diag = []
    for k in ("mainthread-work-breakdown", "bootup-time", "dom-size", "total-byte-weight", "unused-javascript", "render-blocking-resources"):
        if k in au and au[k].get("displayValue"):
            diag.append(f"{k} {au[k]['displayValue']}")
    if diag:
        print("  진단: " + ", ".join(diag))


for u in [x.strip() for x in (sys.argv[1] if len(sys.argv) > 1 else "https://jiwon.knowhow-it.com/").split(",") if x.strip()]:
    for st in ("mobile", "desktop"):
        print(f"\n== {u} [{st}]")
        try:
            run(u, st)
        except Exception as e:  # noqa: BLE001
            print(f"  ! {type(e).__name__}: {e}")
