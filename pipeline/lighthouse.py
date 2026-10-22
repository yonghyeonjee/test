"""러너의 Chrome 으로 Lighthouse 를 직접 돌린다(2026-10-21). PageSpeed API 는 키 없는 호출 한도가 금방 찬다.
    python -u pipeline/lighthouse.py "https://jiwon.knowhow-it.com/,https://jiwon.knowhow-it.com/jobs/306278"
휴대폰(기본)과 PC(--preset=desktop) 둘 다. GitHub ubuntu 러너에는 Chrome 과 Node 가 깔려 있다.
"""
import json
import subprocess
import sys
import tempfile


BLOCK: list[str] = []  # "block=패턴" 인자로 막을 요청(실험용: 글꼴을 막으면 LCP 가 어떻게 되나 등)


def run(url: str, desktop: bool) -> None:
    out = tempfile.mktemp(suffix=".json")
    cmd = ["npx", "-y", "lighthouse@12", url, "--output=json", f"--output-path={out}", "--quiet",
           *[f"--blocked-url-patterns={b}" for b in BLOCK],
           "--chrome-flags=--headless=new --no-sandbox --disable-gpu",
           "--only-categories=performance,accessibility,best-practices,seo"]
    if desktop:
        cmd.append("--preset=desktop")
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if p.returncode != 0:
        print("  ! lighthouse 실패:", (p.stderr or p.stdout)[-400:])
        return
    lh = json.load(open(out))
    cats = lh.get("categories", {})
    au = lh.get("audits", {})
    print("  점수: " + ", ".join(f"{k} {round((v.get('score') or 0) * 100)}" for k, v in cats.items()))
    lab = {k: au[k]["displayValue"] for k in ("first-contentful-paint", "largest-contentful-paint", "total-blocking-time",
                                               "cumulative-layout-shift", "speed-index") if k in au and au[k].get("displayValue")}
    print("  측정: " + ", ".join(f"{k} {v}" for k, v in lab.items()))
    for cat in ("seo", "accessibility", "best-practices"):
        bad = []
        for ref in cats.get(cat, {}).get("auditRefs", []):
            a = au.get(ref["id"], {})
            s = a.get("score")
            if s is not None and s < 1 and a.get("scoreDisplayMode") not in ("notApplicable", "manual", "informative"):
                items = a.get("details", {}).get("items", [])
                hint = ""
                if items:
                    it = items[0]
                    hint = str(it.get("node", {}).get("snippet") or it.get("source") or it.get("url") or "")[:90]
                bad.append(f"{ref['id']}{'(' + (a.get('displayValue') or '') + ')' if a.get('displayValue') else ''}{' ← ' + hint if hint else ''}")
        print(f"  {cat} 미흡: " + ("; ".join(bad) if bad else "없음"))
    opp = []
    for k, a in au.items():
        d = a.get("details", {})
        ms = d.get("overallSavingsMs") or (a.get("numericValue") if d.get("type") == "opportunity" else 0) or 0
        if d.get("type") == "opportunity" and ms >= 300:
            opp.append((ms, f"{k} {ms:.0f}ms"))
    if opp:
        print("  성능 기회: " + ", ".join(s for _, s in sorted(opp, reverse=True)[:6]))
    diag = [f"{k} {au[k]['displayValue']}" for k in ("mainthread-work-breakdown", "bootup-time", "dom-size", "total-byte-weight",
                                                     "unused-javascript", "render-blocking-resources", "largest-contentful-paint-element")
            if k in au and au[k].get("displayValue")]
    if diag:
        print("  진단: " + ", ".join(diag))
    def top(audit: str, n: int, keys: tuple) -> None:
        items = au.get(audit, {}).get("details", {}).get("items", [])
        if not items:
            return
        rows = []
        for it in items[:n]:
            rows.append(" / ".join(str(it.get(k, ""))[:70] for k in keys if it.get(k) not in (None, "")))
        print(f"  {audit}: " + " | ".join(rows))
    # 자리 흔들림(CLS)을 일으킨 요소. LH12 는 layout-shifts, 그 전은 layout-shift-elements.
    for k in ("layout-shifts", "layout-shift-elements"):
        items = au.get(k, {}).get("details", {}).get("items", [])
        if items:
            print(f"  {k}: " + " | ".join(f"{it.get('score', 0):.3f} {str((it.get('node') or {}).get('snippet', ''))[:90]}" for it in items[:5]))
            break
    top("bootup-time", 6, ("url", "total", "scripting"))
    top("third-party-summary", 6, ("entity", "blockingTime", "transferSize", "mainThreadTime"))
    top("render-blocking-resources", 5, ("url", "wastedMs"))
    top("unused-javascript", 5, ("url", "wastedBytes"))
    top("network-requests", 0, ())
    lcp = au.get("largest-contentful-paint-element", {}).get("details", {}).get("items", [])
    if lcp and lcp[0].get("items"):
        print("  LCP 요소: " + str(lcp[0]["items"][0].get("node", {}).get("snippet", ""))[:160])
    # LCP 단계(TTFB·불러오기 지연·불러오기·그리기 지연). 글자면 "그리기 지연"이 거의 전부다.
    if len(lcp) > 1 and lcp[1].get("items"):
        print("  LCP 단계: " + ", ".join(f"{it.get('phase')} {it.get('timing', 0):.0f}ms" for it in lcp[1]["items"]))


arg = sys.argv[1] if len(sys.argv) > 1 else "https://jiwon.knowhow-it.com/"
mobile_only = arg.startswith("mobile,")
items = [x.strip() for x in arg.removeprefix("mobile,").split(",") if x.strip()]
BLOCK[:] = [x[6:] for x in items if x.startswith("block=")]
for u in [x for x in items if not x.startswith("block=")]:
    for desktop in ((False,) if mobile_only else (False, True)):
        print(f"\n== {u} [{'PC' if desktop else '휴대폰'}]")
        try:
            run(u, desktop)
        except Exception as e:  # noqa: BLE001
            print(f"  ! {type(e).__name__}: {e}")
