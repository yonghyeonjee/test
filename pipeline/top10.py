"""
top10.py — 매일 한 편 "순위 TOP10" 글의 엔진. 주제(topic)마다 jiwon DB 자료로 10개를 세어 jiwon(blog_posts)에 글을 쓴다.
티스토리에는 tistory_publish.py --composer top10 이 이 글의 stats 로 따로 쓴 글을 올린다(출처 = jiwon).

  python pipeline/top10.py --list                         # 주제 목록
  python pipeline/top10.py --topic civil --dry            # DB 에서 세고 글만 찍어 본다
  python pipeline/top10.py --topic civil                  # jiwon 에 쓴다(upsert). slug 를 stdout 마지막 줄에 찍는다
  python pipeline/top10.py --date 2026-10-18              # 기획표(top10_plan.json)에서 그날 주제를 골라 쓴다
  python pipeline/top10.py --today                        # 오늘(KST) 주제

자료 세 갈래와 항목(entity) 다섯 가지
  jobs     job_posts 최근 12개월(그 전 12개월은 증감 비교용)  → keyword(직무·직렬 낱말 묶음) · org(기관) · region(시·도)
  welfare  programs_public(지원사업·기업지원)               → welfare_region(시·도/시·군·구) · welfare_topic(분야·대상)
  license  exam_stats(큐넷 수험자 동향) + license_items     → license(종목)

글의 stats 에 {"topic", "entity", "overview", "items"} 가 남아 차트(chart_top10.py)와 티스토리 작성기(tistory_top10.py)가 쓴다.
항목 하나의 모양: {key, name, n, n_open, n90, orgs, win_med, by_month[], bars{title, items[{label,n}]}, facts[], desc, link, link_label}
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
import blog_daily as b  # noqa: E402
from blog_top_roles import NOTES as ROLE_NOTES, short_org  # noqa: E402
from top10_notes import PSY, hard_for, psy_links  # noqa: E402

SITE, BRAND = b.SITE, b.BRAND
PLAN_FILE = Path(__file__).parent / "top10_plan.json"

# ── 낱말 묶음 ─────────────────────────────────────────────
# 공무원 직렬(직군). 나라일터 공고 제목의 낱말 기준. 임기제·공무직은 고용 형태라 뺀다.
CIVIL = [
    {"key": "police", "name": "경찰", "terms": ["경찰"], "exclude": ["청원경찰", "경찰청"]},   # 2026-10-17 실측: 1,071건(청원경찰·경찰청 소속 공무직 제외)
    {"key": "research", "name": "연구직", "terms": ["연구사", "연구관", "연구직", "연구원"]},
    {"key": "facility-mech", "name": "기계·시설직", "terms": ["기계", "시설관리", "설비"]},
    {"key": "guard", "name": "방호직", "terms": ["방호", "청원경찰"]},
    {"key": "env", "name": "환경직", "terms": ["환경"]},
    {"key": "admin", "name": "행정직", "terms": ["행정"], "exclude": ["행정안전부"]},            # 실측 797건. '행정직'만 쓰면 20건뿐이라 넓게 잡는다
    {"key": "marine", "name": "해양수산직", "terms": ["해양", "수산", "항해", "기관사"]},
    {"key": "it", "name": "전산·정보직", "terms": ["전산", "정보화", "정보보안", "데이터"]},
    {"key": "health", "name": "보건직", "terms": ["보건", "의료기술", "간호"]},
    {"key": "pr", "name": "홍보직", "terms": ["홍보", "대변인", "언론"]},
    {"key": "driver", "name": "운전직", "terms": ["운전"]},
    {"key": "green", "name": "녹지·산림직", "terms": ["녹지", "산림", "조경"]},
    {"key": "legal", "name": "법무직", "terms": ["법무", "변호사", "법률"]},
    {"key": "justice", "name": "교정·보호직", "terms": ["교정", "보호직", "보호관찰", "검찰"]},
    {"key": "curator", "name": "학예·기록연구직", "terms": ["학예", "기록연구", "기록물"]},
    {"key": "industry", "name": "공업·전기직", "terms": ["공업", "전기"]},
    {"key": "agri", "name": "농업·축산직", "terms": ["농업", "농촌", "축산", "수의"]},
    {"key": "stat", "name": "통계직", "terms": ["통계"]},
    {"key": "library", "name": "사서직", "terms": ["사서"]},
    {"key": "build", "name": "건축·토목직", "terms": ["건축", "토목"]},
    {"key": "tax", "name": "세무·관세직", "terms": ["세무", "관세"]},
    {"key": "fire", "name": "소방", "terms": ["소방공무원", "소방 ", "소방관"]},
    {"key": "welfare", "name": "사회복지직", "terms": ["사회복지"]},
    {"key": "interp", "name": "통역·번역직", "terms": ["통역", "번역"]},
]
CIVIL_NOTES = {
    "police": "경찰은 순경 공채 외에 경력경쟁(변호사·사이버·외국어·항공 등)으로도 뽑습니다. 체력검사와 신체 조건이 있고, 경력채용은 분야별 자격이 핵심입니다.",
    "research": "연구직 공무원(연구사·연구관)은 국립 연구기관·시험원·박물관이 뽑습니다. 석사 이상 학위나 관련 경력이 응시 요건입니다.",
    "facility-mech": "기계·시설직은 청사·연구시설의 기계설비 운영과 안전 점검을 맡습니다. 기계·설비 분야 기사·산업기사가 요건인 공고가 많습니다.",
    "guard": "방호직과 청원경찰은 청사 출입 통제와 경비를 맡습니다. 나이 상한과 체력 요건이 있고 교대 근무가 보통입니다.",
    "env": "환경직은 환경부·지자체 환경 부서와 국립공원이 뽑습니다. 환경 분야 기사 자격이나 관련 전공을 봅니다.",
    "admin": "행정직은 민원·기획·예산 등 일반 행정을 맡는 가장 넓은 직렬입니다. 공채 경쟁률이 가장 높고, 경력채용은 분야 경력을 봅니다.",
    "marine": "해양수산직은 해양수산부 소속 기관과 지방해양수산청이 뽑습니다. 항해사·기관사 면허나 수산 분야 자격이 요건인 자리가 많습니다.",
    "it": "전산·정보직은 기관 전산망과 정보보안, 데이터 관리를 맡습니다. 정보처리기사·정보보안기사 또는 관련 경력을 봅니다.",
    "health": "보건직은 보건소·검역소·국립병원이 뽑습니다. 간호사·임상병리사 같은 면허가 응시 요건인 자리가 대부분입니다.",
    "pr": "홍보직은 대변인실과 홍보 부서의 보도·디지털 홍보를 맡습니다. 언론·광고·콘텐츠 경력을 보는 경력채용이 많습니다.",
    "driver": "운전직은 관용차와 버스를 운전합니다. 1종 대형 면허와 무사고 경력이 기준입니다.",
    "green": "녹지·산림직은 산림청·국립공원·지자체 공원녹지 부서가 뽑습니다. 산림·조경 기사 자격을 봅니다.",
    "legal": "법무직은 법률 자문·소송 업무로, 변호사 자격자를 임기제나 전문경력관으로 뽑는 공고가 많습니다.",
    "justice": "교정·보호직은 교도소·보호관찰소·소년원에서 일합니다. 체력검사가 있고, 심리·사회복지 전공을 우대하는 자리도 있습니다.",
    "curator": "학예·기록연구직은 박물관·미술관·기록원이 뽑습니다. 학예사 자격이나 기록관리학 석사가 요건입니다.",
    "industry": "공업·전기직은 전기·전자·화공 설비를 다룹니다. 전기기사·전기산업기사가 가장 흔한 요건입니다.",
    "agri": "농업·축산직은 농촌진흥청·농산물품질관리원·지자체 농정 부서가 뽑습니다. 농업 분야 자격이나 수의사 면허를 봅니다.",
    "stat": "통계직은 국가데이터처(통계청) 본청과 지방청이 뽑습니다. 조사 현장 근무가 많고 통계·데이터 분석 경험을 봅니다.",
    "library": "사서직은 국립·공공·학교 도서관 자리입니다. 사서 자격증이 필수입니다.",
    "build": "건축·토목직은 청사 건립, 도로·하천 관리 같은 시설 사업을 맡습니다. 건축·토목 기사 자격이 요건입니다.",
    "tax": "세무·관세직은 세무서와 세관이 뽑습니다. 공채 비중이 크고, 경력채용은 세무사·회계사 자격을 봅니다.",
    "fire": "소방공무원은 공채와 구급·구조 등 경력채용으로 뽑습니다. 체력시험 비중이 크고 응급구조사 자격 우대가 있습니다.",
    "welfare": "사회복지직은 주민센터와 복지 부서에서 급여·사례관리를 맡습니다. 사회복지사 자격이 응시 요건입니다.",
    "interp": "통역·번역직은 외교부·관세청·법원 등이 뽑습니다. 어학 성적과 통번역 경력이 기준입니다.",
}
MEDICAL = [
    {"key": "doctor", "name": "의사", "terms": ["의사", "진료", "전문의", "공중보건의"]},
    {"key": "nurse", "name": "간호사", "terms": ["간호사", "간호직", "간호 "]},
    {"key": "aide", "name": "간호조무사", "terms": ["간호조무"]},
    {"key": "pharma", "name": "약사", "terms": ["약사", "약무"]},
    {"key": "medtech", "name": "임상병리사", "terms": ["임상병리"]},
    {"key": "radio", "name": "방사선사", "terms": ["방사선"]},
    {"key": "therapy", "name": "물리·작업치료사", "terms": ["물리치료", "작업치료"]},
    {"key": "nutrition", "name": "영양사", "terms": ["영양사"]},
    {"key": "dental", "name": "치과위생사", "terms": ["치과위생", "치위생"]},
    {"key": "emt", "name": "응급구조사", "terms": ["응급구조"]},
    {"key": "care", "name": "요양보호사", "terms": ["요양보호"]},
    {"key": "health-mgr", "name": "보건관리자", "terms": ["보건관리"]},
]
EDUCATION = [
    {"key": "teacher-temp", "name": "기간제교사", "terms": ["기간제교사", "기간제 교사", "기간제교원", "기간제 교원", "계약제교원"]},
    {"key": "lecturer", "name": "시간강사·방과후강사", "terms": ["강사"]},
    {"key": "cook", "name": "조리실무사·조리원", "terms": ["조리"]},
    {"key": "care", "name": "돌봄전담사", "terms": ["돌봄"]},
    {"key": "special", "name": "특수교육실무사", "terms": ["특수교육"]},
    {"key": "admin", "name": "교무·행정실무사", "terms": ["교무", "행정실무", "교육공무직"]},
    {"key": "counsel", "name": "전문상담사", "terms": ["상담"]},
    {"key": "library", "name": "사서", "terms": ["사서"]},
    {"key": "nutrition", "name": "영양사·영양교사", "terms": ["영양"]},
    {"key": "health", "name": "보건교사·간호사", "terms": ["보건", "간호"]},
    {"key": "cleaning", "name": "미화·시설", "terms": ["미화", "청소", "시설"]},
    {"key": "kinder", "name": "유치원 교사·방과후", "terms": ["유치원"]},
]
TECH = [
    {"key": "elec", "name": "전기", "terms": ["전기"]},
    {"key": "mech", "name": "기계·설비", "terms": ["기계", "설비"]},
    {"key": "facility", "name": "시설관리", "terms": ["시설관리", "시설직"]},
    {"key": "civil", "name": "토목", "terms": ["토목"]},
    {"key": "arch", "name": "건축", "terms": ["건축"]},
    {"key": "fire", "name": "소방·안전", "terms": ["소방", "안전관리"]},
    {"key": "ict", "name": "정보통신", "terms": ["정보통신", "통신"]},
    {"key": "env", "name": "환경·수질", "terms": ["환경", "수질", "폐수"]},
    {"key": "chem", "name": "화공·가스", "terms": ["화공", "가스"]},
    {"key": "survey", "name": "측량·지적", "terms": ["측량", "지적"]},
    {"key": "it", "name": "전산·데이터", "terms": ["전산", "데이터", "정보보안"]},
    {"key": "energy", "name": "에너지·원자력", "terms": ["에너지", "원자력", "발전"]},
]


# ── 자료 읽기 ─────────────────────────────────────────────
def _page(sb, table: str, cols: str, apply=None, size: int = 1000) -> list[dict]:
    rows, page = [], 0
    while True:
        q = sb.table(table).select(cols)
        if apply:
            q = apply(q)
        chunk = q.range(page * size, page * size + size - 1).execute().data or []
        rows += chunk
        if len(chunk) < size:
            return rows
        page += 1


class Data:
    """주제가 필요할 때만 읽는다. 한 실행에서 한 번만."""

    def __init__(self, sb, today: dt.date):
        self.sb, self.today = sb, today
        self._jobs = self._programs = self._exams = None

    def jobs(self) -> list[dict]:
        if self._jobs is None:
            since = (self.today - dt.timedelta(days=730)).isoformat()
            self._jobs = _page(self.sb, "job_posts", "id,title,org,region,hire,reg_date,end_date",
                               lambda q: q.gte("reg_date", since).order("reg_date"))
        return self._jobs

    def programs(self) -> list[dict]:
        if self._programs is None:
            self._programs = _page(self.sb, "programs_public",
                                   "id,kind,title,sido,sigungu,topics,life_cycle,support_type,status,is_always_on,biz_field,org_name",
                                   lambda q: q.order("id"))
        return self._programs

    def exams(self) -> tuple[list[dict], dict]:
        if self._exams is None:
            stats = _page(self.sb, "exam_stats", "code,year,stage,applicants,takers,passers,pass_rate",
                          lambda q: q.gte("year", self.today.year - 3).order("code"))
            items = {r["code"]: r for r in _page(self.sb, "license_items", "code,name,kind_name,series,field,sub_field", lambda q: q.order("code"))}
            self._exams = (stats, items)
        return self._exams


# ── 공통 집계 ─────────────────────────────────────────────
def split_recent(rows: list[dict], today: dt.date) -> tuple[list[dict], int]:
    cut = (today - dt.timedelta(days=365)).isoformat()
    return [r for r in rows if r["reg_date"] >= cut], sum(1 for r in rows if r["reg_date"] < cut)


def by_month(rows: list[dict]) -> list[dict]:
    c = Counter(r["reg_date"][:7] for r in rows)
    return [{"m": m, "n": c[m]} for m in sorted(c)]


def job_item(key: str, name: str, hit: list[dict], today: dt.date, total: int, link: str, link_label: str,
             bars_title="자주 뽑는 기관", bars_by="org") -> dict:
    t = today.isoformat()
    d90 = (today - dt.timedelta(days=90)).isoformat()
    wins = [(dt.date.fromisoformat(r["end_date"]) - dt.date.fromisoformat(r["reg_date"])).days
            for r in hit if r.get("end_date") and r["end_date"] >= r["reg_date"]]
    n_open = sum(1 for r in hit if r.get("end_date") and r["end_date"] >= t)
    n90 = sum(1 for r in hit if r["reg_date"] >= d90)
    orgs = len({r.get("org") for r in hit if r.get("org")})
    if bars_by == "org":
        top = Counter(r.get("org") for r in hit if r.get("org")).most_common(3)
        bars = [{"label": short_org(o), "n": c} for o, c in top]
    elif bars_by == "role":
        rc = Counter()
        for r in hit:
            tl = (r.get("title") or "").lower()
            for role in b.ROLES:
                if any(x.lower() in tl for x in role["terms"]):
                    rc[role["name"]] += 1
        bars = [{"label": k, "n": c} for k, c in rc.most_common(3)]
    else:  # region
        bars = [{"label": b.short_sido(g) or g, "n": c} for g, c in Counter((r.get("region") or "전국") for r in hit).most_common(3)]
    regs = [(g, c) for g, c in Counter((r.get("region") or "전국") for r in hit).most_common(4) if g != "전국"][:2]
    win_med = statistics.median(wins) if wins else None
    facts = [f"최근 12개월 공고: **{b.n(len(hit))}건** (전체의 {b.pct(len(hit), total)}%)",
             f"지금 접수 중: **{b.n(n_open)}건**" if n_open else "지금 접수 중: 없음 (시기를 기다려야 합니다)"]
    if bars:
        facts.append(f"{bars_title}: " + ", ".join(f"{x['label']} {b.n(x['n'])}건" for x in bars[:2]))
    if regs:
        facts.append("공고가 많은 지역: " + ", ".join(f"{b.short_sido(g)} {b.n(c)}건" for g, c in regs))
    if win_med is not None:
        facts.append(f"접수 기간: 보통 **{int(win_med)}일**")
    return {"key": key, "name": name, "n": len(hit), "n_open": n_open, "n90": n90, "orgs": orgs, "win_med": win_med,
            "by_month": by_month(hit), "bars": {"title": f"{bars_title} (공고 수)", "items": bars}, "facts": facts,
            "desc": "", "link": link, "link_label": link_label}


def job_overview(recent: list[dict], prev: int, today: dt.date, label: str) -> dict:
    t = today.isoformat()
    open_rows = [r for r in recent if r.get("end_date") and r["end_date"] >= t]
    hires = Counter((r.get("hire") or "기타") for r in open_rows).most_common()
    growth = (len(recent) - prev) * 100 // prev if prev else None
    facts = [f"최근 12개월 {label} 공고: **{b.n(len(recent))}건**" + (f" (그 전 12개월보다 {abs(growth)}% {'증가' if growth >= 0 else '감소'})" if growth is not None else ""),
             f"공고를 낸 기관: **{b.n(len({r.get('org') for r in recent if r.get('org')}))}곳**",
             f"지금 접수 중: **{b.n(len(open_rows))}건**"]
    if hires:
        facts.append("고용 형태(접수 중): " + ", ".join(f"{h} {b.n(c)}건" for h, c in hires[:4]))
    return {"n_total": len(recent), "n_prev": prev, "n_open": len(open_rows), "today": t, "unit": "건",
            "by_month": by_month(recent), "facts": facts,
            "bars": {"title": "고용 형태(접수 중)", "items": [{"label": h, "n": c} for h, c in hires[:4]]}}


def keyword_items(groups: list[dict], rows: list[dict], today: dt.date, link_prefix="/jobs/q/", bars_by="org") -> list[dict]:
    out = []
    for g in groups:
        terms = [x.lower() for x in g["terms"]]
        excl = [x.lower() for x in g.get("exclude", [])]
        hit = [r for r in rows if any(t in (r.get("title") or "").lower() for t in terms)
               and not any(e in (r.get("title") or "").lower() for e in excl)]
        if not hit:
            continue
        out.append(job_item(g["key"], g["name"], hit, today, len(rows), f"{link_prefix}{g['terms'][0].strip()}",
                            f"{g['name']} 접수 중인 공고와 지난 공고 보기", bars_by=bars_by))
    return sorted(out, key=lambda x: -x["n"])


def org_items(rows: list[dict], today: dt.date) -> list[dict]:
    groups = defaultdict(list)
    for r in rows:
        if r.get("org"):
            groups[r["org"]].append(r)
    out = []
    for org, hit in sorted(groups.items(), key=lambda kv: -len(kv[1]))[:12]:
        it = job_item(org, short_org(org), hit, today, len(rows), b.org_href(org), f"{short_org(org)} 채용 이력과 접수 중 공고",
                      bars_title="주로 뽑는 직무", bars_by="role")
        it["full_name"] = org
        out.append(it)
    return out[:10]


def region_items(rows: list[dict], today: dt.date) -> list[dict]:
    groups = defaultdict(list)
    for r in rows:
        if r.get("region") and r["region"] != "전국":
            groups[r["region"]].append(r)
    out = []
    for reg, hit in sorted(groups.items(), key=lambda kv: -len(kv[1]))[:10]:
        it = job_item(reg, b.short_sido(reg) or reg, hit, today, len(rows), f"/jobs/region/{reg}", f"{b.short_sido(reg)} 채용 공고 전체 보기",
                      bars_title="자주 뽑는 기관", bars_by="org")
        it["full_name"] = reg
        it["facts"] = [f for f in it["facts"] if not f.startswith("공고가 많은 지역")]
        out.append(it)
    return out


# ── 지원사업 ──────────────────────────────────────────────
def is_open(p: dict) -> bool:
    return bool(p.get("is_always_on")) or p.get("status") == "open"


def welfare_overview(rows: list[dict], today: dt.date, label: str) -> dict:
    opens = [p for p in rows if is_open(p)]
    cash = sum(1 for p in opens if p.get("support_type") == "현금지급")
    kinds = Counter(p.get("kind") for p in rows)
    facts = [f"{label}: **{b.n(len(rows))}건** (복지 {b.n(kinds.get('welfare', 0))}건 · 기업지원 {b.n(kinds.get('business', 0))}건)",
             f"지금 신청할 수 있는 사업: **{b.n(len(opens))}건** (상시 접수 포함)",
             f"현금을 주는 사업(신청 가능 기준): {b.n(cash)}건 ({b.pct(cash, len(opens))}%)"]
    lc = Counter(x for p in opens for x in (p.get("life_cycle") or [])).most_common(5)
    return {"n_total": len(rows), "n_prev": 0, "n_open": len(opens), "today": today.isoformat(), "unit": "건", "facts": facts,
            "bars": {"title": "대상(신청 가능 사업)", "items": [{"label": k, "n": c} for k, c in lc]}}


def welfare_item(key: str, name: str, hit: list[dict], total: int, link: str, link_label: str, bars_mode="topic") -> dict:
    opens = [p for p in hit if is_open(p)]
    if bars_mode == "topic":
        bars = [{"label": k, "n": c} for k, c in Counter(x for p in hit for x in (p.get("topics") or [])).most_common(3)]
        bt = "많은 분야"
    elif bars_mode == "sido":
        bars = [{"label": b.short_sido(p) or p, "n": c} for p, c in Counter(p.get("sido") or "전국" for p in hit).most_common(3)]
        bt = "많은 지역"
    else:
        bars = [{"label": k, "n": c} for k, c in Counter(x for p in hit for x in (p.get("life_cycle") or [])).most_common(3)]
        bt = "많은 대상"
    cash = sum(1 for p in opens if p.get("support_type") == "현금지급")
    always = sum(1 for p in hit if p.get("is_always_on"))
    facts = [f"사업 수: **{b.n(len(hit))}건** (전체의 {b.pct(len(hit), total)}%)",
             f"지금 신청 가능: **{b.n(len(opens))}건** (상시 접수 {b.n(always)}건)",
             f"현금 지급: {b.n(cash)}건" if cash else "현금 지급 사업: 없음"]
    if bars:
        facts.append(f"{bt}: " + ", ".join(f"{x['label']} {b.n(x['n'])}건" for x in bars[:3]))
    return {"key": key, "name": name, "n": len(hit), "n_open": len(opens), "n90": None, "orgs": len({p.get("org_name") for p in hit if p.get("org_name")}),
            "win_med": None, "by_month": [], "bars": {"title": f"{bt} (사업 수)", "items": bars}, "facts": facts, "desc": "",
            "link": link, "link_label": link_label, "cash": cash, "always": always}


def welfare_region_items(rows: list[dict], level="sido") -> list[dict]:
    groups = defaultdict(list)
    for p in rows:
        if level == "sido":
            if p.get("sido"):
                groups[p["sido"]].append(p)
        else:
            if p.get("sido") and p.get("sigungu"):
                groups[(p["sido"], p["sigungu"])].append(p)
    out = []
    for k, hit in sorted(groups.items(), key=lambda kv: -len(kv[1]))[:10]:
        if level == "sido":
            out.append(welfare_item(k, b.short_sido(k) or k, hit, len(rows), f"/?sido={k}", f"{b.short_sido(k)} 지원사업 찾기", "topic"))
        else:
            sido, sg = k
            out.append(welfare_item(f"{sido} {sg}", f"{b.short_sido(sido)} {sg}", hit, len(rows), f"/?sido={sido}&sigungu={sg}", f"{sg} 지원사업 찾기", "topic"))
    return out


def welfare_facet_items(rows: list[dict], facet: str) -> list[dict]:
    groups = defaultdict(list)
    for p in rows:
        vals = p.get(facet) or []
        if isinstance(vals, str):
            vals = [vals]
        for v in vals:
            groups[v].append(p)
    out = []
    for k, hit in sorted(groups.items(), key=lambda kv: -len(kv[1]))[:10]:
        out.append(welfare_item(k, k, hit, len(rows), f"/?q={k}", f"{k} 지원사업 찾기", "sido"))
    return out


# ── 자격증 ────────────────────────────────────────────────
def license_items_rank(stats: list[dict], items: dict, year: int, series_filter: str | None, metric: str) -> tuple[dict, list[dict]]:
    """metric: applicants(필기 응시자 많은) · pass_high(실기 합격률 높은) · pass_low(낮은). 응시자 2,000명 이상만 순위."""
    by_code: dict[str, dict] = defaultdict(dict)
    for s in stats:
        if s["year"] == year:
            by_code[s["code"]][s["stage"]] = s
    cands = []
    for code, st in by_code.items():
        it = items.get(code)
        if not it or (series_filter and series_filter not in (it.get("series") or "")):
            continue
        w, p = st.get("필기"), st.get("실기")
        app = int((w or p or {}).get("applicants") or 0)
        if app < 2000:
            continue
        cands.append({"code": code, "name": it["name"], "series": it.get("series") or "", "field": it.get("field") or "",
                      "app": app, "w_rate": float(w["pass_rate"]) if w and w.get("pass_rate") is not None else None,
                      "p_rate": float(p["pass_rate"]) if p and p.get("pass_rate") is not None else None,
                      "passers": int((p or w or {}).get("passers") or 0)})
    key = {"applicants": lambda c: -c["app"], "pass_high": lambda c: -(c["p_rate"] or 0), "pass_low": lambda c: (c["p_rate"] if c["p_rate"] is not None else 999)}[metric]
    top = sorted([c for c in cands if metric == "applicants" or c["p_rate"] is not None], key=key)[:10]
    total_app = sum(c["app"] for c in cands)
    out = []
    for c in top:
        facts = [f"{year}년 필기 응시자: **{b.n(c['app'])}명**",
                 f"필기 합격률: **{int(c['w_rate'])}%**" if c["w_rate"] is not None else "필기 합격률: 자료 없음",
                 f"실기 합격률: **{int(c['p_rate'])}%**" if c["p_rate"] is not None else "실기 합격률: 자료 없음",
                 f"등급·분야: {c['series']} · {c['field']}"]
        yrs = sorted({s["year"] for s in stats if s["code"] == c["code"]})
        trend = [{"m": f"{y}-01", "n": int(next((s for s in stats if s["code"] == c["code"] and s["year"] == y and s["stage"] == "필기"), {}).get("applicants") or 0)} for y in yrs]
        out.append({"key": c["code"], "name": c["name"], "n": c["app"], "n_open": None, "n90": None, "orgs": None, "win_med": None,
                    "by_month": trend, "bars": {"title": "합격률(%)", "items": [{"label": "필기", "n": int(c["w_rate"] or 0)}, {"label": "실기", "n": int(c["p_rate"] or 0)}]},
                    "facts": facts, "desc": "", "link": f"/license/{c['code']}", "link_label": f"{c['name']} 시험 일정·합격률 보기",
                    "w_rate": c["w_rate"], "p_rate": c["p_rate"], "series": c["series"], "field": c["field"]})
    ov = {"n_total": total_app, "n_prev": 0, "n_open": 0, "today": "", "unit": "명",
          "facts": [f"{year}년 큐넷 수험자 동향에 잡힌 종목: **{b.n(len(by_code))}개**", f"응시자 2,000명 이상 종목: {b.n(len(cands))}개",
                    f"그 종목들의 필기 응시자 합계: **{b.n(total_app)}명**"],
          "bars": {"title": "등급별 종목 수(응시자 2,000명 이상)", "items": [{"label": k, "n": c} for k, c in Counter(c["series"] for c in cands).most_common(4)]}}
    return ov, out


# ── 주제 등록부 ───────────────────────────────────────────
def _jobs_ctx(d: Data):
    recent, prev = split_recent(d.jobs(), d.today)
    return recent, prev


def t_keyword(groups, label, hire=None, link_prefix="/jobs/q/"):
    def run(d: Data):
        recent, prev = _jobs_ctx(d)
        rows = [r for r in recent if (hire is None or r.get("hire") in hire)]
        prev_rows = prev if hire is None else None
        ov = job_overview(rows, prev_rows if prev_rows is not None else 0, d.today, label)
        return ov, keyword_items(groups, rows, d.today, link_prefix)
    return run


def t_org(label, flt=None):
    def run(d: Data):
        recent, prev = _jobs_ctx(d)
        rows = [r for r in recent if flt is None or flt(r)]
        return job_overview(rows, 0 if flt else prev, d.today, label), org_items(rows, d.today)
    return run


def t_region(label, flt=None):
    def run(d: Data):
        recent, prev = _jobs_ctx(d)
        rows = [r for r in recent if flt is None or flt(r)]
        return job_overview(rows, 0 if flt else prev, d.today, label), region_items(rows, d.today)
    return run


def t_window(label, longest=False):
    def run(d: Data):
        recent, prev = _jobs_ctx(d)
        items = [i for i in keyword_items(b.ROLES, recent, d.today) if i["n"] >= 100 and i["win_med"] is not None]
        items.sort(key=lambda i: (-i["win_med"] if longest else i["win_med"], -i["n"]))
        return job_overview(recent, prev, d.today, label), items[:10]
    return run


def t_welfare(level=None, facet=None, label="지원사업", flt=None):
    def run(d: Data):
        rows = [p for p in d.programs() if flt is None or flt(p)]
        ov = welfare_overview(rows, d.today, label)
        items = welfare_region_items(rows, level) if level else welfare_facet_items(rows, facet)
        return ov, items
    return run


def t_license(series_filter, metric, label):
    def run(d: Data):
        stats, items = d.exams()
        year = max((s["year"] for s in stats), default=d.today.year - 1)
        ov, its = license_items_rank(stats, items, year, series_filter, metric)
        ov["today"] = d.today.isoformat(); ov["year"] = year; ov["label"] = label
        return ov, its
    return run


def _has(*words):
    return lambda r: any(w in (r.get("title") or "") for w in words)


def _org_has(*words):
    return lambda r: any(w in (r.get("org") or "") for w in words)


TOPICS: dict[str, dict] = {
    # 채용 — 낱말 묶음
    "civil":     {"entity": "keyword", "unit": "건", "name": "대한민국 공무 직군(직렬) TOP10", "title": "대한민국 공무원 많이 뽑는 직군 순위 TOP10 | 국가직·지방직 공고로 본 직렬별 채용 현황",
                  "what": "공무원 직렬", "source": "나라일터 국가직·지방직 공고", "run": t_keyword(CIVIL, "국가직·지방직 공무원", hire={"국가", "지자체"}), "notes": CIVIL_NOTES},
    "roles":     {"entity": "keyword", "unit": "건", "name": "공공기관 많이 뽑는 직무 TOP10", "title": "공공기관 취업 많이 뽑는 직무 순위 TOP10 | 최근 1년 공고로 본 직무별 채용 현황",
                  "what": "직무", "source": "나라일터·잡알리오 공고", "run": t_keyword(b.ROLES, "공공기관"), "notes": ROLE_NOTES},
    "medical":   {"entity": "keyword", "unit": "건", "name": "공공 의료직 TOP10", "title": "공공병원·보건소 많이 뽑는 의료 직종 순위 TOP10 | 면허별 채용 공고 현황",
                  "what": "의료 직종", "source": "나라일터·잡알리오 공고", "run": t_keyword(MEDICAL, "의료 직종")},
    "education": {"entity": "keyword", "unit": "건", "name": "교육청·학교 채용 직종 TOP10", "title": "교육청·학교 많이 뽑는 직종 순위 TOP10 | 기간제교사부터 교육공무직까지",
                  "what": "교육 분야 직종", "source": "나라일터 교육청 공고", "run": t_keyword(EDUCATION, "교육청·학교", hire={"교육"})},
    "tech":      {"entity": "keyword", "unit": "건", "name": "공공기관 기술직 TOP10", "title": "공공기관 많이 뽑는 기술 직종 순위 TOP10 | 자격증 하나로 지원 폭이 넓어지는 분야",
                  "what": "기술 직종", "source": "나라일터·잡알리오 공고", "run": t_keyword(TECH, "기술 직종")},
    "short-window": {"entity": "keyword", "unit": "건", "name": "접수 기간 짧은 직무 TOP10", "title": "공고 보면 바로 내야 하는 직무 순위 TOP10 | 접수 기간이 가장 짧은 공공기관 직무",
                  "what": "접수 기간이 짧은 직무", "source": "나라일터·잡알리오 공고", "run": t_window("공공기관"), "notes": ROLE_NOTES, "rank_by": "win_med"},
    "long-window": {"entity": "keyword", "unit": "건", "name": "접수 기간 긴 직무 TOP10", "title": "준비할 시간을 주는 직무 순위 TOP10 | 접수 기간이 가장 긴 공공기관 직무",
                  "what": "접수 기간이 긴 직무", "source": "나라일터·잡알리오 공고", "run": t_window("공공기관", longest=True), "notes": ROLE_NOTES, "rank_by": "win_med"},
    # 채용 — 기관
    "orgs":          {"entity": "org", "unit": "건", "name": "채용 공고 많이 낸 기관 TOP10", "title": "채용 공고 가장 많이 낸 공공기관 순위 TOP10 | 최근 1년 기관별 채용 현황", "what": "기관", "source": "나라일터·잡알리오 공고", "run": t_org("공공기관")},
    "orgs-national": {"entity": "org", "unit": "건", "name": "중앙부처 채용 TOP10", "title": "채용 공고 많이 낸 중앙부처·소속기관 순위 TOP10 | 국가직 채용 현황", "what": "중앙부처", "source": "나라일터 국가직 공고", "run": t_org("중앙부처", lambda r: r.get("hire") == "국가")},
    "orgs-public":   {"entity": "org", "unit": "건", "name": "공공기관(공사·공단) 채용 TOP10", "title": "채용 공고 많이 낸 공사·공단·출연기관 순위 TOP10", "what": "공공기관", "source": "잡알리오·나라일터 공고", "run": t_org("공공기관", lambda r: r.get("hire") == "공공")},
    "orgs-local":    {"entity": "org", "unit": "건", "name": "지자체 채용 TOP10", "title": "채용 공고 많이 낸 지방자치단체 순위 TOP10 | 지방직 채용 현황", "what": "지자체", "source": "나라일터 지방직 공고", "run": t_org("지자체", lambda r: r.get("hire") == "지자체")},
    "orgs-edu":      {"entity": "org", "unit": "건", "name": "교육청·학교 채용 TOP10", "title": "채용 공고 많이 낸 교육청·학교 순위 TOP10", "what": "교육청·학교", "source": "나라일터 교육청 공고", "run": t_org("교육청·학교", lambda r: r.get("hire") == "교육")},
    "orgs-intern":   {"entity": "org", "unit": "건", "name": "청년인턴 많이 뽑는 기관 TOP10", "title": "청년인턴 많이 뽑는 공공기관 순위 TOP10 | 체험형 인턴 공고 현황", "what": "청년인턴 채용 기관", "source": "나라일터·잡알리오 공고", "run": t_org("청년인턴", _has("인턴", "체험형"))},
    "orgs-nurse":    {"entity": "org", "unit": "건", "name": "간호사 많이 뽑는 기관 TOP10", "title": "간호사 많이 뽑는 공공병원·기관 순위 TOP10", "what": "간호사 채용 기관", "source": "나라일터·잡알리오 공고", "run": t_org("간호사", _has("간호"))},
    "orgs-hospital": {"entity": "org", "unit": "건", "name": "공공병원 채용 TOP10", "title": "채용 공고 많이 낸 공공병원·의료원 순위 TOP10", "what": "공공병원", "source": "나라일터·잡알리오 공고", "run": t_org("공공병원", _org_has("병원", "의료원", "보건", "혈액원"))},
    "orgs-research": {"entity": "org", "unit": "건", "name": "연구기관 채용 TOP10", "title": "채용 공고 많이 낸 연구기관 순위 TOP10 | 연구직·연구원 채용 현황", "what": "연구기관", "source": "나라일터·잡알리오 공고", "run": t_org("연구기관", _org_has("연구", "과학", "시험"))},
    # 채용 — 지역
    "regions":      {"entity": "region", "unit": "건", "name": "채용 공고 많은 지역 TOP10", "title": "공공기관 채용 공고 많은 지역 순위 TOP10 | 시·도별 채용 현황", "what": "시·도", "source": "나라일터·잡알리오 공고", "run": t_region("공공기관")},
    "regions-open": {"entity": "region", "unit": "건", "name": "지금 접수 중 공고 많은 지역 TOP10", "title": "지금 지원할 수 있는 공공기관 공고가 많은 지역 순위 TOP10", "what": "시·도", "source": "나라일터·잡알리오 공고", "run": t_region("접수 중", lambda r: bool(r.get("end_date")) and r["end_date"] >= dt.date.today().isoformat())},
    "regions-public": {"entity": "region", "unit": "건", "name": "공공기관 채용 많은 지역 TOP10", "title": "공사·공단 채용 공고 많은 지역 순위 TOP10", "what": "시·도", "source": "잡알리오·나라일터 공고", "run": t_region("공공기관(공사·공단)", lambda r: r.get("hire") == "공공")},
    # 지원사업
    "welfare-sido":    {"entity": "welfare_region", "unit": "건", "name": "지원사업 많은 시·도 TOP10", "title": "복지·지원사업 많은 시·도 순위 TOP10 | 지역별 정부·지자체 지원 현황", "what": "시·도", "source": f"{BRAND} 지원사업 자료(복지로·기업마당 등)", "run": t_welfare(level="sido")},
    "welfare-sigungu": {"entity": "welfare_region", "unit": "건", "name": "지원사업 많은 시·군·구 TOP10", "title": "복지·지원사업 많은 시·군·구 순위 TOP10 | 우리 동네 지원 현황", "what": "시·군·구", "source": f"{BRAND} 지원사업 자료", "run": t_welfare(level="sigungu")},
    "welfare-topic":   {"entity": "welfare_topic", "unit": "건", "name": "지원 분야 TOP10", "title": "정부·지자체 지원사업 많은 분야 순위 TOP10 | 서민금융부터 주거까지", "what": "분야", "source": f"{BRAND} 지원사업 자료", "run": t_welfare(facet="topics")},
    "welfare-life":    {"entity": "welfare_topic", "unit": "건", "name": "대상별 지원사업 TOP", "title": "누가 가장 많은 지원을 받을 수 있나 | 생애주기별 지원사업 순위", "what": "대상", "source": f"{BRAND} 지원사업 자료", "run": t_welfare(facet="life_cycle")},
    "welfare-youth-sido": {"entity": "welfare_region", "unit": "건", "name": "청년 지원사업 많은 시·도 TOP10", "title": "청년 지원사업 많은 시·도 순위 TOP10 | 지역별 청년 정책 현황", "what": "시·도", "source": f"{BRAND} 지원사업 자료", "run": t_welfare(level="sido", label="청년 지원사업", flt=lambda p: "청년" in (p.get("life_cycle") or []))},
    "welfare-cash-sido":  {"entity": "welfare_region", "unit": "건", "name": "현금 지원 많은 시·도 TOP10", "title": "현금으로 주는 지원사업 많은 시·도 순위 TOP10", "what": "시·도", "source": f"{BRAND} 지원사업 자료", "run": t_welfare(level="sido", label="현금 지급 사업", flt=lambda p: p.get("support_type") == "현금지급")},
    "welfare-always-sido": {"entity": "welfare_region", "unit": "건", "name": "상시 접수 사업 많은 시·도 TOP10", "title": "언제든 신청할 수 있는 상시 지원사업 많은 시·도 순위 TOP10", "what": "시·도", "source": f"{BRAND} 지원사업 자료", "run": t_welfare(level="sido", label="상시 접수 사업", flt=lambda p: bool(p.get("is_always_on")))},
    "biz-field":       {"entity": "welfare_topic", "unit": "건", "name": "기업지원 분야 TOP", "title": "중소기업·소상공인 지원사업 많은 분야 순위 | 경영·기술·수출·금융", "what": "분야", "source": f"{BRAND} 기업지원 자료(기업마당)", "run": t_welfare(facet="biz_field", label="기업지원 사업", flt=lambda p: p.get("kind") == "business")},
    # 자격증
    "license-applicants": {"entity": "license", "unit": "명", "name": "응시자 많은 국가자격증 TOP10", "title": "응시자가 가장 많은 국가자격증 순위 TOP10 | 큐넷 수험자 동향으로 본 인기 자격증", "what": "자격증", "source": "큐넷 수험자 동향", "run": t_license(None, "applicants", "전체")},
    "license-craft-easy": {"entity": "license", "unit": "명", "name": "합격률 높은 기능사 TOP10", "title": "실기 합격률 높은 기능사 자격증 순위 TOP10 | 도전하기 쉬운 국가기술자격", "what": "기능사 종목", "source": "큐넷 수험자 동향", "run": t_license("기능사", "pass_high", "기능사")},
    "license-hard":       {"entity": "license", "unit": "명", "name": "합격률 낮은 자격증 TOP10", "title": "실기 합격률이 가장 낮은 국가자격증 순위 TOP10 | 고비가 큰 종목", "what": "자격증", "source": "큐넷 수험자 동향", "run": t_license(None, "pass_low", "전체")},
    "license-engineer":   {"entity": "license", "unit": "명", "name": "응시자 많은 기사 자격증 TOP10", "title": "응시자 많은 기사 자격증 순위 TOP10 | 취업에 바로 쓰는 국가기술자격", "what": "기사 종목", "source": "큐넷 수험자 동향", "run": t_license("기사", "applicants", "기사")},
}


# ── 글 쓰기(jiwon) ────────────────────────────────────────
TIPS_BY_ENTITY = {
    "keyword": ["공고 수가 많다고 자리가 많은 것은 아닙니다. 같은 기관이 한 명씩 자주 올리는 직무는 [기관별 채용](/jobs/org)에서 그 기관의 주기를 먼저 봅니다.",
                "면허·자격이 지원 자격인 직무는 공고 수는 적어도 경쟁이 덜합니다. 자격이 있다면 [자격증 시험](/license)에서 그 자격을 적은 공고를 함께 봅니다.",
                "접수 기간이 짧은 직무는 공고를 본 날 서류를 내야 합니다. 공고 쪽 **저장** 단추로 모아 두고 아침마다 확인하세요.",
                "자기소개서·직무수행계획서는 [기관별 작성 가이드](/jobs/guide)에 공고문에서 뽑은 항목이 정리돼 있습니다."],
    "org": ["공고를 자주 내는 기관은 같은 자리를 해마다 비슷한 시기에 다시 뽑습니다. 기관 쪽의 지난 공고에서 시기와 요건을 미리 익혀 두세요.",
            "기관마다 자기소개서 항목이 다릅니다. [기관별 작성 가이드](/jobs/guide)에서 그 기관이 묻는 것을 확인하세요.",
            "한 기관의 공고가 많다는 것은 결원이 잦다는 뜻이기도 합니다. 근무 조건(계약 기간·근무지)을 공고 본문에서 꼭 보세요.",
            "관심 기관은 [기관별 채용](/jobs/org)에서 저장해 두면 새 공고가 뜰 때 바로 볼 수 있습니다."],
    "region": ["'전국'으로 올라온 공고는 본사 채용이거나 근무지를 특정하지 않은 것이라 지역 순위에서 뺐습니다. 실제 근무지는 공고 본문이 기준입니다.",
               "지역 쪽에서 고용 형태(국가·지자체·공공·교육)로 걸러 보면 내가 노릴 자리가 어느 쪽에 많은지 보입니다.",
               "교육청 공고(기간제교사·교육공무직)가 많은 지역은 접수 기간이 짧은 공고가 많으니 매일 확인이 필요합니다.",
               "지역별 접수 중 공고는 [채용 공고](/jobs)에서 지역을 고르면 바로 봅니다."],
    "welfare_region": ["사업 수가 많다고 받을 수 있는 돈이 많은 것은 아닙니다. 조건(나이·소득·가구)을 넣어 내게 해당되는 것만 추려 보세요.",
                       "상시 접수 사업은 예산이 소진되면 일찍 닫히기도 합니다. 신청 가능 표시가 있을 때 바로 신청하세요.",
                       "같은 이름의 사업이라도 시·군·구마다 금액과 조건이 다릅니다. 내 주소지 기준으로 다시 확인하세요.",
                       f"조건을 넣으면 해당될 수 있는 사업을 [{BRAND}]({SITE})이 한 번에 찾아 줍니다."],
    "welfare_topic": ["분야 이름은 넓습니다. 분야 안에서 내 상황(청년·신혼·한부모 등)에 맞는 사업을 다시 걸러야 합니다.",
                      "현금 지급과 바우처·서비스는 체감이 다릅니다. 지원 방식을 함께 보세요.",
                      "접수 기간이 있는 사업은 마감 2~3일 전에 서류를 내는 편이 안전합니다.",
                      f"분야별 사업은 [{BRAND}]({SITE})에서 분야를 고르거나 검색하면 바로 봅니다."],
    "license": ["응시자가 많은 종목은 교재·강의가 풍부한 대신 가산점 효과는 작습니다. 채용 공고가 그 자격을 적는지 먼저 확인하세요.",
                "국가기술자격은 필기 합격 후 2년 안에 실기를 여러 번 볼 수 있습니다. 고비가 실기인 종목은 실기 준비에 시간을 더 두세요.",
                "상시 시험 종목은 큐넷에서 날짜를 고를 수 있습니다. 정기 시험 종목은 연초에 한 해 일정을 확인하세요.",
                "종목별 일정·합격률·같은 분야 종목은 [자격증 시험](/license)에서 봅니다."],
}


ROTATION_START = dt.date(2026, 10, 18)   # 기획표 첫날. 표에 없는 날은 이 날부터 센 날수로 주제를 돌려 쓴다


def plan_for(date: dt.date) -> dict | None:
    """그날 주제. 기획표(top10_plan.json)에 있으면 그것, 없으면 기획표 순서대로 31개 주제를 끝없이 돌린다.
    한 주제는 31일마다 돌아오고 slug 가 월 단위라 달이 바뀌면 새 글, 같은 달이면 고쳐 쓴다."""
    plan = json.loads(PLAN_FILE.read_text(encoding="utf-8"))
    hit = next((p for p in plan if p["date"] == date.isoformat()), None)
    if hit:
        return hit
    order = []
    for p in plan:
        if p["topic"] and p["topic"] not in order:      # topic "" 는 '그날은 연재 쉼'(다른 글이 나간다)
            order.append(p["topic"])
    order += [k for k in TOPICS if k not in order]
    if not order or date < ROTATION_START:
        return None
    return {"date": date.isoformat(), "topic": order[(date - ROTATION_START).days % len(order)], "rotation": True}


def write(topic_key: str, ov: dict, items: list[dict], today: dt.date) -> dict:
    T = TOPICS[topic_key]
    ym = today.strftime("%Y-%m")
    items = items[:10]
    unit = T["unit"]
    entity = T["entity"]
    top = items[0]
    notes = T.get("notes") or {}
    for it in items:
        it["desc"] = it.get("desc") or notes.get(it["key"], "")
    total = int(ov.get("n_total") or 0)
    top3 = b.pct(sum(i["n"] for i in items[:3]), total) if total else None

    title = T["title"]
    what = T["what"]
    summary = (f"{T['source']}를 {BRAND}이 세어 {what} {len(items)}개를 순위로 정리했습니다. 1위는 {top['name']} {b.n(top['n'])}{unit}. "
               f"항목마다 숫자와 요건, 지금 할 수 있는 것을 적었습니다.")
    toc = [("now", "현황은?")] + [(f"r{i+1}", f"{i+1}위 {it['name']}") for i, it in enumerate(items)] + [("compare", "한눈에 비교"), ("howto", "이렇게 보세요")]
    blocks: list[dict] = []
    blocks.append(b.P(f"**{b.kdate(today.isoformat())}** 기준, {T['source']}를 {BRAND}이 모아 {what}별로 세었습니다. "
                      + (f"전체 **{b.n(total)}{unit}** 가운데 상위 세 항목이 {top3}%입니다." if top3 is not None else "")))
    blocks.append(b.P({"keyword": "공고 제목의 낱말로 나눴기 때문에 한 공고가 두 항목에 들 수 있고, 채용 인원이 아니라 공고 건수입니다.",
                       "org": "기관명은 공고에 적힌 그대로 묶었습니다. 같은 기관의 지사·사무소가 따로 올린 공고는 따로 셉니다. 채용 인원이 아니라 공고 건수입니다.",
                       "region": "공고의 근무 지역(시·도) 기준입니다. '전국'은 뺐습니다. 채용 인원이 아니라 공고 건수입니다.",
                       "welfare_region": "지역은 사업을 운영하는 지자체 기준입니다. 전국 단위 사업은 뺐습니다.",
                       "welfare_topic": "한 사업이 여러 분야·대상에 들 수 있습니다. 사업 수이며 지원 금액이 아닙니다.",
                       "license": "큐넷 수험자 동향의 최근 연도 숫자입니다. 응시자 2,000명 이상인 종목만 순위에 넣었습니다."}[entity]))
    # 현황
    blocks.append(b.H2("현황은?", "now"))
    blocks.append(b.LIST(ov["facts"]))
    if ov.get("bars", {}).get("items"):
        blocks.append(b.BARS(ov["bars"]["items"], unit=unit))
    if ov.get("by_month"):
        blocks.append(b.BARS([{"label": f"{int(x['m'].split('-')[1])}월", "n": x["n"]} for x in ov["by_month"]], unit=unit))
    # 항목
    for i, it in enumerate(items):
        blocks.append(b.H2(f"{i+1}위 {it['name']}", f"r{i+1}"))
        blocks.append(b.LIST(it["facts"]))
        if it.get("desc"):
            blocks.append(b.P(it["desc"]))
        hard = hard_for(topic_key, it["key"])
        if hard:
            concepts = ", ".join(f"[{PSY[k]['name']}]({PSY[k]['href']})" for k in hard["psy"] if k in PSY)
            blocks.append(b.P(f"**어려운 점.** {hard['hard']} 관련 심리 개념: {concepts}."))
        if it.get("n90") is not None and it["n"]:
            s90 = b.pct(it["n90"], it["n"])
            blocks.append(b.P(f"최근 석 달에 {b.n(it['n90'])}건({s90}%)이 올라와 " + ("요즘 더 활발합니다." if s90 >= 30 else "고른 편입니다." if s90 >= 20 else "최근엔 뜸한 편입니다.")))
        blocks.append(b.LINKS([{"href": it["link"], "label": it["link_label"]}]))
    # 비교
    blocks.append(b.H2("한눈에 비교", "compare"))
    head = {"keyword": ["순위", what, f"최근 12개월", "접수 중", "기관 수", "접수 기간"],
            "org": ["순위", "기관", "최근 12개월", "접수 중", "주로 뽑는 직무", "접수 기간"],
            "region": ["순위", "지역", "최근 12개월", "접수 중", "자주 뽑는 기관", "접수 기간"],
            "welfare_region": ["순위", "지역", "사업 수", "신청 가능", "상시 접수", "현금 지급"],
            "welfare_topic": ["순위", what, "사업 수", "신청 가능", "상시 접수", "현금 지급"],
            "license": ["순위", "종목", "필기 응시자", "필기 합격률", "실기 합격률", "등급"]}[entity]
    rows = []
    for i, it in enumerate(items):
        link = f"[{it['name']}]({it['link']})"
        if entity in ("keyword",):
            rows.append([f"{i+1}위", link, f"{b.n(it['n'])}건", f"{b.n(it['n_open'])}건", f"{b.n(it['orgs'])}곳", f"{int(it['win_med'])}일" if it.get("win_med") is not None else "-"])
        elif entity in ("org", "region"):
            first = it["bars"]["items"][0]["label"] if it["bars"]["items"] else "-"
            rows.append([f"{i+1}위", link, f"{b.n(it['n'])}건", f"{b.n(it['n_open'])}건", first, f"{int(it['win_med'])}일" if it.get("win_med") is not None else "-"])
        elif entity.startswith("welfare"):
            rows.append([f"{i+1}위", link, f"{b.n(it['n'])}건", f"{b.n(it['n_open'])}건", f"{b.n(it['always'])}건", f"{b.n(it['cash'])}건"])
        else:
            rows.append([f"{i+1}위", link, f"{b.n(it['n'])}명", f"{int(it['w_rate'])}%" if it.get("w_rate") is not None else "-",
                         f"{int(it['p_rate'])}%" if it.get("p_rate") is not None else "-", it.get("series") or "-"])
    blocks.append(b.TABLE(head, rows))
    blocks.append(b.BARS([{"label": it["name"], "n": it["n"]} for it in items], unit=unit))
    blocks.append(b.H2("이렇게 보세요", "howto"))
    blocks.append(b.LIST(TIPS_BY_ENTITY[entity]))
    blocks.append(b.NOTE(f"{today.isoformat()} 기준, {T['source']}를 {BRAND}이 모아 센 숫자입니다. "
                         + ("공고 건수이며 채용 인원이 아닙니다. 요건은 공고 본문이 기준입니다." if entity in ("keyword", "org", "region") else
                            "사업 수이며 지원 금액이 아닙니다. 조건은 각 사업 안내가 기준입니다." if entity.startswith("welfare") else
                            "합격률은 응시자 대비 합격자입니다. 일정은 큐넷 공고가 기준입니다.")))
    keywords = [BRAND, T["name"], f"{what} 순위", "TOP10", f"{today.year}년"] + [it["name"] for it in items[:4]] + (["직무별 어려운 점", "번아웃"] if entity == "keyword" and T.get("notes") else [])
    return {"slug": f"top10-{topic_key}-{ym}", "kind": "role" if entity in ("keyword", "org", "region") else "topic" if entity.startswith("welfare") else "license",
            "subject": f"top10-{topic_key}-{ym}", "title": title, "summary": summary, "keywords": keywords,
            "body": [{"type": "toc", "items": [{"id": i, "label": l} for i, l in toc]}] + blocks,
            "stats": {"topic": topic_key, "entity": entity, "unit": unit, "what": what, "source": T["source"], "name": T["name"],
                      "overview": ov, "items": items}}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--topic", choices=sorted(TOPICS))
    ap.add_argument("--date", help="기획표에서 이 날짜(YYYY-MM-DD)의 주제")
    ap.add_argument("--today", action="store_true", help="기획표에서 오늘(KST) 주제")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--pick", action="store_true", help="그날 주제 키만 찍는다(기획표 → 없으면 순환). 워크플로가 쓴다")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    if a.pick:
        d = dt.date.fromisoformat(a.date) if a.date else b.today()
        p = plan_for(d)
        print(p["topic"] if p else "")
        return 0
    if a.list:
        for k, t in TOPICS.items():
            print(f"{k:22} {t['entity']:15} {t['name']}")
        return 0
    today = b.today()
    topic = a.topic
    if not topic:
        d = dt.date.fromisoformat(a.date) if a.date else today
        p = plan_for(d)
        if not p or not p.get("topic"):
            print(f"{d} 에 잡힌 주제가 없다(top10_plan.json" + (f": {p.get('note', '')}" if p else "") + ")")
            return 3
        topic = p["topic"]
    from supabase import create_client
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    data = Data(sb, today)
    ov, items = TOPICS[topic]["run"](data)
    if len(items) < 5:
        print(f"{topic}: 항목이 {len(items)}개뿐이라 쓰지 않는다", file=sys.stderr)
        return 2
    post = write(topic, ov, items, today)
    print(f"{post['slug']}: {post['title']}")
    if a.dry:
        print(json.dumps({k: post[k] for k in ("slug", "title", "summary")}, ensure_ascii=False, indent=1))
        for it in items:
            print(f"  - {it['name']}: {it['n']}{post['stats']['unit']} | " + " / ".join(it["facts"][:3]))
        return 0
    row = {k: post[k] for k in ("slug", "kind", "subject", "title", "summary", "keywords", "body", "stats")}
    if not (sb.table("blog_posts").select("slug").eq("slug", post["slug"]).execute().data or []):
        row["published_at"] = today.isoformat()
    row["updated_at"] = "now()"
    sb.table("blog_posts").upsert(row, on_conflict="slug").execute()
    print(f"저장: {SITE}/story/{post['slug']}")
    print(f"SLUG={post['slug']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
