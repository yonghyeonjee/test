"""
home_loan_rates.py — 주택금융공사 누리집의 보금자리론·디딤돌대출 금리표를 읽어 site_settings 에 넣는다.

    python pipeline/home_loan_rates.py            # 받아서 저장
    python pipeline/home_loan_rates.py --dry      # 받아서 찍기만

공공데이터포털에는 이 금리의 살아 있는 API 가 없다(u-보금자리론 API 는 키 등록이
막혀 있고 상품도 바뀌었다). 누리집 금리안내 쪽은 서버가 표를 그대로 그려 주고
robots.txt 도 막지 않으므로, 한 달에 한 번 바뀌는 표를 하루 한 번 읽는다.

  보금자리론  https://www.hf.go.kr/ko/sub01/sub01_01_04.do  (상품×만기, 우대금리)
  디딤돌      https://www.hf.go.kr/ko/sub01/sub01_02_03.do  (소득구간×만기, 생애최초 신혼 표)

표를 하나도 못 읽으면 저장하지 않고 실패로 끝낸다 — 빈 표를 덮어쓰는 것보다
지난달 표가 낫다.
"""

import html as htmlmod
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

import requests

BOGEUM = "https://www.hf.go.kr/ko/sub01/sub01_01_04.do"
DIDIM = "https://www.hf.go.kr/ko/sub01/sub01_02_03.do"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0 Safari/537.36 narajiwon-collect/1.0 (+https://jiwon.knowhow-it.com)")
KEY = "home_loan_rates"


def text(html: str) -> str:
    """탐침과 같은 정리. 표 칸은 ' | ' 로, 줄은 줄바꿈으로."""
    html = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?i)</(tr|p|div|li|h\d|table)>", "\n", html)
    html = re.sub(r"(?i)</t[dh]>", " | ", html)
    html = re.sub(r"<[^>]+>", " ", html)
    html = htmlmod.unescape(html).replace("\xa0", " ")
    html = re.sub(r"[ \t]+", " ", html)
    html = re.sub(r"\n\s*\n+", "\n", html)
    return "\n".join(l.strip() for l in html.split("\n")).strip()


def tokens(seg: str):
    """줄 단위 토큰. '|' 만 있는 줄과 '체크' 는 버리고 끝의 ' |' 는 뗀다."""
    out = []
    for l in seg.split("\n"):
        l = l.strip()
        if not l or l == "|" or l == "체크":
            continue
        out.append(l[:-1].strip() if l.endswith("|") else l)
    return out


NUM = re.compile(r"^\d+(?:\.\d+)?$")
TERM = re.compile(r"^\d+년$")
PCT = re.compile(r"^([\d.]+)%p$")


def notice_date(t: str):
    m = re.search(r"공시일\s*:\s*(\d{4})년\s*(\d{2})월\s*(\d{2})일", t)
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def parse_bogeumjari(t: str) -> dict:
    t = htmlmod.unescape(t)
    m = re.search(r"(\d{4})년\s*(\d{1,2})월\s*\n?\s*u-보금자리론", t)
    month = f"{m.group(1)}-{int(m.group(2)):02d}" if m else None
    toks = tokens(t)
    terms, rows = [], []
    i = toks.index("상품별/만기") if "상품별/만기" in toks else -1
    if i >= 0:
        j = i + 1
        while j < len(toks) and TERM.match(toks[j]):
            terms.append(toks[j]); j += 1
        while j < len(toks) and not toks[j].startswith("※"):
            name = toks[j]; j += 1
            vals = []
            while j < len(toks) and NUM.match(toks[j]):
                vals.append(float(toks[j])); j += 1
            if vals and len(vals) == len(terms):
                rows.append({"name": name, "rates": vals})
            elif not vals:
                break
    notes = [l.strip() for l in t.split("\n") if l.strip().startswith("※")][:4]

    # 우대금리: '우대금리' 표 머리 다음부터 '가산금리' 전까지, '0.3%p' 로 묶음이 끝난다
    prefs, extras = [], []
    CATS = {"저출생 해소 지원층", "사회적 배려층"}
    hi = toks.index("우대금리") + 1 if "우대금리" in toks else -1
    # 표 머리 '우대항목','우대요건','우대금리' 를 건너뛴다
    while hi >= 0 and hi < len(toks) and toks[hi] in ("우대항목", "우대요건", "우대금리"):
        hi += 1
    if hi > 0:
        group, target = [], prefs
        for tok in toks[hi:]:
            if tok.startswith("가산금리"):
                target, group = extras, []
                continue
            if tok.startswith("각 항목별") or tok.startswith("우대요건을"):
                break
            pm = PCT.match(tok)
            if pm:
                g = [x for x in group if x not in CATS]
                if g:
                    target.append({"item": g[0], "cond": " ".join(g[1:])[:300], "pct": float(pm.group(1))})
                group = []
            else:
                group.append(tok)
    return {"month": month, "notice": notice_date(t), "terms": terms, "rows": rows,
            "notes": notes, "prefs": prefs, "extras": extras}


def parse_didimdol(t: str) -> dict:
    t = htmlmod.unescape(t)
    m = re.search(r"(\d{4})년\s*(\d{2})월\s*내집마련디딤돌", t)
    month = f"{m.group(1)}-{m.group(2)}" if m else None
    toks = tokens(t)
    tables = []
    i = 0
    while i < len(toks):
        if toks[i].startswith("만기별 금리"):
            j = i + 1
            terms = []
            while j < len(toks) and TERM.match(toks[j]):
                terms.append(toks[j]); j += 1
            rows = []
            while j < len(toks) and "백만원" in toks[j]:
                band = toks[j]; j += 1
                vals = []
                while j < len(toks) and NUM.match(toks[j]):
                    vals.append(float(toks[j])); j += 1
                if len(vals) == len(terms):
                    rows.append({"band": band, "rates": vals})
            if rows:
                tables.append({"terms": terms, "rows": rows})
            i = j
        else:
            i += 1
    lines = [l.strip() for l in t.split("\n")]
    notes = [l for l in lines if l.startswith("※")][:2]
    # 우대금리 문단은 규정집처럼 길다. 사람이 볼 두 줄만: 가구 유형 우대와 청약저축 우대.
    prefs = []
    for key in ("다자녀 가구 0.7%p", "청약(종합)저축 가입중"):
        l = next((x for x in lines if key in x), None)
        if l:
            prefs.append(l[:260])
    floor = next((l for l in lines if "최저금리" in l and "우대금리 적용 상한" in l), None)
    return {"month": month, "notice": notice_date(t), "general": tables[0] if tables else None,
            "first_newlywed": tables[1] if len(tables) > 1 else None,
            "notes": notes, "prefs": prefs, "floor": floor}


def fetch(url: str) -> str:
    r = requests.get(url, headers={"User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9"}, timeout=30)
    r.raise_for_status()
    return text(r.text)


def build(bog_text: str, did_text: str) -> dict:
    b, d = parse_bogeumjari(bog_text), parse_didimdol(did_text)
    ok = bool(b["rows"]) and bool(d["general"])
    return {"ok": ok, "checked": date.today().isoformat(),
            "sources": {"bogeumjari": BOGEUM, "didimdol": DIDIM},
            "bogeumjari": b, "didimdol": d}


def main():
    dry = "--dry" in sys.argv
    data = build(fetch(BOGEUM), fetch(DIDIM))
    b, d = data["bogeumjari"], data["didimdol"]
    print(f"보금자리론 {b['month']} 공시 {b['notice']}: {len(b['rows'])}행 × {len(b['terms'])}만기, 우대 {len(b['prefs'])}개")
    for r in b["rows"]:
        print("  ", r["name"], r["rates"])
    print(f"디딤돌 {d['month']} 공시 {d['notice']}: 일반 {len((d['general'] or {}).get('rows', []))}행, 생애최초신혼 {len((d['first_newlywed'] or {}).get('rows', []))}행")
    if not data["ok"]:
        print("표를 읽지 못했다 — 저장하지 않는다")
        sys.exit(1)
    if dry:
        print(json.dumps(data, ensure_ascii=False)[:800])
        return
    from supabase import create_client
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    sb.table("site_settings").upsert({"key": KEY, "value": data, "updated_at": "now()"}, on_conflict="key").execute()
    print("저장:", KEY)


if __name__ == "__main__":
    main()
