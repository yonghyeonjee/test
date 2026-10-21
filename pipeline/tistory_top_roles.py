"""
tistory_top_roles.py — 티스토리(abcfact)용 "많이 뽑는 직무 순위 TOP10" 글을 쓴다. 출처는 K나라지원(jiwon).

jiwon 의 blog_posts 글(blog_top_roles.py 가 쓴 jobs-top10-roles-YYYY-MM)의 stats 를 자료로 삼아, 티스토리 블로그의
순위 글 양식(들머리 → 목차 → 항목마다 제목·사진·요약 목록·설명 → 비교 표 → 정리 → 참고 문헌)으로 **다른 글**을 쓴다.
jiwon 글을 그대로 옮기지 않는다. 숫자마다 "출처: K나라지원" 링크를 달고 끝에 참고 문헌을 적는다.

tistory_publish.py --composer top10 이 이 모듈의 compose() 를 부른다. 돌려주는 모양은 blog_posts 행과 같다
(title/summary/keywords/body 블록). 사진(--images)은 들머리 뒤와 절마다 첫 블록 뒤에 tistory_publish 가 끼운다.
"""

from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import blog_daily as b  # noqa: E402
from blog_top_roles import NOTES, q_url, role_of, short_org  # noqa: E402

SITE = b.SITE
BRAND = b.BRAND
GOJOBS = "https://www.gojobs.go.kr"
ALIO = "https://job.alio.go.kr"

# 직무별 "이렇게 준비하세요" 한 줄. 일반적인 준비 방법만 적는다(기관별 세부 요건은 공고가 기준).
TIPS: dict[str, str] = {
    "public-worker": "공무직은 서류에서 거르는 요건이 낮은 대신 면접 배수가 큽니다. 같은 기관의 지난 공고를 읽어 그 기관이 무엇을 묻는지 먼저 파악하세요.",
    "term-official": "임기제는 경력 증명이 서류의 전부입니다. 공고의 '임용 예정 직무'와 내 경력을 한 줄씩 맞춘 직무수행계획서를 준비하세요.",
    "teacher-temp": "기간제교사는 학교가 직접 뽑아 접수가 며칠이면 끝납니다. 교육청 구인 게시판과 함께 매일 아침 새 공고를 확인하는 습관이 필요합니다.",
    "clerical": "행정·사무는 지원자가 가장 많이 몰립니다. 컴퓨터활용능력·워드 같은 자격과 공공기관 인턴·계약직 경력이 서류에서 차이를 만듭니다.",
    "lecturer": "강사는 과목별 자격과 강의 경력을 봅니다. 시간제라 여러 기관에 동시에 지원해 시간표를 채우는 사람이 많습니다.",
    "intern": "청년인턴은 나이와 미취업 요건만 맞으면 지원할 수 있습니다. 전환보다 경력 쌓기 목적이라면 하고 싶은 분야의 기관을 골라 지원하세요.",
    "research": "연구원은 전공과 학위가 먼저입니다. 과제 단위 계약이 많으니 연구 주제가 맞는 기관을 추려 두고 공고가 뜨면 바로 내세요.",
    "facility": "시설·전기·안전관리는 자격증이 곧 지원 자격입니다. 전기기능사·소방안전관리자 자격부터 갖추면 지원할 수 있는 공고가 크게 늘어납니다.",
    "postal": "집배원은 운전면허와 체력이 핵심입니다. 우체국별로 수시 공고가 나오니 집 근처 우체국 공고를 꾸준히 보세요.",
    "guard": "경비·방호는 신임교육 이수와 교대 근무 가능 여부를 봅니다. 청원경찰은 나이 요건이 있으니 공고의 응시 연령을 먼저 확인하세요.",
    "cook": "조리원은 자격 없이도 지원할 수 있지만 조리사 자격이 있으면 급여와 자리가 다릅니다. 학교 급식은 방학 기간 근무 조건을 꼭 보세요.",
    "cleaning": "환경미화는 경쟁률이 높고 단시간 근로 공고가 섞여 있습니다. 근무 시간과 고용 형태(무기계약·기간제)를 먼저 확인하세요.",
    "counsel": "상담직은 자격증 종류가 공고마다 다릅니다. 청소년상담사·직업상담사·사회복지사 중 어느 것을 요구하는지 보고 지원하세요.",
    "childcare": "보육·유아교육은 자격이 필수라 자격이 있다면 경쟁이 덜한 편입니다. 공립 유치원 방과후 과정 공고도 함께 보세요.",
    "driver": "운전원은 1종 대형 면허와 무사고 경력이 서류를 가릅니다. 버스·화물 운전 경력이 있으면 공고 본문에서 우대 항목을 확인하세요.",
    "doctor": "의사는 공공병원과 보훈병원이 수시로 뽑습니다. 과목이 맞으면 접수 기간이 긴 편이라 서류 준비 여유가 있습니다.",
    "it": "전산직은 정보처리기사와 운영 경력을 봅니다. 통계·데이터 기관 공고가 늘고 있으니 데이터 분석 경험을 정리해 두세요.",
    "librarian": "사서는 준사서 이상 자격이 필수입니다. 대학도서관과 공공도서관 공고가 따로 나오니 둘 다 챙겨 보세요.",
    "nurse": "간호사는 면허와 임상 경력이 기준입니다. 보건소·학교 보건실처럼 주간 근무 자리는 경쟁이 세니 공고를 보면 바로 내세요.",
    "nutrition": "영양사는 면허 소지자만 지원할 수 있어 공고 수에 비해 경쟁이 적은 편입니다. 학교와 병원 중 근무 조건을 비교해 고르세요.",
    "welfare": "사회복지·돌봄은 자격증 종류(사회복지사 1·2급, 요양보호사)를 공고마다 다르게 요구합니다. 자격 등급을 먼저 맞추세요.",
    "survey": "조사원은 현장 조사라 운전면허와 지역 거주 여부를 봅니다. 통계청 소속 기관 공고가 많으니 지역 사무소 공고를 확인하세요.",
    "youth": "청소년 지도·상담은 청소년지도사·상담사 자격이 핵심입니다. 지자체 청소년재단 공고가 많습니다.",
    "ta": "대학 조교는 해당 학과 전공자를 뽑습니다. 임기가 짧으니 다음 진로와 연결되는 학과를 고르세요.",
    "psy": "심리직은 임상심리사·상담심리사 자격을 봅니다. 법무부 소속 기관 공고가 많아 교정·보호 분야 경험이 도움이 됩니다.",
    "medtech": "임상병리·방사선은 면허가 필수이고 병원 경력을 우대합니다. 혈액원과 공공병원 공고를 함께 보세요.",
    "pharma": "약사는 면허 소지자만 지원할 수 있어 공고 수에 비해 경쟁이 낮습니다. 주말·야간 근무 조건을 확인하세요.",
    "therapy": "치료사는 면허와 재활 분야 경력을 봅니다. 특수학교와 보훈병원 공고가 꾸준합니다.",
    "lang": "통역·번역은 어학 성적과 실무 경력이 기준입니다. 외교부·관세청처럼 특정 기관에 몰려 있으니 그 기관 공고를 추적하세요.",
    "martial": "무도실무관은 무도 단증이 지원 자격입니다. 보호관찰소별 공고라 전국 어디든 갈 수 있는지 먼저 정하세요.",
}


GOJOBS_URL, ALIO_URL = "https://www.gojobs.go.kr", "https://job.alio.go.kr"


def src(label: str, href: str) -> dict:
    """출처 한 줄. 사이트 안 주소는 tistory_publish 가 절대 주소로 바꾼다."""
    return b.P(f"출처: [{label}]({href})")


def src_official(tail: str = "") -> dict:
    """출처는 원 자료(나라일터·잡알리오)로 링크하고 집계한 쪽은 글자로만 — 한 도메인으로 링크가 몰리지 않게."""
    return b.P(f"출처: [나라일터]({GOJOBS_URL}) · [잡알리오]({ALIO_URL}){tail} · 집계 {BRAND}")


def compose(post: dict) -> dict:
    """jiwon 글(blog_posts 행, stats 포함) → 티스토리용 글."""
    stats = post.get("stats") or {}
    ov, roles = stats.get("overview") or {}, (stats.get("roles") or [])[:10]
    if not ov or not roles:
        raise SystemExit(f"{post['slug']} 에 stats(overview/roles)가 없다 — blog_top_roles.py 로 쓴 글이어야 한다")
    today = dt.date.fromisoformat(ov["today"]) if ov.get("today") else b.today()
    origin = f"/story/{post['slug']}"
    n12, prev = int(ov["n12"]), int(ov.get("n12_prev") or 0)
    growth = (n12 - prev) * 100 // prev if prev else None
    hires = ov.get("open_by_hire") or []
    regions = ov.get("open_by_region") or []
    months = ov.get("by_month") or []
    peak = max(months[:-1] or months, key=lambda m: m["n"]) if months else None
    top = roles[0]

    title = f"공공기관 취업 많이 뽑는 직무 순위 TOP10 | {today.year}년 공공기관 채용 현황과 직무별 지원 요건 총정리"
    summary = (f"공공기관 취업을 준비 중이라면 어떤 직무가 자리가 많은지부터 알아야 합니다. 최근 1년 공고 {b.n(n12)}건을 분석한 "
               f"{BRAND} 자료를 바탕으로, 지금 접수 중인 공고 현황과 많이 뽑는 직무 10개의 요건·접수 기간·준비 방법을 정리했습니다.")

    toc = [("now", "공공기관 채용 현황은?")] + [(f"r{i+1}", f"{i+1}위 {r['name']}") for i, r in enumerate(roles)] \
        + [("compare", "직무 TOP10 비교"), ("wrap", "정리 — 어떤 직무를 노릴까"), ("refs", "참고 문헌")]
    blocks: list[dict] = []

    # 들머리 — 짧은 줄 몇 개
    blocks.append(b.P("공공기관 취업 준비를 시작하면 \"어느 직무로 가야 하나\"부터 막힙니다. 정규직 공채만 떠올리기 쉬운데, 실제 공고의 대부분은 공무직·임기제·기간제 같은 수시 채용입니다."))
    blocks.append(b.P(f"그래서 공고가 **실제로 많이 나오는 직무**를 세어 봤습니다. 자료는 인사혁신처 나라일터와 기획재정부 잡알리오에 올라온 공고 1년치를 {BRAND}이 매일 모아 센 것입니다. "
                      f"기준일은 {b.kdate(today.isoformat())}입니다."))
    blocks.append(b.P("순위마다 공고 수, 접수 중인 자리, 자주 뽑는 기관, 접수 기간, 필요한 자격과 준비 방법을 적었습니다. 원 자료 사이트는 절마다 출처 줄에 있고, 표와 숫자 전체는 참고 문헌의 원문에 있습니다."))
    blocks.append(b.P("채용 인원이 아니라 공고 건수이고, 공고 제목의 낱말로 직무를 나눈 것이라 한 공고가 두 직무에 들 수 있습니다. 그래도 어느 직무가 꾸준히 열리는지 보기에는 충분합니다."))

    # 현황
    blocks.append(b.H2("공공기관 채용 현황은?", "now"))
    blocks.append(b.LIST([
        f"최근 12개월 공고: **{b.n(n12)}건**" + (f" (그 전 12개월보다 {abs(growth)}% {'증가' if growth >= 0 else '감소'})" if growth is not None else ""),
        f"공고를 낸 기관: **{b.n(ov['orgs12'])}곳**",
        f"지금 접수 중: **{b.n(ov['open_now'])}건** · 최근 30일 새 공고 {b.n(ov['new30'])}건",
        ("고용 형태(접수 중): " + ", ".join(f"{h['hire']} {b.n(h['n'])}건" for h in hires[:4])) if hires else "",
        ("지역(접수 중): " + ", ".join(f"{b.short_sido(r['region'])} {b.n(r['n'])}건" for r in regions[:4])) if regions else "",
    ]))
    blocks[-1]["items"] = [x for x in blocks[-1]["items"] if x]
    blocks.append(b.P(f"공고는 한 해 내내 나오지만 몰리는 달이 있습니다."
                      + (f" 지난 1년은 **{int(peak['m'].split('-')[1])}월**이 {b.n(peak['n'])}건으로 가장 많았습니다." if peak else "")
                      + " 연초와 하반기 초에 공고가 늘어나니, 그 전에 서류 틀을 만들어 두면 접수 기간이 짧은 공고에도 바로 낼 수 있습니다."))
    if months:
        blocks.append(b.BARS([{"label": f"{int(x['m'].split('-')[1])}월", "n": x["n"]} for x in months]))
    blocks.append(src_official(f" · {b.kdate(today.isoformat())} 기준"))

    # 1위 … 10위
    for i, r in enumerate(roles):
        key = r["key"]
        orgs = r.get("top_orgs") or []
        regs = [x for x in (r.get("top_regions") or []) if x["region"] != "전국"]
        share = b.pct(r["n12"], n12)
        share90 = b.pct(r["n90"], r["n12"])
        note = NOTES.get(key, "")
        req = note.split(". ")[1].rstrip(".") if note.count(". ") >= 1 else "공고 본문의 응시 자격 확인"
        blocks.append(b.H2(f"{i+1}위 {r['name']} — 최근 1년 공고 {b.n(r['n12'])}건", f"r{i+1}"))
        spec = [
            f"공고 수: **{b.n(r['n12'])}건** (전체의 {share}%)",
            f"지금 접수 중: **{b.n(r['n_open'])}건**" if r["n_open"] else "지금 접수 중: 없음 (시기를 기다려야 합니다)",
            "자주 뽑는 기관: " + (", ".join(f"{short_org(o['org'])}({b.n(o['n'])}건)" for o in orgs[:2]) if orgs else f"{b.n(r['orgs'])}곳에 고르게 분산"),
        ]
        if regs:
            spec.append("공고가 많은 지역: " + ", ".join(f"{b.short_sido(x['region'])} {b.n(x['n'])}건" for x in regs[:2]))
        if r.get("win_med") is not None:
            spec.append(f"접수 기간: 보통 **{int(r['win_med'])}일**")
        spec.append(f"자격 요건: {req}")
        blocks.append(b.LIST(spec))
        if note:
            blocks.append(b.P(f"**어떤 일인가요?** {note}"))
        trend = (f"최근 석 달에만 {b.n(r['n90'])}건({share90}%)이 나와 지금이 지원하기 좋은 시기입니다." if share90 >= 30 else
                 f"최근 석 달에 {b.n(r['n90'])}건({share90}%)으로 한 해 내내 꾸준히 열리는 직무입니다." if share90 >= 20 else
                 f"최근 석 달에는 {b.n(r['n90'])}건({share90}%)으로 뜸한 편이라, 지난해 공고가 몰린 달을 보고 기다리는 편이 낫습니다.")
        blocks.append(b.P(f"**요즘 흐름.** {trend}"))
        blocks.append(b.P(f"**이렇게 준비하세요.** {TIPS.get(key, '공고 본문의 응시 자격과 우대 사항을 먼저 확인하고, 같은 기관의 지난 공고로 전형 방식을 파악하세요.')}"))
        blocks.append(src_official())

    # 비교
    blocks.append(b.H2("직무 TOP10 비교", "compare"))
    blocks.append(b.P("한눈에 비교하면 이렇습니다. 공고 수가 많은 직무일수록 접수 기간은 짧은 편이고, 면허·자격이 필요한 직무일수록 공고 수는 적지만 경쟁이 덜합니다."))
    blocks.append(b.TABLE(["순위", "직무", "최근 1년 공고", "접수 중", "접수 기간", "자격 요건"],
                          [[f"{i+1}위", r["name"], f"{b.n(r['n12'])}건", f"{b.n(r['n_open'])}건",
                            f"{int(r['win_med'])}일" if r.get("win_med") is not None else "-",
                            (NOTES.get(r["key"], "").split(". ")[1].rstrip(".") if NOTES.get(r["key"], "").count(". ") >= 1 else "-")]
                           for i, r in enumerate(roles)]))
    blocks.append(src_official(" · 표의 숫자 전체는 참고 문헌의 원문에"))

    # 정리
    blocks.append(b.H2("정리 — 어떤 직무를 노릴까", "wrap"))
    quick = [r["name"] for r in roles if r.get("win_med") is not None and r["win_med"] <= 7]
    blocks.append(b.LIST([
        f"**자격이 없다면** {top['name']}·행정·사무처럼 공고가 많은 직무부터 봅니다. 대신 지원자가 몰리니 같은 기관의 지난 공고로 전형을 미리 익혀야 합니다.",
        "**면허·자격이 있다면** 간호사·약사·사서·치료사처럼 자격이 지원 자격인 직무가 유리합니다. 공고 수는 적어도 경쟁이 덜합니다.",
        (f"**접수 기간이 짧은 직무**({', '.join(quick[:3])})는 공고를 본 날 서류를 내야 합니다. 매일 아침 새 공고를 확인하는 루틴이 합격보다 먼저입니다." if quick else
         "**접수 기간**은 직무마다 다르니 마감일보다 하루 먼저 내는 것을 원칙으로 하세요."),
        f"**기관별 주기**를 보면 다음 공고를 예측할 수 있습니다. 공공기관은 같은 자리를 해마다 비슷한 시기에 다시 뽑습니다.",
    ]))
    blocks.append(b.P("실제 지원은 공고를 낸 기관의 접수 창구에서 하고, 공고 원문은 나라일터·잡알리오에서 봅니다. 기관별 채용 이력과 자기소개서 항목 정리는 참고 문헌의 원문 글에 같이 있습니다."))

    # 참고 문헌
    blocks.append(b.H2("참고 문헌", "refs"))
    blocks.append(b.LINKS([
        {"href": origin, "label": f"{BRAND}, 「{post['title']}」 — 표·숫자 전체 ({today.isoformat()})"},
        {"href": GOJOBS, "label": "인사혁신처 나라일터 (원 자료)"},
        {"href": ALIO, "label": "기획재정부 잡알리오 (원 자료)"},
    ]))
    blocks.append(b.NOTE(f"숫자는 {today.isoformat()} 기준 {BRAND} 집계입니다. 공고 건수이며 채용 인원이 아닙니다. 직무 분류는 공고 제목의 낱말 기준이고, "
                         "자격 요건은 일반적인 경우를 적은 것이라 실제 지원 자격은 공고 본문이 기준입니다."))

    keywords = ["공공기관 취업", "공공기관 채용", "많이 뽑는 직무", "공무직 채용", "임기제공무원", "기간제교사", "공공기관 채용 현황",
                "직무 순위 TOP10", f"{today.year} 공공기관 채용", BRAND]
    return {**post, "title": title, "summary": summary, "keywords": keywords,
            "body": [{"type": "toc", "items": [{"id": i, "label": l} for i, l in toc]}] + blocks}


COMPOSERS = {"top10": compose}
