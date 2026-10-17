"""
blog_top_roles.py — "공공기관 채용, 많이 뽑는 직무 순위 TOP10" 글을 쓴다. 지금 채용 현황을 앞에 붙인다.

blog_daily.py 의 ROLES(직무 낱말 목록)로 최근 12개월 job_posts 를 세어 순위를 매긴다. 숫자는 DB 에서 센다.
글은 blog_posts 에 kind='role', subject='top10-YYYY-MM' 으로 들어가 /story/<slug> 에 보인다. 티스토리에는
tistory_publish.py 가 이 글을 그대로(--mode full) 올린다 — 순위 글 양식(들머리 → 목차 → 현황 → 1위…10위 →
비교 표 → 고르는 법)은 블로그의 기존 순위 글과 맞췄다.

  python pipeline/blog_top_roles.py --dry                 # DB 에서 세고 글만 찍어 본다
  python pipeline/blog_top_roles.py                       # 쓴다(upsert). GitHub Actions tistory-publish 의 top10 입력이 이걸 돌린다
  python pipeline/blog_top_roles.py --stats stats.json    # 미리 뽑아 둔 숫자(JSON)로 글만 만든다(DB 없이)

--stats 의 JSON 모양: {"overview": {...}, "roles": [...]}. 키는 아래 overview()/role_rows() 가 만드는 것과 같다.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import blog_daily as b  # noqa: E402  — ROLES, 블록 생성기, n, pct, kdate, short_sido

SITE = b.SITE
BRAND = b.BRAND

# 직무가 어떤 일인지 한 줄. 공고 제목만으로는 모르는 사람을 위해. 숫자가 아닌 일반 설명만 적는다.
NOTES: dict[str, str] = {
    "public-worker": "공무직은 공공기관·관공서에서 정년까지 일하는 무기계약 직원입니다. 시설·청소·조리·사무 보조처럼 하는 일은 공고마다 다르고, 학력·자격 요건이 낮은 자리가 많아 지원자가 몰립니다.",
    "term-official": "임기제공무원은 2~5년 기간을 정해 뽑는 공무원입니다. 홍보·법무·IT·연구처럼 전문 분야 경력을 요구하고, 경력 연수와 자격이 서류의 핵심입니다.",
    "teacher-temp": "기간제교사는 휴직·결원이 생긴 학교가 한 학기나 한 해 단위로 뽑는 교원입니다. 교원자격증이 있어야 하고, 학교가 직접 공고를 내므로 접수 기간이 아주 짧습니다.",
    "clerical": "행정·사무는 민원 응대, 문서·회계 처리, 사업 지원 같은 일입니다. 특별한 자격보다 문서 작성 능력과 컴퓨터 활용 자격을 보는 공고가 많습니다.",
    "lecturer": "강사는 학교 방과후·시간강사, 평생학습관·체육시설 강좌를 맡습니다. 과목별 자격이나 경력을 요구하고, 시간제가 대부분입니다.",
    "intern": "청년인턴은 공공기관이 만 19~34세를 대상으로 몇 달 단위로 뽑는 체험형 자리입니다. 정규직 전환은 드물지만 공공기관 경력을 쌓기 좋습니다.",
    "research": "연구원은 국책·지자체 연구기관과 대학 사업단이 뽑습니다. 석·박사 학위나 관련 전공을 요구하고, 과제 단위 계약직이 많습니다.",
    "facility": "시설·전기·안전관리는 건물·설비를 지키는 자리입니다. 전기·소방·기계 자격증(산업기사 이상)이 있으면 지원 폭이 크게 넓어집니다.",
    "postal": "집배·우편은 우체국이 뽑는 상시계약집배원과 우편물 구분 인력입니다. 운전면허(2종 소형·1종 보통)가 요건인 공고가 많습니다.",
    "guard": "경비·방호는 청사·학교·연구시설을 지키는 일입니다. 경비원 신임교육 이수나 청원경찰 요건을 보고, 교대 근무가 많습니다.",
    "cook": "조리·급식은 학교·교정시설·연수원 식당의 조리원과 조리사입니다. 조리사 자격이 있으면 조리사 자리에, 없어도 조리원 자리에 지원할 수 있습니다.",
    "cleaning": "환경미화는 청사·학교 청소와 환경 정비입니다. 자격 요건이 거의 없어 경쟁이 높고, 단시간 근로 공고도 섞여 있습니다.",
    "counsel": "상담은 학교 전문상담사, 민원·콜센터 상담원, 복지시설 상담원을 묶은 것입니다. 상담 관련 자격이나 심리·사회복지 전공을 요구하는 공고가 많습니다.",
    "childcare": "보육·유아교육은 공립 유치원·어린이집의 교사와 보조 인력입니다. 유치원 정교사나 보육교사 자격이 필요합니다.",
    "driver": "운전은 관용차·버스·화물 운전원입니다. 1종 대형 면허와 무사고 경력을 보는 공고가 많습니다.",
    "doctor": "의사는 보훈병원·근로복지공단 병원·국립의료원 등이 뽑는 진료 의사입니다. 전문의 자격과 과목이 요건입니다.",
    "it": "전산·정보화는 기관 전산망 운영, 데이터 관리, 정보보안 담당입니다. 정보처리기사·정보보안기사나 관련 경력을 봅니다.",
    "librarian": "사서는 공공·학교·대학 도서관 자리입니다. 사서 자격증(준사서 이상)이 필수입니다.",
    "nurse": "간호사는 공공병원·보건소·학교 보건실·교정시설이 뽑습니다. 간호사 면허가 필수이고, 임상 경력을 요구하는 자리가 많습니다.",
    "nutrition": "영양사는 학교·병원·연수원 급식의 식단과 위생을 맡습니다. 영양사 면허가 필수입니다.",
    "welfare": "사회복지·돌봄은 복지관·요양시설·학교의 돌봄과 사례관리 인력입니다. 사회복지사·요양보호사 자격을 봅니다.",
    "survey": "조사원은 통계·해양·농산물 조사처럼 현장에서 자료를 모으는 기간제 자리입니다. 운전면허와 현장 근무 가능 여부를 봅니다.",
    "youth": "청소년 지도·상담은 청소년재단·수련관·상담복지센터 인력입니다. 청소년지도사·청소년상담사 자격이 요건인 공고가 많습니다.",
    "ta": "대학 조교는 국립대 학과·행정 조교입니다. 해당 전공 학사 이상을 요구하고 임기는 보통 1~2년입니다.",
    "psy": "심리는 소년원·보호관찰소·법무보호복지공단의 심리 상담·검사 인력입니다. 임상심리사·상담심리사 자격을 봅니다.",
    "medtech": "임상병리·방사선은 공공병원·혈액원의 검사 인력입니다. 임상병리사·방사선사 면허가 필수입니다.",
    "pharma": "약사는 공공병원·교정시설·보건소 약제 업무입니다. 약사 면허가 필수이고 주말·야간 근무 공고도 있습니다.",
    "therapy": "물리·작업치료는 재활병원·보훈병원·특수학교의 치료사입니다. 물리치료사·작업치료사 면허가 필수입니다.",
    "lang": "통역·번역은 외교부·관세청·법원 등이 뽑는 외국어 인력입니다. 어학 성적과 통번역 경력을 봅니다.",
    "martial": "무도실무관은 보호관찰소·소년원에서 보호관찰 대상자 지도와 호송을 맡습니다. 무도 단증(유도·태권도 등)이 요건입니다.",
}


# ── 숫자 세기 (DB 에서 최근 12개월 공고를 받아 파이썬으로 센다) ───────────
COLS = "id,title,org,region,hire,reg_date,end_date"


def fetch_rows(sb, since: dt.date) -> list[dict]:
    rows, page, size = [], 0, 1000
    while True:
        r = (sb.table("job_posts").select(COLS).gte("reg_date", since.isoformat())
             .order("reg_date").range(page * size, page * size + size - 1).execute())
        chunk = r.data or []
        rows += chunk
        if len(chunk) < size:
            return rows
        page += 1


def overview(rows: list[dict], prev_count: int, today: dt.date) -> dict:
    open_rows = [r for r in rows if r.get("end_date") and r["end_date"] >= today.isoformat()]
    d30 = (today - dt.timedelta(days=30)).isoformat()
    by_hire = Counter((r.get("hire") or "기타") for r in open_rows).most_common()
    by_region = Counter((r.get("region") or "전국") for r in open_rows).most_common(6)
    by_month = Counter(r["reg_date"][:7] for r in rows)
    return {
        "open_now": len(open_rows), "new30": sum(1 for r in rows if r["reg_date"] >= d30),
        "n12": len(rows), "n12_prev": prev_count, "orgs12": len({r.get("org") for r in rows if r.get("org")}),
        "open_by_hire": [{"hire": h, "n": n} for h, n in by_hire],
        "open_by_region": [{"region": g, "n": n} for g, n in by_region],
        "by_month": [{"m": m, "n": by_month[m]} for m in sorted(by_month)],
        "today": today.isoformat(),
    }


def role_rows(rows: list[dict], today: dt.date) -> list[dict]:
    d90 = (today - dt.timedelta(days=90)).isoformat()
    out = []
    for role in b.ROLES:
        terms = [t.lower() for t in role["terms"]]
        hit = [r for r in rows if any(t in (r.get("title") or "").lower() for t in terms)]
        if not hit:
            continue
        wins = [(dt.date.fromisoformat(r["end_date"]) - dt.date.fromisoformat(r["reg_date"])).days
                for r in hit if r.get("end_date") and r["end_date"] >= r["reg_date"]]
        out.append({
            "key": role["key"], "name": role["name"], "n12": len(hit),
            "n_open": sum(1 for r in hit if r.get("end_date") and r["end_date"] >= today.isoformat()),
            "orgs": len({r.get("org") for r in hit if r.get("org")}),
            "n90": sum(1 for r in hit if r["reg_date"] >= d90),
            "top_orgs": [{"org": o, "n": n} for o, n in Counter(r.get("org") for r in hit if r.get("org")).most_common(3)],
            "top_regions": [{"region": g, "n": n} for g, n in Counter((r.get("region") or "전국") for r in hit).most_common(3)],
            "win_med": statistics.median(wins) if wins else None,
            "by_month": [{"m": m, "n": c} for m, c in sorted(Counter(r["reg_date"][:7] for r in hit).items())],
        })
    return sorted(out, key=lambda r: -r["n12"])


# ── 글 ───────────────────────────────────────────────────
def short_org(o: str) -> str:
    """'부산광역시교육청 부산광역시교육청학교행정지원본부 학교채용지원팀' 처럼 긴 기관명은 앞 두 토막만."""
    parts = o.split()
    return " ".join(parts[:2]) if len(parts) > 2 else o


def role_of(key: str) -> dict:
    return next(r for r in b.ROLES if r["key"] == key)


def q_url(key: str) -> str:
    return f"/jobs/q/{role_of(key)['terms'][0].strip()}"


def write(stats: dict) -> dict:
    ov = stats["overview"]
    roles = sorted(stats["roles"], key=lambda r: -r["n12"])[:10]
    today = dt.date.fromisoformat(ov["today"]) if ov.get("today") else b.today()
    ym = today.strftime("%Y-%m")
    n12, prev = int(ov["n12"]), int(ov.get("n12_prev") or 0)
    growth = (n12 - prev) * 100 // prev if prev else None
    top = roles[0]
    top3_share = b.pct(sum(r["n12"] for r in roles[:3]), n12)
    months = ov.get("by_month") or []
    peak = max(months[:-1] or months, key=lambda m: m["n"]) if months else None   # 이번 달은 아직 다 안 셌다
    hires = ov.get("open_by_hire") or []
    regions = ov.get("open_by_region") or []

    title = f"공공기관 채용 많이 뽑는 직무 순위 TOP10 | 최근 1년 공고 {b.n(n12)}건으로 본 지금 취업 현황"
    summary = (f"최근 12개월 나라일터·잡알리오에 올라온 공공기관 채용 공고 {b.n(n12)}건을 직무 낱말로 세어 많이 뽑는 직무 10개를 순위로 정리했습니다. "
               f"1위는 {top['name']} {b.n(top['n12'])}건. 지금 접수 중인 {b.n(ov['open_now'])}건의 고용 형태와 지역, 직무별 요건과 접수 기간도 함께 봅니다.")

    blocks: list[dict] = []
    toc = [("now", "공공기관 채용 현황은?")] + [(f"r{i+1}", f"{i+1}위 {r['name']}") for i, r in enumerate(roles)] \
        + [("compare", "직무 TOP10 한눈에 비교"), ("howto", "직무를 고를 때 이렇게 보세요")]

    # 들머리 — 짧은 문장 몇 줄
    blocks.append(b.P(f"공공기관 취업을 준비할 때 가장 먼저 드는 생각은 \"어떤 직무가 자리가 많을까\"입니다. "
                      f"**{b.kdate(today.isoformat())}** 기준으로 최근 12개월 동안 나라일터와 잡알리오에 올라온 공고 **{b.n(n12)}건**을 직무 낱말로 세어 봤습니다."))
    blocks.append(b.P("공고 제목에 든 직무 이름으로 분류했기 때문에 한 공고가 두 직무에 들 수 있고, 채용 인원이 아니라 공고 건수입니다. "
                      "그래도 어느 직무가 꾸준히 열리고, 어느 기관이 자주 뽑고, 접수 기간이 얼마나 짧은지는 이 숫자로 충분히 보입니다."))
    blocks.append(b.P(f"순위마다 요건과 많이 뽑는 기관을 적었고, 직무 이름을 누르면 {BRAND}에서 접수 중인 공고를 바로 볼 수 있습니다."))

    # 현황
    blocks.append(b.H2("공공기관 채용 현황은?", "now"))
    blocks.append(b.P(f"오늘 접수 중인 공공기관·공무직·임기제 채용 공고는 **{b.n(ov['open_now'])}건**, 지난 30일 새로 올라온 공고는 **{b.n(ov['new30'])}건**입니다. "
                      f"최근 12개월 공고 {b.n(n12)}건을 낸 기관은 **{b.n(ov['orgs12'])}곳**"
                      + (f"이고, 그 전 12개월({b.n(prev)}건)보다 **{abs(growth)}% {'늘었' if growth >= 0 else '줄었'}**습니다." if growth is not None else "입니다.")))
    if hires:
        blocks.append(b.P(f"접수 중인 공고를 고용 형태로 나누면 **{hires[0]['hire']}**{b.josa(hires[0]['hire'], '이가')[len(hires[0]['hire']):]} {b.n(hires[0]['n'])}건({b.pct(hires[0]['n'], ov['open_now'])}%)으로 가장 많습니다. "
                          "공공은 공사·공단·출연기관, 국가는 중앙부처와 소속기관, 지자체는 시·도·시·군·구, 교육은 교육청과 학교입니다."))
        blocks.append(b.BARS([{"label": h["hire"], "n": h["n"]} for h in hires]))
    if regions:
        blocks.append(b.P("지역별로는 " + ", ".join(f"**{b.short_sido(r['region'])}** {b.n(r['n'])}건" for r in regions[:4])
                          + " 순입니다. '전국'은 근무지를 특정하지 않았거나 본사 채용입니다."))
    if peak:
        blocks.append(b.P(f"달별로는 **{int(peak['m'].split('-')[1])}월**에 {b.n(peak['n'])}건으로 가장 많이 올라왔습니다. "
                          "공공기관 공고는 연초(1~3월)와 하반기 초(8~9월)에 몰리는 편이라, 이 시기 전에 서류를 준비해 두는 것이 좋습니다."))
        blocks.append(b.BARS([{"label": f"{int(x['m'].split('-')[1])}월", "n": x["n"]} for x in months]))
    blocks.append(b.LINKS([{"href": "/jobs/status/open", "label": "지금 접수 중인 공공기관 채용 공고 전체 보기"},
                           {"href": "/jobs/org", "label": "기관별 채용 이력 — 언제, 얼마나 뽑는지"}]))

    # 1위 … 10위 — 항목마다 제목 · 요약 목록 · 설명 · 링크 (순위 글 양식)
    for i, r in enumerate(roles):
        orgs = r.get("top_orgs") or []
        regs = [x for x in (r.get("top_regions") or []) if x["region"] != "전국"]
        share = b.pct(r["n12"], n12)
        share90 = b.pct(r["n90"], r["n12"])
        blocks.append(b.H2(f"{i+1}위 {r['name']}", f"r{i+1}"))
        spec = [
            f"최근 12개월 공고: **{b.n(r['n12'])}건** (전체의 {share}%)",
            f"지금 접수 중: **{b.n(r['n_open'])}건**" if r["n_open"] else "지금 접수 중: 없음",
            f"공고를 낸 기관: {b.n(r['orgs'])}곳" + (" — " + ", ".join(f"{short_org(o['org'])} {b.n(o['n'])}건" for o in orgs[:2]) if orgs else ""),
        ]
        if regs:
            spec.append("많은 지역: " + ", ".join(f"{b.short_sido(x['region'])} {b.n(x['n'])}건" for x in regs[:2]))
        if r.get("win_med") is not None:
            spec.append(f"접수 기간: 보통 **{int(r['win_med'])}일**")
        blocks.append(b.LIST(spec))
        blocks.append(b.P(NOTES.get(r["key"], f"{r['name']} 직무는 공고마다 하는 일과 요건이 다릅니다. 공고 본문의 응시 자격을 먼저 확인하세요.")))
        trend = (f"최근 석 달에 {b.n(r['n90'])}건({share90}%)이 올라와 요즘 더 활발합니다." if share90 >= 30 else
                 f"최근 석 달에 {b.n(r['n90'])}건({share90}%)으로 한 해 동안 고르게 열립니다." if share90 >= 20 else
                 f"최근 석 달에는 {b.n(r['n90'])}건({share90}%)으로 뜸한 편이니 시기를 기다려야 합니다.")
        tip = (" 접수 기간이 일주일 안팎이라 공고를 본 날 서류를 내야 합니다." if r.get("win_med") is not None and r["win_med"] <= 7 else
               " 접수 기간이 열흘 넘게 주어지는 편이라 공고를 보고 준비해도 늦지 않습니다." if r.get("win_med") is not None and r["win_med"] >= 10 else "")
        blocks.append(b.P(trend + tip))
        blocks.append(b.LINKS([{"href": q_url(r["key"]), "label": f"{r['name']} 접수 중인 공고와 지난 공고 보기"}]
                              + [{"href": b.org_href(o["org"]), "label": f"{short_org(o['org'])} 채용 이력"} for o in orgs[:1]]))

    # 비교 표
    blocks.append(b.H2("직무 TOP10 한눈에 비교", "compare"))
    blocks.append(b.P(f"상위 세 직무({', '.join(r['name'] for r in roles[:3])})가 전체 공고의 **{top3_share}%**입니다. "
                      "공무직·임기제처럼 고용 형태가 곧 직무 이름인 공고가 많아, 실제 하는 일은 공고 본문을 봐야 합니다."))
    blocks.append(b.TABLE(["순위", "직무", "최근 12개월", "접수 중", "기관 수", "접수 기간", "주요 요건"],
                          [[f"{i+1}위", f"[{r['name']}]({q_url(r['key'])})", f"{b.n(r['n12'])}건", f"{b.n(r['n_open'])}건",
                            f"{b.n(r['orgs'])}곳", f"{int(r['win_med'])}일" if r.get("win_med") is not None else "-",
                            NOTES.get(r["key"], "").split(". ")[1].rstrip(".") if NOTES.get(r["key"], "").count(". ") >= 1 else "-"]
                           for i, r in enumerate(roles)]))
    blocks.append(b.BARS([{"label": r["name"], "n": r["n12"]} for r in roles]))

    # 고르는 법
    blocks.append(b.H2("직무를 고를 때 이렇게 보세요", "howto"))
    quick = [r for r in roles if r.get("win_med") is not None and r["win_med"] <= 7]
    tips = [
        "공고 수가 많다고 자리가 많은 것은 아닙니다. 공무직·기간제교사처럼 한 학교·한 사무소가 한 명씩 뽑는 직무는 **같은 기관이 자주 올립니다**. [기관별 채용](/jobs/org)에서 그 기관의 주기를 먼저 봅니다.",
        (f"접수 기간이 짧은 직무({', '.join(r['name'] for r in quick[:3])})는 공고를 본 날 서류를 내야 합니다. 공고 쪽 **저장** 단추로 모아 두고 아침마다 확인하세요." if quick else
         "접수 기간은 직무마다 다릅니다. 공고 쪽 **저장** 단추로 모아 두고 마감 전날 확인하세요."),
        "면허·자격이 필요한 직무(간호사·약사·사서·치료사 등)는 공고 수는 적어도 경쟁이 덜합니다. 자격이 있다면 [자격증 시험](/license) 쪽에서 그 자격을 적은 공고를 함께 봅니다.",
        "자기소개서·직무수행계획서는 [기관별 작성 가이드](/jobs/guide)에 공고문에서 뽑은 항목이 정리돼 있습니다. 같은 직무라도 기관마다 묻는 것이 다릅니다.",
        f"매일 아침 새 공고와 사흘 안 마감 공고는 [오늘의 채용 브리핑](/story)에서 봅니다.",
    ]
    blocks.append(b.LIST(tips))
    blocks.append(b.NOTE(f"{today.isoformat()} 기준, 인사혁신처 나라일터와 잡알리오에 올라온 공고를 {BRAND}이 모아 센 숫자입니다. "
                         "직무는 공고 제목의 낱말로 분류했고, 기관 홈페이지에만 올리는 공고는 빠질 수 있습니다. 채용 인원이 아니라 공고 건수이며, 요건은 공고마다 다르니 공고 본문이 기준입니다."))

    keywords = [BRAND, "공공기관 채용", "많이 뽑는 직무", "공공기관 취업 현황", "공무직 채용", "임기제공무원 채용",
                "기간제교사 채용", "공공기관 직무 순위", f"{today.year}년 공공기관 채용"]
    return {"slug": f"jobs-top10-roles-{ym}", "kind": "role", "subject": f"top10-{ym}", "title": title, "summary": summary,
            "keywords": keywords, "body": [{"type": "toc", "items": [{"id": i, "label": l} for i, l in toc]}] + blocks,
            "stats": {"overview": ov, "roles": roles}}


# ── main ─────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stats", help="미리 뽑은 숫자 JSON({overview, roles}). 없으면 DB 에서 센다")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    sb = None
    if a.stats:
        with open(a.stats, encoding="utf-8") as f:
            stats = json.load(f)
    else:
        from supabase import create_client
        sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
        today = b.today()
        rows = fetch_rows(sb, today - dt.timedelta(days=730))
        cut = (today - dt.timedelta(days=365)).isoformat()
        recent = [r for r in rows if r["reg_date"] >= cut]
        prev = sum(1 for r in rows if r["reg_date"] < cut)
        print(f"공고 {len(rows)}건 읽음(최근 12개월 {len(recent)}건, 그 전 {prev}건)")
        stats = {"overview": overview(recent, prev, today), "roles": role_rows(recent, today)}

    post = write(stats)
    print(f"{post['slug']}: {post['title']}")
    if a.dry:
        print(json.dumps(post, ensure_ascii=False, indent=1)[:8000])
        return 0
    if sb is None:
        from supabase import create_client
        sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    row = {k: post[k] for k in ("slug", "kind", "subject", "title", "summary", "keywords", "body", "stats")}
    existing = sb.table("blog_posts").select("slug").eq("slug", post["slug"]).execute().data
    if not existing:
        row["published_at"] = b.today().isoformat()
    row["updated_at"] = "now()"
    sb.table("blog_posts").upsert(row, on_conflict="slug").execute()
    print(f"저장: {SITE}/story/{post['slug']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
