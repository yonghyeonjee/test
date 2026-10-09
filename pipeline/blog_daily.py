"""
blog_daily.py — 모아 둔 자료에서 매일 한 편씩 블로그 글을 만든다.

글감은 여섯 갈래를 돌아가며 고른다. 하루에 둘(--count 2)이면 세 갈래 건너 짝이 된다.
  topic   : 월세·전세·출산 같은 지원 주제 — 지금 신청할 수 있는 사업이 몇 건, 어디에, 누구에게
  org     : 기관 하나 — 언제 뽑고, 접수 기간은 얼마나 되고, 지금 접수 중인 것
  role    : 직무 하나 — 어느 기관이 자주 뽑고, 어느 지역에 많고, 언제 올라오나
  region  : 시·도 하나 — 복지 사업과 채용을 한 번에
  license : 자격증 종목 하나 — 해·단계별 합격률, 올해 남은 시험, 같은 분야 종목
  sigungu : 시·군·구 하나 — 그 동네 사업과 도 단위 사업, 그 지자체 채용

숫자는 전부 DB 함수(blog_*_stats)가 센다. 여기서는 그 숫자를 문장으로 옮기고,
기준(문턱)을 넘을 때만 시사점을 적는다. 숫자가 말하지 않는 것은 쓰지 않는다.

  python pipeline/blog_daily.py                 # 오늘 차례의 갈래에서 아직 안 쓴 글감 하나
  python pipeline/blog_daily.py --kind org      # 갈래 지정
  python pipeline/blog_daily.py --kind org --subject 한국농어촌공사
  python pipeline/blog_daily.py --count 2       # 오늘 차례 두 갈래(매일 돌리는 워크플로가 쓴다)
  python pipeline/blog_daily.py --dry           # DB 에 쓰지 않고 JSON 만 출력
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import time

KINDS = ["topic", "org", "role", "region", "license", "sigungu"]
SITE = "https://jiwon.knowhow-it.com"
BRAND = "K나라지원"

# ── 글감 목록 ────────────────────────────────────────────
TOPICS = [
    {"slug": "wolse-youth", "label": "청년 월세 지원", "q": ["월세|월세지원|임차료|주거비"], "who": "청년", "hub": "/housing/wolse/youth", "hub_label": "청년 월세·주거비 지원 모아보기", "search": "청년 월세"},
    {"slug": "jeonse-newlywed", "label": "신혼부부 전세 지원", "q": ["전세|전세자금|보증금"], "who": "신혼부부", "hub": "/housing/jeonse/newlywed", "hub_label": "신혼부부 전세 지원 모아보기", "search": "신혼부부 전세"},
    {"slug": "jeonse-youth", "label": "청년 전세 지원", "q": ["전세|전세자금|보증금"], "who": "청년", "hub": "/housing/jeonse/youth", "hub_label": "청년 전세 지원 모아보기", "search": "청년 전세"},
    {"slug": "birth", "label": "출산 지원금", "q": ["출산|출산지원|출산장려"], "who": None, "hub": "/topic/pregnancy", "hub_label": "임신·출산 분야 전체", "search": "출산"},
    {"slug": "childcare", "label": "육아·돌봄 지원", "q": ["육아|양육|돌봄|보육"], "who": None, "hub": "/?q=육아", "hub_label": "육아 지원 찾기", "search": "육아"},
    {"slug": "student-loan", "label": "학자금 대출 이자 지원", "q": ["학자금"], "who": None, "hub": "/money/student-loan", "hub_label": "학자금 이자지원 되는 지자체", "search": "학자금"},
    {"slug": "job-youth", "label": "청년 취업 지원", "q": ["취업|구직|일자리"], "who": "청년", "hub": "/topic/jobs", "hub_label": "일자리 분야 전체", "search": "청년 취업"},
    {"slug": "buy", "label": "주택 구입·내집마련 지원", "q": ["매매|주택구입|구입자금|디딤돌|내집마련"], "who": None, "hub": "/housing/buy/nohouse", "hub_label": "무주택 주택 구입 지원 모아보기", "search": "주택구입"},
    {"slug": "wolse-all", "label": "월세·주거비 지원", "q": ["월세|주거비|임차료"], "who": None, "hub": "/housing", "hub_label": "주거 지원 찾기", "search": "월세"},
    {"slug": "medical", "label": "의료비 지원", "q": ["의료비|진료비|치료비"], "who": None, "hub": "/topic/health", "hub_label": "건강·의료 분야 전체", "search": "의료비"},
    {"slug": "transport", "label": "교통비 지원", "q": ["교통비|교통카드|대중교통"], "who": None, "hub": "/?q=교통비", "hub_label": "교통비 지원 찾기", "search": "교통비"},
    {"slug": "energy", "label": "난방비·에너지 지원", "q": ["난방비|에너지|전기요금|가스요금"], "who": None, "hub": "/?q=난방비", "hub_label": "난방비 지원 찾기", "search": "난방비"},
    {"slug": "moving", "label": "이사비 지원", "q": ["이사비|이사비용|이주비"], "who": None, "hub": "/?q=이사비", "hub_label": "이사비 지원 찾기", "search": "이사비"},
    {"slug": "marriage", "label": "결혼 장려금", "q": ["결혼|혼인"], "who": None, "hub": "/?q=결혼", "hub_label": "결혼 지원 찾기", "search": "결혼"},
    {"slug": "startup-youth", "label": "청년 창업 지원", "q": ["창업"], "who": "청년", "hub": "/?tab=business&target=예비창업자", "hub_label": "예비창업자 지원사업 찾기", "search": "청년 창업"},
    {"slug": "single-parent", "label": "한부모 가정 지원", "q": ["한부모"], "who": None, "hub": "/?hh=한부모·조손", "hub_label": "한부모 가구 지원 찾기", "search": "한부모"},
    {"slug": "multichild", "label": "다자녀 가정 지원", "q": ["다자녀"], "who": None, "hub": "/?hh=다자녀", "hub_label": "다자녀 가구 지원 찾기", "search": "다자녀"},
    {"slug": "disability", "label": "장애인 지원", "q": ["장애인"], "who": None, "hub": "/?hh=장애인", "hub_label": "장애인 가구 지원 찾기", "search": "장애인"},
    {"slug": "elderly", "label": "어르신 지원", "q": ["노인|어르신|경로"], "who": None, "hub": "/?age=70", "hub_label": "어르신 지원 찾기", "search": "어르신"},
    {"slug": "newlywed-all", "label": "신혼부부 지원", "q": ["신혼"], "who": None, "hub": "/housing/jeonse/newlywed", "hub_label": "신혼부부 주거 지원 모아보기", "search": "신혼부부"},
]

# 직무. 제목에 든 낱말 목록(부분 일치). 정규식이 아니라 trigram 색인을 타는 ilike 다.
ROLES = [
    {"key": "nurse", "name": "간호사", "terms": ["간호사", "간호직", "간호 "]},
    {"key": "librarian", "name": "사서", "terms": ["사서"]},
    {"key": "cook", "name": "조리·급식", "terms": ["조리", "급식"]},
    {"key": "cleaning", "name": "환경미화", "terms": ["환경미화", "미화원", "청소"]},
    {"key": "driver", "name": "운전", "terms": ["운전"]},
    {"key": "guard", "name": "경비·방호", "terms": ["경비", "방호", "청원경찰"]},
    {"key": "it", "name": "전산·정보화", "terms": ["전산", "정보화", "정보보안", "데이터"]},
    {"key": "research", "name": "연구원", "terms": ["연구원", "연구직", "연구사", "연구관"]},
    {"key": "welfare", "name": "사회복지·돌봄", "terms": ["사회복지", "돌봄", "요양", "생활지도"]},
    {"key": "teacher-temp", "name": "기간제교사", "terms": ["기간제교사", "기간제 교사", "기간제교원", "기간제 교원", "계약제교원"]},
    {"key": "lecturer", "name": "강사", "terms": ["강사"]},
    {"key": "childcare", "name": "보육·유아교육", "terms": ["보육교사", "유치원", "어린이집"]},
    {"key": "counsel", "name": "상담", "terms": ["상담"]},
    {"key": "lang", "name": "통역·번역", "terms": ["통역", "번역"]},
    {"key": "clerical", "name": "행정·사무", "terms": ["행정", "사무"]},
    {"key": "intern", "name": "청년인턴", "terms": ["인턴", "체험형"]},
    {"key": "public-worker", "name": "공무직", "terms": ["공무직", "무기계약"]},
    {"key": "term-official", "name": "임기제공무원", "terms": ["임기제"]},
    {"key": "facility", "name": "시설·전기·안전관리", "terms": ["시설관리", "전기", "안전관리", "소방"]},
    {"key": "doctor", "name": "의사", "terms": ["의사", "진료", "전문의"]},
    {"key": "pharma", "name": "약사", "terms": ["약사", "약무"]},
    {"key": "nutrition", "name": "영양사", "terms": ["영양사"]},
    {"key": "therapy", "name": "물리·작업치료", "terms": ["물리치료", "작업치료"]},
    {"key": "medtech", "name": "임상병리·방사선", "terms": ["임상병리", "방사선"]},
    {"key": "postal", "name": "집배·우편", "terms": ["집배", "우편"]},
    {"key": "ta", "name": "대학 조교", "terms": ["조교"]},
    {"key": "youth", "name": "청소년 지도·상담", "terms": ["청소년"]},
    {"key": "martial", "name": "무도실무관", "terms": ["무도실무관", "무도 실무관"]},
    {"key": "psy", "name": "심리", "terms": ["심리"]},
    {"key": "survey", "name": "조사원", "terms": ["조사원", "조사요원"]},
]

MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]


# ── 작은 도우미 ──────────────────────────────────────────
def josa(word: str, pair: str) -> str:
    """받침에 맞는 조사. pair: 은는 | 이가 | 을를 | 과와 | 으로"""
    if not word:
        return word
    c = ord(word[-1])
    kor = 0xAC00 <= c <= 0xD7A3
    jong = (c - 0xAC00) % 28 if kor else 0
    has = kor and jong != 0
    if pair == "으로":
        return word + ("로" if (not has or jong == 8) else "으로")
    a, b = {"은는": ("은", "는"), "이가": ("이", "가"), "을를": ("을", "를"), "과와": ("과", "와")}[pair]
    return word + (a if has else b)


def n(x) -> str:
    try:
        return f"{int(round(float(x))):,}"
    except (TypeError, ValueError):
        return "0"


def pct(a, b) -> int:
    try:
        return int(round(100.0 * float(a) / float(b))) if float(b) else 0
    except (TypeError, ValueError):
        return 0


def short_sido(s: str | None) -> str:
    return re.sub(r"(특별자치도|특별자치시|광역시|특별시|통합특별시)$", "", s or "")


def kdate(iso: str | None) -> str:
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", iso or "")
    return f"{int(m.group(2))}월 {int(m.group(3))}일" if m else ""


def today() -> dt.date:
    return dt.date.today()


def slugify(s: str) -> str:
    return re.sub(r"[^0-9A-Za-z가-힣]+", "-", s).strip("-")


# 블록 생성기
def P(text): return {"type": "p", "text": text}
def H2(text, id_): return {"type": "h2", "text": text, "id": id_}
def LIST(items): return {"type": "list", "items": items}
def TABLE(head, rows): return {"type": "table", "head": head, "rows": rows}
def BARS(items, unit="건"): return {"type": "bars", "items": items, "unit": unit}
def LINKS(items): return {"type": "links", "items": items}
def NOTE(text): return {"type": "note", "text": text}


def peak_months(by_month: list[dict], k: int = 3) -> list[tuple[int, int]]:
    """공고가 많은 달 k개. (월, 건수) 내림차순."""
    rows = sorted(((int(r["m"]), int(r["n"])) for r in by_month if r.get("n")), key=lambda x: -x[1])
    return rows[:k]


def month_bars(by_month: list[dict]) -> list[dict]:
    got = {int(r["m"]): int(r["n"]) for r in by_month}
    return [{"label": MONTHS[m - 1], "n": got.get(m, 0)} for m in range(1, 13)]


# ── 기관 ──────────────────────────────────────────────────
def write_org(s: dict) -> dict:
    org = s["org"]
    n3y, total, open_n = int(s.get("n3y") or 0), int(s.get("total") or 0), int(s.get("open_n") or 0)
    bm = s.get("by_month") or []
    peaks = peak_months(bm)
    med = s.get("win_med")
    win_n, le7 = int(s.get("win_n") or 0), int(s.get("win_le7") or 0)
    org_url = f"/jobs/org/{org}"
    blocks: list[dict] = []
    toc = []

    lead = f"**{org}**{josa('', '은는') if False else ''}"  # placeholder, replaced below
    lead = (f"{josa('**' + org + '**', '은는')} 최근 3년 동안 나라일터에 채용 공고 **{n(n3y)}건**을 올렸습니다"
            + (f" (모아 둔 전체는 {n(total)}건)" if total > n3y else "") + ". ")
    lead += f"지금 접수 중인 공고는 **{n(open_n)}건**입니다. " if open_n else "지금은 접수 중인 공고가 없습니다. "
    if peaks and n3y >= 12:
        top = "·".join(MONTHS[m - 1] for m, _ in peaks[:2])
        lead += f"공고가 몰리는 달은 **{top}**이고, "
    if med is not None and win_n >= 5:
        lead += f"접수 기간은 보통 **{n(med)}일**입니다."
    blocks.append(P(lead.strip()))
    blocks.append(P(f"기관별 공고 전체는 [{org} 채용 이력]({org_url})에서, 다른 기관과 견주려면 [기관별 채용 이력](/jobs/org)에서 봅니다."))

    # 접수 중
    toc.append(("open", "지금 접수 중인 공고"))
    blocks.append(H2("지금 접수 중인 공고", "open"))
    if s.get("open_list"):
        blocks.append(LINKS([{"href": f"/jobs/{r['id']}", "label": f"{r['title']} — {kdate(r['end'])} 마감"} for r in s["open_list"]]))
    else:
        blocks.append(P(f"오늘 기준으로 접수 중인 공고가 없습니다. 아래 달별 흐름을 보고 다음 공고가 올라올 시기를 가늠하세요. 최근 공고는 [{org} 채용 이력]({org_url})에 있습니다."))

    # 달별
    if n3y >= 12:
        toc.append(("when", "언제 뽑나 — 달별 공고 수"))
        blocks.append(H2("언제 뽑나 — 달별 공고 수", "when"))
        blocks.append(BARS(month_bars(bm)))
        top3 = sum(c for _, c in peaks)
        share = pct(top3, n3y)
        names = "·".join(MONTHS[m - 1] for m, _ in peaks)
        low = sorted(((int(r["m"]), int(r["n"])) for r in bm), key=lambda x: x[1])[:2]
        txt = f"최근 3년 공고 {n(n3y)}건 중 **{names}**에 {n(top3)}건, 전체의 **{share}%**가 올라왔습니다."
        if share >= 45:
            txt += f" 세 달에 절반 가까이 몰리는 기관입니다. 이 달들 2~3주 전부터 [{org} 채용 이력]({org_url})을 확인해 두면 놓치지 않습니다."
        elif share >= 33:
            txt += " 특정 달에 조금 몰리지만 연중 고르게 올라오는 편입니다."
        else:
            txt += " 달별 차이가 크지 않아 연중 언제든 공고가 날 수 있는 기관입니다."
        if low and low[0][1] == 0:
            txt += f" {MONTHS[low[0][0] - 1]}에는 최근 3년 공고가 없었습니다."
        blocks.append(P(txt))

    # 접수 기간
    if win_n >= 5 and med is not None:
        toc.append(("window", "접수 기간은 며칠인가"))
        blocks.append(H2("접수 기간은 며칠인가", "window"))
        q1, q3 = s.get("win_q1"), s.get("win_q3")
        share7 = pct(le7, win_n)
        txt = f"등록일부터 마감일까지 중앙값은 **{n(med)}일**입니다"
        if q1 is not None and q3 is not None and int(q1) != int(q3):
            txt += f" (절반이 {n(q1)}~{n(q3)}일 사이)"
        txt += f". 공고 {n(win_n)}건 가운데 **{share7}%**는 일주일 안에 마감했습니다."
        if share7 >= 40:
            txt += " 열에 넷 넘게 일주일 안에 닫히니, 서류(자격증 사본·경력증명)는 공고 전에 준비해 두는 편이 안전합니다."
        elif share7 >= 15:
            txt += " 보름 안팎이 보통이지만 일주일짜리도 있으니 공고를 본 날 바로 서류를 챙기세요."
        else:
            txt += " 접수 기간이 비교적 넉넉한 기관입니다."
        blocks.append(P(txt))

    # 해마다
    by_year = [r for r in (s.get("by_year") or []) if int(r["y"]) >= today().year - 5]
    if len(by_year) >= 2:
        toc.append(("years", "해마다 몇 건"))
        blocks.append(H2("해마다 몇 건", "years"))
        blocks.append(TABLE(["연도", "공고 수"], [[f"{r['y']}년", f"{n(r['n'])}건"] for r in by_year]))
        last_full = [r for r in by_year if int(r["y"]) < today().year]
        if len(last_full) >= 2:
            a, b = int(last_full[-2]["n"]), int(last_full[-1]["n"])
            if b >= a * 1.3:
                blocks.append(P(f"{last_full[-1]['y']}년 공고가 전년보다 **{pct(b - a, a)}% 늘었습니다**. 채용 규모가 커지는 흐름입니다."))
            elif b <= a * 0.7:
                blocks.append(P(f"{last_full[-1]['y']}년 공고가 전년보다 **{pct(a - b, a)}% 줄었습니다**. 공고 수만으로 채용 인원을 말할 수는 없지만, 빈도는 낮아진 셈입니다."))

    # 어떤 자리
    toc.append(("what", "어떤 자리가 올라오나"))
    blocks.append(H2("어떤 자리가 올라오나", "what"))
    hires = s.get("hires") or []
    if hires:
        hmap = {"국가": "중앙부처", "지자체": "지자체", "교육": "교육청·학교", "공공": "공공기관"}
        blocks.append(P("구분: " + ", ".join(f"{hmap.get(h['hire'], h['hire'])} {n(h['n'])}건" for h in hires) + "."))
        if any(h["hire"] == "공공" for h in hires):
            blocks.append(P("공공기관 채용은 블라인드 원칙이라 서류에 학교·나이를 쓰지 않고, NCS 필기를 보는 곳이 많습니다. 기관 홈페이지 채용 게시판에 더 자세한 안내가 올라옵니다."))
    regs = s.get("regions") or []
    if regs:
        blocks.append(P("근무 지역: " + ", ".join(f"{short_sido(r['region'])} {n(r['n'])}건" for r in regs) + "."))
    if s.get("recent"):
        blocks.append(P("최근 공고 제목으로 보면 이런 자리입니다."))
        blocks.append(LINKS([{"href": f"/jobs/{r['id']}", "label": f"{r['title']} ({kdate(r['reg'])} 등록)"} for r in s["recent"][:6]]))

    # 준비
    toc.append(("howto", "이렇게 준비하세요"))
    blocks.append(H2("이렇게 준비하세요", "howto"))
    tips = []
    if peaks and n3y >= 12:
        tips.append(f"**{'·'.join(MONTHS[m - 1] for m, _ in peaks[:2])}** 2~3주 전부터 공고를 확인합니다. 이 기관은 그때 공고가 가장 많습니다.")
    if med is not None and win_n >= 5:
        tips.append(f"접수 기간 중앙값이 {n(med)}일입니다. 자격증 사본·경력증명·어학 성적은 공고 전에 파일로 준비해 둡니다.")
    tips.append(f"[{org} 채용 이력]({org_url})을 저장해 두고, 공고가 뜨면 [나라일터 이용법](/blog/gojobs-guide)의 순서대로 접수합니다.")
    tips.append("같은 직무를 다른 기관에서도 뽑습니다. [공공기관 채용 전체](/jobs)에서 직무 이름으로 찾아 함께 지원하세요.")
    blocks.append(LIST(tips))
    blocks.append(NOTE(f"{today().isoformat()} 기준, 나라일터(gojobs.go.kr)에 올라온 공고를 {BRAND}이 매일 모아 센 숫자입니다. 공고 수는 채용 인원이 아니며, 기관 홈페이지에만 올린 공고는 빠져 있을 수 있습니다."))

    title = f"{org} 채용, 언제 뽑나 — 최근 3년 공고 {n(n3y)}건으로 본 시기와 접수 기간"
    summary = (f"{org}의 최근 3년 채용 공고 {n(n3y)}건을 달별로 세어 공고가 몰리는 달과 접수 기간을 정리했습니다. "
               + (f"지금 접수 중인 공고 {n(open_n)}건도 함께 봅니다." if open_n else "접수 중인 공고가 뜨면 바로 볼 수 있게 기관 이력 링크를 붙였습니다."))
    kw = [BRAND, f"{org} 채용", f"{org} 채용 시기", f"{org} 채용공고", f"{org} 접수기간", "공공기관 채용", f"{BRAND} 채용"]
    return {"slug": "org-" + slugify(org), "kind": "org", "subject": org, "title": title, "summary": summary,
            "keywords": kw, "body": blocks, "toc": toc}


# ── 직무 ──────────────────────────────────────────────────
def write_role(role: dict, s: dict) -> dict:
    name = role["name"]
    n3y, open_n, orgs_n = int(s.get("n3y") or 0), int(s.get("open_n") or 0), int(s.get("orgs_n") or 0)
    bm = s.get("by_month") or []
    peaks = peak_months(bm)
    med, win_n, le7 = s.get("win_med"), int(s.get("win_n") or 0), int(s.get("win_le7") or 0)
    q_url = f"/jobs/q/{name.split('·')[0]}"
    blocks, toc = [], []

    lead = f"최근 3년 나라일터에 올라온 **{name}** 채용 공고는 **{n(n3y)}건**, 기관 수로는 **{n(orgs_n)}곳**입니다. "
    lead += f"지금 접수 중인 공고는 **{n(open_n)}건**입니다. " if open_n else "오늘 기준 접수 중인 공고는 없습니다. "
    hires = s.get("hires") or []
    if hires and n3y:
        h = hires[0]
        hmap = {"국가": "중앙부처", "지자체": "지자체(시·군·구)", "교육": "교육청·학교", "공공": "공공기관"}
        lead += f"가장 많이 뽑는 곳은 **{hmap.get(h['hire'], h['hire'])}**로 전체의 {pct(h['n'], n3y)}%입니다."
    blocks.append(P(lead.strip()))
    blocks.append(P(f"공고 목록은 [{name} 채용 공고]({q_url})에서 접수 중인 것부터 봅니다."))

    toc.append(("open", "지금 접수 중인 공고"))
    blocks.append(H2("지금 접수 중인 공고", "open"))
    if s.get("open_list"):
        blocks.append(LINKS([{"href": f"/jobs/{r['id']}", "label": f"{r['title']} — {r.get('org') or ''} · {kdate(r['end'])} 마감"} for r in s["open_list"]]))
    else:
        blocks.append(P(f"오늘은 접수 중인 공고가 없습니다. [{name} 채용 공고]({q_url})를 저장해 두면 올라올 때 바로 볼 수 있습니다."))

    orgs = s.get("orgs") or []
    if orgs:
        toc.append(("orgs", "어느 기관이 자주 뽑나"))
        blocks.append(H2("어느 기관이 자주 뽑나", "orgs"))
        blocks.append(TABLE(["기관", "최근 3년 공고", "접수 중"],
                            [[f"[{o['org']}](/jobs/org/{o['org']})", f"{n(o['n'])}건", f"{n(o['open_n'])}건" if o.get("open_n") else "—"] for o in orgs]))
        top_share = pct(sum(int(o["n"]) for o in orgs[:3]), n3y)
        if top_share >= 30:
            blocks.append(P(f"상위 세 기관이 전체의 **{top_share}%**를 차지합니다. 이 기관들의 [채용 이력](/jobs/org)을 따로 봐 두면 시기를 잡기 쉽습니다."))
        else:
            blocks.append(P(f"상위 세 기관을 합쳐도 전체의 {top_share}%입니다. 특정 기관이 아니라 **여러 기관에서 조금씩** 뽑는 직무라, 기관보다 지역과 시기로 찾는 편이 낫습니다."))

    regs = s.get("regions") or []
    if regs and n3y:
        toc.append(("where", "어느 지역에 많나"))
        blocks.append(H2("어느 지역에 많나", "where"))
        blocks.append(BARS([{"label": short_sido(r["region"]), "n": int(r["n"])} for r in regs]))
        blocks.append(P(f"지역이 적힌 공고 기준입니다. 중앙부처 공고는 지역을 비워 두는 경우가 많아 빠져 있습니다. 지역별 목록은 [지역별 채용](/jobs/region)에서 봅니다."))

    if n3y >= 24:
        toc.append(("when", "언제 올라오나"))
        blocks.append(H2("언제 올라오나", "when"))
        blocks.append(BARS(month_bars(bm)))
        top3 = sum(c for _, c in peaks)
        share = pct(top3, n3y)
        names = "·".join(MONTHS[m - 1] for m, _ in peaks)
        txt = f"**{names}**에 {n(top3)}건, 전체의 **{share}%**입니다."
        txt += " 특정 달에 몰리는 직무입니다." if share >= 40 else " 연중 고르게 올라오는 직무라 시기보다는 접수 기간을 챙기는 것이 중요합니다."
        blocks.append(P(txt))

    if win_n >= 10 and med is not None:
        toc.append(("window", "접수 기간"))
        blocks.append(H2("접수 기간", "window"))
        share7 = pct(le7, win_n)
        txt = f"접수 기간 중앙값은 **{n(med)}일**, 공고 {n(win_n)}건 중 **{share7}%**가 일주일 안에 마감했습니다."
        if share7 >= 30:
            txt += " 셋 중 하나는 일주일 안에 닫힙니다. 면허·자격증 사본과 경력증명서는 미리 스캔해 두세요."
        blocks.append(P(txt))

    toc.append(("howto", "이렇게 찾으세요"))
    blocks.append(H2("이렇게 찾으세요", "howto"))
    tips = [f"[{name} 채용 공고]({q_url})에서 **접수 중만** 켜고 지역 칩으로 좁힙니다."]
    if orgs:
        tips.append(f"자주 뽑는 기관([{orgs[0]['org']}](/jobs/org/{orgs[0]['org']}) 등)은 기관 이력 페이지를 저장해 둡니다.")
    if peaks and n3y >= 24:
        tips.append(f"공고가 많은 **{'·'.join(MONTHS[m - 1] for m, _ in peaks[:2])}** 앞뒤로 더 자주 확인합니다.")
    tips.append("접수 순서와 서류는 [나라일터 이용법](/blog/gojobs-guide)에 정리해 두었습니다.")
    blocks.append(LIST(tips))
    blocks.append(NOTE(f"{today().isoformat()} 기준, 나라일터 공고 제목에서 '{name}' 관련 낱말이 들어간 공고를 센 것입니다. 제목만 보고 가른 것이라 직무가 섞인 공고(여러 직종 동시 채용)도 들어갑니다."))

    title = f"{name} 공공기관 채용, 어디서 얼마나 뽑나 — 최근 3년 공고 {n(n3y)}건 분석"
    summary = f"최근 3년 나라일터의 {name} 채용 공고 {n(n3y)}건을 기관·지역·달별로 세었습니다. " + (f"지금 접수 중인 공고 {n(open_n)}건부터 봅니다." if open_n else "자주 뽑는 기관과 시기를 정리했습니다.")
    kw = [BRAND, f"{name} 채용", f"{name} 공공기관 채용", f"{name} 채용공고", f"{name} 채용 시기", "공무직 채용", f"{BRAND} 채용"]
    return {"slug": "role-" + role["key"], "kind": "role", "subject": role["key"], "title": title, "summary": summary,
            "keywords": kw, "body": blocks, "toc": toc}


# ── 주제 ──────────────────────────────────────────────────
def write_topic(t: dict, s: dict) -> dict:
    label = t["label"]
    total, open_n, always_n = int(s.get("total") or 0), int(s.get("open_n") or 0), int(s.get("always_n") or 0)
    closing30 = int(s.get("closing30") or 0)
    by_sido = s.get("by_sido") or []
    search_url = "/?q=" + t["search"] + "&via=story"
    blocks, toc = [], []

    lead = f"지금 신청할 수 있는 **{label}** 사업은 전국 **{n(open_n)}건**입니다"
    lead += f" (모아 둔 전체 {n(total)}건)" if total > open_n else ""
    lead += ". "
    if by_sido:
        lead += f"**{short_sido(by_sido[0]['sido']) or by_sido[0]['sido']}**가 {n(by_sido[0]['n'])}건으로 가장 많고, "
    if open_n:
        lead += f"{n(always_n)}건({pct(always_n, open_n)}%)은 **따로 마감 없이 상시 접수**합니다."
    blocks.append(P(lead.strip()))
    blocks.append(P(f"사는 곳과 나이를 넣어 걸러 보려면 [{label} 찾기]({search_url}), 제도 설명과 함께 보려면 [{t['hub_label']}]({t['hub']})로 가세요."))

    if by_sido:
        toc.append(("where", "지역별로 몇 건"))
        blocks.append(H2("지역별로 몇 건", "where"))
        blocks.append(BARS([{"label": short_sido(r["sido"]) or r["sido"], "n": int(r["n"])} for r in by_sido]))
        top = by_sido[0]
        share = pct(top["n"], open_n)
        txt = f"**{short_sido(top['sido']) or top['sido']}**에 전체의 {share}%가 있습니다."
        if share >= 35:
            txt += " 한 지역에 크게 몰려 있어, 다른 지역은 시·군 단위 사업을 하나씩 확인해야 합니다."
        else:
            txt += " 지역별로 고르게 퍼져 있으니 사는 곳 이름으로 바로 찾는 편이 빠릅니다."
        nat = next((r for r in by_sido if r["sido"] == "전국"), None)
        if nat:
            txt += f" 전국 단위(중앙부처) 사업은 {n(nat['n'])}건입니다."
        blocks.append(P(txt))

    if s.get("closing_list"):
        toc.append(("closing", "마감이 가까운 것"))
        blocks.append(H2("마감이 가까운 것", "closing"))
        if closing30:
            blocks.append(P(f"**30일 안에 마감되는 사업이 {n(closing30)}건**입니다. 날짜가 적힌 것부터 봅니다."))
        else:
            blocks.append(P("30일 안에 마감되는 사업은 없습니다. 날짜가 적힌 것 가운데 가까운 순입니다."))
        blocks.append(LINKS([{"href": f"/p/{r['id']}", "label": f"{r['title']} — {r.get('sigungu') or short_sido(r.get('sido')) or '전국'} · {kdate(r['end'])} 마감"} for r in s["closing_list"]]))
    elif open_n:
        toc.append(("closing", "마감은 언제인가"))
        blocks.append(H2("마감은 언제인가", "closing"))
        blocks.append(P(f"{label} 사업은 대부분 **마감일 없이 상시 접수**합니다. 다만 예산이 소진되면 그해 접수를 닫는 사업이 많으니, 연초에 신청하는 편이 유리합니다."))

    hh = s.get("household") or []
    youth_n = int(s.get("youth_n") or 0)
    if open_n and (hh or youth_n):
        toc.append(("who", "누구에게 주나"))
        blocks.append(H2("누구에게 주나", "who"))
        if hh:
            blocks.append(BARS([{"label": r["k"], "n": int(r["n"])} for r in hh]))
        txt = ""
        if youth_n:
            txt += f"나이 상한이 45세 이하인 **청년 대상** 사업이 {n(youth_n)}건({pct(youth_n, open_n)}%)입니다. "
        if hh:
            txt += f"가구 조건이 적힌 사업 중에는 **{hh[0]['k']}**이 {n(hh[0]['n'])}건으로 가장 많습니다. 조건이 없는 사업은 가구 구분 없이 신청할 수 있습니다."
        blocks.append(P(txt.strip()))

    sup = s.get("support") or []
    if sup and open_n:
        toc.append(("how", "어떤 방식으로 주나"))
        blocks.append(H2("어떤 방식으로 주나", "how"))
        blocks.append(P(", ".join(f"**{r['k']}** {n(r['n'])}건" for r in sup) + "."))
        if s.get("amount_med") and int(s.get("amount_n") or 0) >= 5:
            blocks.append(P(f"금액이 적힌 사업 {n(s['amount_n'])}건의 지원 상한 중앙값은 **{n(float(s['amount_med']) / 10000)}만 원**입니다."))

    if s.get("sample"):
        toc.append(("sample", "지금 신청할 수 있는 사업 예"))
        blocks.append(H2("지금 신청할 수 있는 사업 예", "sample"))
        blocks.append(LINKS([{"href": f"/p/{r['id']}", "label": f"{r['title']} — {r.get('sigungu') or short_sido(r.get('sido')) or '전국'}" + (f" · {kdate(r['end'])} 마감" if r.get("end") else " · 상시")} for r in s["sample"]]))

    toc.append(("howto", "이렇게 찾으세요"))
    blocks.append(H2("이렇게 찾으세요", "howto"))
    tips = [f"[{label} 찾기]({search_url})에서 **사는 곳(시·군까지)과 나이**를 넣습니다. 시·군 사업은 그 지역 주민만 됩니다.",
            "같은 이름이라도 지자체마다 금액·조건이 다릅니다. 사업 쪽을 열어 **지원대상·선정기준** 원문을 확인하세요.",
            f"제도 설명과 정부 대출 조건은 [{t['hub_label']}]({t['hub']})에 있습니다."]
    if always_n and open_n and pct(always_n, open_n) >= 60:
        tips.append("상시 접수가 많지만 예산이 떨어지면 닫힙니다. 조건이 되면 미루지 말고 신청합니다.")
    blocks.append(LIST(tips))
    blocks.append(NOTE(f"{today().isoformat()} 기준, 복지로·지자체 공고에서 '{label}' 관련 낱말이 들어간 사업을 {BRAND}이 센 것입니다. 낱말로 가른 것이라 이름만 비슷한 사업이 섞일 수 있고, 최종 조건은 각 사업 원문이 기준입니다."))

    title = f"{label}, 지금 신청할 수 있는 {n(open_n)}건 — 지역별 현황과 신청 순서"
    summary = f"전국 {label} 사업 {n(open_n)}건을 지역·대상·지원 방식으로 세었습니다. " + (f"30일 안에 마감되는 {n(closing30)}건과 " if closing30 else "") + "지금 신청할 수 있는 사업을 바로 열 수 있게 링크를 붙였습니다."
    kw = [BRAND, label, f"{label} 신청", f"{label} 조건", f"{label} 지자체", f"{BRAND} {label}", "정부지원금"]
    return {"slug": "topic-" + t["slug"], "kind": "topic", "subject": t["slug"], "title": title, "summary": summary,
            "keywords": kw, "body": blocks, "toc": toc}


# ── 지역 ──────────────────────────────────────────────────
def write_region(s: dict) -> dict:
    sido = s["sido"]; sh = short_sido(sido) or sido
    total, open_n, closing30 = int(s.get("total") or 0), int(s.get("open_n") or 0), int(s.get("closing30") or 0)
    jobs_open, jobs_3y = int(s.get("jobs_open") or 0), int(s.get("jobs_3y") or 0)
    area_url = f"/area/{sido}"
    jobs_url = f"/jobs/region/{sido}"
    blocks, toc = [], []

    lead = f"**{sido}**에서 지금 신청할 수 있는 복지·지원 사업은 **{n(open_n)}건**, 접수 중인 공공기관 채용 공고는 **{n(jobs_open)}건**입니다. "
    topics = s.get("topics") or []
    if topics:
        lead += f"사업은 **{topics[0]['k']}** 분야가 {n(topics[0]['n'])}건으로 가장 많습니다."
    blocks.append(P(lead.strip()))
    blocks.append(P(f"사업 전체는 [{sh} 지원금 모아보기]({area_url}), 채용은 [{sh} 채용 공고]({jobs_url})에서 봅니다."))

    if topics:
        toc.append(("topics", "어떤 분야가 많나"))
        blocks.append(H2("어떤 분야가 많나", "topics"))
        blocks.append(BARS([{"label": r["k"], "n": int(r["n"])} for r in topics]))
        blocks.append(P(f"분야별로 열어 보려면 [분야별 모아보기](/topic)에서 {sh}를 고릅니다."))

    sg = s.get("sigungu") or []
    if sg:
        toc.append(("sigungu", "시·군·구별로 몇 건"))
        blocks.append(H2("시·군·구별로 몇 건", "sigungu"))
        blocks.append(BARS([{"label": r["k"], "n": int(r["n"])} for r in sg]))
        blocks.append(P(f"시·군·구 사업은 그 지역 주민만 신청할 수 있습니다. **{sg[0]['k']}**가 {n(sg[0]['n'])}건으로 가장 많고, 도 단위 사업은 {sh} 주민이면 어디서나 됩니다. 사는 곳을 넣어 걸러 보려면 [내 조건으로 찾기](/?sido={sido})를 쓰세요."))

    hh = s.get("household") or []
    if hh:
        toc.append(("who", "누구에게 주나"))
        blocks.append(H2("누구에게 주나", "who"))
        blocks.append(BARS([{"label": r["k"], "n": int(r["n"])} for r in hh]))

    if s.get("closing_list"):
        toc.append(("closing", "마감이 가까운 사업"))
        blocks.append(H2("마감이 가까운 사업", "closing"))
        blocks.append(P(f"30일 안에 마감되는 사업 {n(closing30)}건." if closing30 else "30일 안에 마감되는 사업은 없습니다. 날짜가 적힌 것 가운데 가까운 순입니다."))
        blocks.append(LINKS([{"href": f"/p/{r['id']}", "label": f"{r['title']} — {r.get('sigungu') or sh} · {kdate(r['end'])} 마감"} for r in s["closing_list"]]))

    toc.append(("jobs", "공공기관 채용"))
    blocks.append(H2("공공기관 채용", "jobs"))
    txt = f"최근 3년 {sh} 지역 채용 공고는 **{n(jobs_3y)}건**입니다. "
    orgs = s.get("jobs_orgs") or []
    if orgs:
        txt += "자주 뽑는 기관: " + ", ".join(f"[{o['org']}](/jobs/org/{o['org']}) {n(o['n'])}건" for o in orgs[:4]) + "."
    blocks.append(P(txt))
    if s.get("jobs_open_list"):
        blocks.append(LINKS([{"href": f"/jobs/{r['id']}", "label": f"{r['title']} — {r.get('org') or ''} · {kdate(r['end'])} 마감"} for r in s["jobs_open_list"]]))

    toc.append(("howto", "이렇게 찾으세요"))
    blocks.append(H2("이렇게 찾으세요", "howto"))
    blocks.append(LIST([
        f"[내 조건으로 찾기](/?sido={sido})에 **시·군까지** 넣습니다. 도 사업과 시·군 사업이 따로 있어 둘 다 나옵니다.",
        f"채용은 [{sh} 채용 공고]({jobs_url})에서 접수 중만 켜고 봅니다. 지자체 공고는 거주지 제한이 있는 경우가 많습니다.",
        f"분야가 정해져 있으면 [{sh} 지원금 모아보기]({area_url})에서 대상별로 봅니다.",
    ]))
    blocks.append(NOTE(f"{today().isoformat()} 기준, 복지로·지자체 공고와 나라일터 공고를 {BRAND}이 매일 모아 센 숫자입니다. 중앙부처의 전국 사업은 지역 집계에서 빠져 있습니다."))

    title = f"{sido} 지원금·채용 현황 — 신청 가능한 사업 {n(open_n)}건, 접수 중 채용 {n(jobs_open)}건"
    summary = f"{sido}에서 지금 신청할 수 있는 복지·지원 사업 {n(open_n)}건을 분야·시군구·대상별로 세고, 접수 중인 공공기관 채용 {n(jobs_open)}건을 함께 정리했습니다."
    kw = [BRAND, f"{sh} 지원금", f"{sido} 복지", f"{sh} 청년 지원", f"{sh} 채용", f"{BRAND} {sh}", "지자체 지원금"]
    return {"slug": "region-" + slugify(sido), "kind": "region", "subject": sido, "title": title, "summary": summary,
            "keywords": kw, "body": blocks, "toc": toc}


# ── 자격증 ────────────────────────────────────────────────
def exam_events(rounds: list[dict]) -> list[dict]:
    """큐넷 일정 줄을 단계별 시험 하나하나로 푼다. 기술자격은 한 줄에 필기·실기가 함께 있고,
    전문자격은 줄마다 단계(1차·2차·면접)가 적혀 있다. web/lib/examInsight.ts 의 events() 와 같은 규칙."""
    out = []
    for r in rounds:
        if r.get("stage") is None:
            if r.get("exam_start"):
                out.append({"label": r["label"], "stage": "필기", "reg_start": r.get("reg_start"), "reg_end": r.get("reg_end"),
                            "exam_start": r["exam_start"], "exam_end": r.get("exam_end"), "pass": r.get("pass_date")})
            if r.get("prac_exam_start"):
                out.append({"label": r["label"], "stage": "실기", "reg_start": r.get("prac_reg_start"), "reg_end": r.get("prac_reg_end"),
                            "exam_start": r["prac_exam_start"], "exam_end": r.get("prac_exam_end"), "pass": r.get("final_pass")})
        elif r.get("exam_start"):
            out.append({"label": r["label"], "stage": r["stage"], "reg_start": r.get("reg_start"), "reg_end": r.get("reg_end"),
                        "exam_start": r["exam_start"], "exam_end": r.get("exam_end"), "pass": r.get("pass_date")})
    return sorted(out, key=lambda e: e["exam_start"])


def krange(a: str | None, b: str | None) -> str:
    if not a:
        return ""
    return kdate(a) if (not b or b == a) else f"{kdate(a)}~{kdate(b)}"


def reg_state(e: dict, t: dt.date) -> str:
    rs, re_ = e.get("reg_start"), e.get("reg_end")
    if not rs:
        return "접수일 미정"
    if rs <= t.isoformat() <= (re_ or rs):
        return "**접수 중**"
    if rs > t.isoformat():
        return f"접수 {krange(rs, re_)}"
    return "접수 마감"


def level_word(rate: int) -> str:
    return "어려운 편" if rate < 30 else ("보통" if rate < 60 else "수월한 편")


def write_license(s: dict) -> dict:
    name, series, field = s["name"], s.get("series") or "", s.get("field") or ""
    code = s["code"]
    lic_url = f"/license/{code}"
    t = today()
    by_year = s.get("by_year") or []
    years = sorted({int(r["y"]) for r in by_year})
    stages = []
    for r in by_year:
        if r["stage"] not in stages:
            stages.append(r["stage"])
    # 단계별 3년 합계
    agg = {}
    for st in stages:
        rows = [r for r in by_year if r["stage"] == st]
        tk, ps = sum(int(r.get("takers") or 0) for r in rows), sum(int(r.get("passers") or 0) for r in rows)
        agg[st] = (tk, ps, pct(ps, tk))
    takers, passers = int(s.get("takers_3y") or 0), int(s.get("passers_3y") or 0)
    bottleneck = min(agg.items(), key=lambda kv: kv[1][2]) if agg else None
    events = exam_events(s.get("rounds") or [])
    upcoming = [e for e in events if (e.get("exam_end") or e["exam_start"]) >= t.isoformat()]
    blocks, toc = [], []

    yr_txt = f"{years[0]}~{years[-1]}년" if len(years) >= 2 else (f"{years[0]}년" if years else "최근")
    lead = f"**{name}**{'은' if josa(name, '은는').endswith('은') else '는'} {yr_txt} 응시자 **{n(takers)}명**, 합격자 {n(passers)}명인 {s.get('kind_name') or '국가자격'}"
    lead += f" {series} 등급입니다. " if series else "입니다. "
    peers_n, rank_peers = int(s.get("peers_n") or 0), int(s.get("rank_peers") or 0)
    if peers_n >= 2 and rank_peers:
        lead += f"같은 분야({field}) {series} {n(peers_n)}종 가운데 응시자 수 **{rank_peers}위**, "
    lead += f"큐넷 전체 {n(s.get('all_n'))}종 가운데 **{n(s.get('rank_all'))}위**입니다. "
    if len(agg) >= 2:
        lead += " · ".join(f"{st} 합격률 **{v[2]}%**" for st, v in agg.items()) + "."
    elif agg:
        st, v = next(iter(agg.items()))
        lead += f"{st} 합격률은 **{v[2]}%**입니다."
    blocks.append(P(lead.strip()))
    blocks.append(P(f"응시 자격·시험 과목과 전체 일정은 [{name} 종목 페이지]({lic_url})에, 다른 종목은 [자격증 전체](/license)에 있습니다."))

    toc.append(("sched", f"{t.year}년 남은 시험 일정"))
    blocks.append(H2(f"{t.year}년 남은 시험 일정", "sched"))
    if upcoming:
        blocks.append(TABLE(["회차", "단계", "접수", "시험", "발표"],
                            [[e["label"], e["stage"], reg_state(e, t), krange(e["exam_start"], e.get("exam_end")), kdate(e.get("pass")) or "—"] for e in upcoming[:8]]))
        nxt = upcoming[0]
        txt = f"가장 가까운 시험은 **{nxt['label']} {nxt['stage']}**, {krange(nxt['exam_start'], nxt.get('exam_end'))}입니다."
        if nxt.get("reg_start") and nxt["reg_start"] > t.isoformat():
            txt += f" 접수는 {kdate(nxt['reg_start'])}에 열립니다."
        elif nxt.get("reg_end") and nxt.get("reg_start") and nxt["reg_start"] <= t.isoformat() <= nxt["reg_end"]:
            txt += f" **지금 접수 중**이고 {kdate(nxt['reg_end'])}에 닫힙니다."
        blocks.append(P(txt))
    else:
        blocks.append(P(f"오늘 기준 올해 남은 시험은 없습니다. 내년 일정은 큐넷이 올리는 대로 [{name} 종목 페이지]({lic_url})에 반영됩니다."))
    reg_days = sorted((dt.date.fromisoformat(e["reg_end"]) - dt.date.fromisoformat(e["reg_start"])).days + 1
                      for e in events if e.get("reg_start") and e.get("reg_end"))
    if reg_days:
        med_reg = reg_days[(len(reg_days) - 1) // 2]
        if med_reg <= 7:
            blocks.append(P(f"접수 기간은 회차마다 **{med_reg}일** 안팎으로 짧습니다. 큐넷 회원가입과 사진 등록을 미리 해 두고, 접수 첫날 오전에 신청하는 편이 안전합니다. 인기 시험장은 첫날 마감됩니다."))

    if agg:
        toc.append(("rate", "합격률 — 어느 단계가 고비인가"))
        blocks.append(H2("합격률 — 어느 단계가 고비인가", "rate"))
        if stages == ["실기", "필기"] or stages == ["필기", "실기"]:
            rows = []
            for y in years:
                w = next((r for r in by_year if int(r["y"]) == y and r["stage"] == "필기"), {})
                p_ = next((r for r in by_year if int(r["y"]) == y and r["stage"] == "실기"), {})
                rows.append([f"{y}년", n(w.get("takers")) + "명", f"{pct(w.get('passers'), w.get('takers'))}%", n(p_.get("takers")) + "명", f"{pct(p_.get('passers'), p_.get('takers'))}%"])
            blocks.append(TABLE(["연도", "필기 응시", "필기 합격률", "실기 응시", "실기 합격률"], rows))
        else:
            blocks.append(TABLE(["연도", "단계", "응시", "합격", "합격률"],
                                [[f"{r['y']}년", r["stage"], n(r.get("takers")) + "명", n(r.get("passers")) + "명", f"{pct(r.get('passers'), r.get('takers'))}%"] for r in by_year]))
        st, (tk, ps, rt) = bottleneck
        txt = f"{yr_txt} 합계로 보면 " + ", ".join(f"**{k} {v[2]}%**" for k, v in agg.items()) + f". 고비는 **{st}**입니다({level_word(rt)})."
        if len(agg) >= 2:
            hi = max(agg.items(), key=lambda kv: kv[1][2])
            if hi[1][2] >= 55 and rt < 35:
                txt += f" {hi[0]}는 둘 중 하나 넘게 붙지만 {st}에서 셋 중 둘이 떨어집니다. 공부 시간은 {st}에 더 두어야 합니다."
            elif rt >= 55:
                txt += " 두 단계 모두 절반 넘게 붙는, 준비한 만큼 결과가 나오는 시험입니다."
        blocks.append(P(txt))
        first_stage = stages[0] if "필기" not in stages else "필기"
        a0 = next((r for r in by_year if int(r["y"]) == years[0] and r["stage"] == first_stage), None)
        a1 = next((r for r in by_year if int(r["y"]) == years[-1] and r["stage"] == first_stage), None)
        if a0 and a1 and len(years) >= 2 and int(a0.get("takers") or 0) >= 100:
            d = pct(int(a1.get("takers") or 0) - int(a0.get("takers") or 0), int(a0.get("takers") or 0))
            if d >= 15:
                blocks.append(P(f"{first_stage} 응시자가 {years[0]}년 {n(a0['takers'])}명에서 {years[-1]}년 {n(a1['takers'])}명으로 **{d}% 늘었습니다**. 찾는 사람이 빠르게 느는 종목입니다."))
            elif d <= -15:
                blocks.append(P(f"{first_stage} 응시자가 {years[0]}년 {n(a0['takers'])}명에서 {years[-1]}년 {n(a1['takers'])}명으로 **{-d}% 줄었습니다**."))

    peers = [p_ for p_ in (s.get("peers") or []) if p_.get("code") != code]
    if peers:
        toc.append(("peers", f"같은 분야 {series} 종목과 견주면"))
        blocks.append(H2(f"같은 분야 {series} 종목과 견주면", "peers"))
        rows = [[f"**{name}**", n(takers) + "명", f"{pct(passers, takers)}%"]]
        rows += [[f"[{p_['name']}](/license/{p_['code']})", n(p_["takers"]) + "명", f"{pct(p_.get('passers'), p_.get('takers'))}%"] for p_ in peers[:6]]
        blocks.append(TABLE(["종목", f"{yr_txt} 응시자", "합격률"], rows))
        easier = [p_ for p_ in peers if pct(p_.get("passers"), p_.get("takers")) >= pct(passers, takers) + 10 and int(p_.get("takers") or 0) >= 1000]
        if easier:
            blocks.append(P(f"같은 분야에서 합격률이 눈에 띄게 높은 종목은 [{easier[0]['name']}](/license/{easier[0]['code']})입니다. 분야가 같다고 쓰임이 같지는 않으니, 채용 공고가 어느 종목을 적는지 먼저 봅니다."))

    toc.append(("jobs", "이 자격을 적은 공공기관 채용"))
    blocks.append(H2("이 자격을 적은 공공기관 채용", "jobs"))
    jobs_3y = int(s.get("jobs_3y") or 0)
    if jobs_3y:
        blocks.append(P(f"최근 3년 나라일터 공고 제목에 '{name}'이 그대로 적힌 공고는 **{n(jobs_3y)}건**입니다."))
        if s.get("jobs_open_list"):
            blocks.append(LINKS([{"href": f"/jobs/{r['id']}", "label": f"{r['title']} — {r.get('org') or ''} · {kdate(r['end'])} 마감"} for r in s["jobs_open_list"]]))
    else:
        blocks.append(P(f"최근 3년 나라일터 공고 제목에 '{name}'이 그대로 적힌 공고는 없습니다. 자격증은 보통 '관련 자격 소지자'로 묶어 적으니, [공공기관 채용](/jobs)에서 분야 이름으로 찾고 공고 본문의 응시 자격을 확인하세요."))

    toc.append(("howto", "이렇게 준비하세요"))
    blocks.append(H2("이렇게 준비하세요", "howto"))
    tips = []
    if upcoming:
        nxt = upcoming[0]
        tips.append(f"가장 가까운 **{nxt['label']} {nxt['stage']}**({krange(nxt['exam_start'], nxt.get('exam_end'))})에 맞춰 역산합니다. 접수일({krange(nxt.get('reg_start'), nxt.get('reg_end')) or '미정'})을 달력에 적어 둡니다.")
    if bottleneck:
        tips.append(f"고비인 **{bottleneck[0]}**({bottleneck[1][2]}%)에 공부 시간을 더 둡니다. 기출을 단계별로 따로 풉니다.")
    if s.get("kind") == "T" and "필기" in agg and "실기" in agg:
        tips.append("국가기술자격은 필기에 붙으면 2년 동안 필기를 다시 보지 않습니다. 실기는 그 안에 여러 회차에 다시 볼 수 있습니다.")
    tips.append(f"응시 자격(학력·경력)은 [{name} 종목 페이지]({lic_url})에 등급별 기준을 적어 두었습니다. 종목별 예외는 큐넷 원문을 봅니다.")
    blocks.append(LIST(tips))
    blocks.append(NOTE(f"{t.isoformat()} 기준, 큐넷(q-net.or.kr) 종목별 일정과 수험자 동향을 {BRAND}이 모아 센 숫자입니다. 합격률은 응시자 대비 합격자이고 접수자 기준이 아닙니다. 일정은 큐넷 공고가 기준입니다."))

    if "필기" in agg and "실기" in agg:
        title = f"{name} 합격률 필기 {agg['필기'][2]}%·실기 {agg['실기'][2]}% — {t.year}년 남은 시험 일정과 준비 순서"
    else:
        title = f"{name} 합격률 {pct(passers, takers)}% — {t.year}년 남은 시험 일정과 준비 순서"
    summary = (f"큐넷 수험자 동향으로 {name}의 {yr_txt} 응시자 {n(takers)}명과 단계별 합격률을 세고, "
               + (f"{t.year}년 남은 시험 {len(upcoming)}회 일정을 표로 정리했습니다." if upcoming else "올해 일정과 같은 분야 종목을 함께 봅니다."))
    kw = [BRAND, name, f"{name} 합격률", f"{name} 시험일정", f"{name} 접수", f"{name} 난이도", f"{series} 합격률" if series else "자격증 합격률"]
    return {"slug": "license-" + slugify(name), "kind": "license", "subject": code, "title": title, "summary": summary,
            "keywords": kw, "body": blocks, "toc": toc}


# ── 시·군·구 ──────────────────────────────────────────────
def write_sigungu(s: dict) -> dict:
    sido, sg = s["sido"], s["sigungu"]
    sh = short_sido(sido) or sido
    full = f"{sh} {sg}"
    open_n, always_n, closing30 = int(s.get("open_n") or 0), int(s.get("always_n") or 0), int(s.get("closing30") or 0)
    sido_open = int(s.get("sido_open_n") or 0)
    jobs_3y, jobs_open = int(s.get("jobs_3y") or 0), int(s.get("jobs_open") or 0)
    search_url = f"/?sido={sido}&sigungu={sg}&via=story"
    area_url = f"/area/{sido}"
    blocks, toc = [], []

    topics = s.get("topics") or []
    lead = f"**{sido} {sg}**에서 지금 신청할 수 있는 복지·지원 사업은 **{n(open_n)}건**입니다. "
    if sido_open:
        lead += f"여기에 {sh} 주민이면 어디서나 되는 도 단위 사업 **{n(sido_open)}건**이 더 있습니다. "
    if topics:
        lead += f"가장 많은 분야는 **{topics[0]['k']}**({n(topics[0]['n'])}건)이고, "
    lead += f"접수 중인 {sg} 채용 공고는 **{n(jobs_open)}건**입니다." if jobs_open else f"오늘 기준 접수 중인 {sg} 채용 공고는 없습니다."
    blocks.append(P(lead.strip()))
    blocks.append(P(f"나이와 가구 조건을 넣어 걸러 보려면 [{full} 내 조건으로 찾기]({search_url}), {sh} 전체는 [{sh} 지원금 모아보기]({area_url})로 가세요."))

    if topics:
        toc.append(("topics", "어떤 분야가 많나"))
        blocks.append(H2("어떤 분야가 많나", "topics"))
        blocks.append(BARS([{"label": r["k"], "n": int(r["n"])} for r in topics]))
        share = pct(topics[0]["n"], open_n)
        txt = f"**{topics[0]['k']}**이 전체의 {share}%입니다."
        if share >= 50:
            txt += f" 한 분야에 크게 쏠려 있어, 다른 분야는 건수가 적더라도 [{sh} 지원금 모아보기]({area_url})에서 도 단위 사업과 함께 봐야 빠짐이 없습니다."
        else:
            txt += " 분야가 고르게 퍼져 있으니 내 상황에 맞는 분야부터 엽니다."
        blocks.append(P(txt))

    hh = s.get("household") or []
    youth_n, senior_n = int(s.get("youth_n") or 0), int(s.get("senior_n") or 0)
    if open_n and (hh or youth_n or senior_n):
        toc.append(("who", "누구에게 주나"))
        blocks.append(H2("누구에게 주나", "who"))
        if hh:
            blocks.append(BARS([{"label": r["k"], "n": int(r["n"])} for r in hh]))
        txt = ""
        if hh:
            txt += f"가구 조건이 적힌 사업 중에는 **{hh[0]['k']}** 대상이 {n(hh[0]['n'])}건으로 가장 많습니다. "
        if youth_n:
            txt += f"나이 상한이 45세 이하인 청년 대상은 {n(youth_n)}건({pct(youth_n, open_n)}%), "
        if senior_n:
            txt += f"60세 이상 어르신 대상은 {n(senior_n)}건({pct(senior_n, open_n)}%)입니다. "
        txt += "조건이 적히지 않은 사업은 가구 구분 없이 신청할 수 있습니다."
        blocks.append(P(txt.strip()))

    sup = s.get("support") or []
    if sup and open_n:
        toc.append(("how", "어떤 방식으로 주나"))
        blocks.append(H2("어떤 방식으로 주나", "how"))
        blocks.append(P(", ".join(f"**{r['k']}** {n(r['n'])}건" for r in sup) + "."))

    toc.append(("closing", "마감은 언제인가"))
    blocks.append(H2("마감은 언제인가", "closing"))
    soon = [r for r in (s.get("closing_list") or []) if r.get("end") and r["end"] <= (today() + dt.timedelta(days=365)).isoformat()]
    if closing30 and soon:
        blocks.append(P(f"**30일 안에 마감되는 사업이 {n(closing30)}건**입니다. 날짜가 적힌 것부터 봅니다."))
        blocks.append(LINKS([{"href": f"/p/{r['id']}", "label": f"{r['title']} — {kdate(r['end'])} 마감"} for r in soon]))
    elif soon:
        blocks.append(P("30일 안에 마감되는 사업은 없습니다. 날짜가 적힌 것 가운데 가까운 순입니다."))
        blocks.append(LINKS([{"href": f"/p/{r['id']}", "label": f"{r['title']} — {kdate(r['end'])} 마감"} for r in soon]))
    else:
        blocks.append(P(f"{sg} 사업 {n(open_n)}건 가운데 {n(always_n)}건({pct(always_n, open_n)}%)은 **마감일 없이 상시 접수**합니다. 다만 예산이 소진되면 그해 접수를 닫는 사업이 많으니, 조건이 되면 미루지 말고 신청합니다."))

    if s.get("sample"):
        toc.append(("sample", "지금 신청할 수 있는 사업 예"))
        blocks.append(H2("지금 신청할 수 있는 사업 예", "sample"))
        blocks.append(LINKS([{"href": f"/p/{r['id']}", "label": r["title"] + (f" · {kdate(r['end'])} 마감" if r.get("end") and not r.get("always") else " · 상시")} for r in s["sample"]]))

    if s.get("sido_sample"):
        toc.append(("sido", f"{sh} 도 단위 사업도 함께"))
        blocks.append(H2(f"{sh} 도 단위 사업도 함께", "sido"))
        blocks.append(P(f"{sg}에 살면 {sh}가 하는 사업 {n(sido_open)}건도 신청할 수 있습니다. 몇 가지만 들면 이렇습니다."))
        blocks.append(LINKS([{"href": f"/p/{r['id']}", "label": r["title"] + (f" · {kdate(r['end'])} 마감" if r.get("end") and not r.get("always") else " · 상시")} for r in s["sido_sample"]]))

    toc.append(("jobs", f"{sg} 채용 공고"))
    blocks.append(H2(f"{sg} 채용 공고", "jobs"))
    orgs = s.get("jobs_orgs") or []
    if jobs_3y:
        txt = f"최근 3년 나라일터에 올라온 {sg} 쪽 채용 공고는 **{n(jobs_3y)}건**입니다. "
        txt += "기관별로는 " + ", ".join(f"[{o['org']}](/jobs/org/{o['org']}) {n(o['n'])}건" for o in orgs[:4]) + "."
        blocks.append(P(txt))
        bm = s.get("jobs_by_month") or []
        peaks = peak_months(bm)
        if jobs_3y >= 24 and peaks:
            blocks.append(BARS(month_bars(bm)))
            top3 = sum(c for _, c in peaks)
            blocks.append(P(f"**{'·'.join(MONTHS[m - 1] for m, _ in peaks)}**에 {n(top3)}건, 전체의 {pct(top3, jobs_3y)}%가 올라왔습니다. 이 달들 앞뒤로 [{orgs[0]['org']} 채용 이력](/jobs/org/{orgs[0]['org']})을 확인해 두면 놓치지 않습니다." if orgs else ""))
        if s.get("jobs_open_list"):
            blocks.append(LINKS([{"href": f"/jobs/{r['id']}", "label": f"{r['title']} — {r.get('org') or ''} · {kdate(r['end'])} 마감"} for r in s["jobs_open_list"]]))
        else:
            blocks.append(P(f"오늘은 접수 중인 공고가 없습니다. [{sh} 채용 공고](/jobs/region/{sido})에서 가까운 지역을 함께 봅니다."))
    else:
        blocks.append(P(f"최근 3년 나라일터에 {sg} 이름이 적힌 기관의 공고는 없습니다. {sh} 전체 공고는 [{sh} 채용 공고](/jobs/region/{sido})에서 봅니다."))

    toc.append(("howto", "이렇게 찾으세요"))
    blocks.append(H2("이렇게 찾으세요", "howto"))
    blocks.append(LIST([
        f"[{full} 내 조건으로 찾기]({search_url})에 나이와 가구 상황을 넣습니다. {sg} 사업과 {sh} 사업이 함께 나옵니다.",
        "시·군·구 사업은 그 지역에 주소를 둔 사람만 됩니다. 이사 계획이 있으면 전입 뒤 다시 확인합니다.",
        f"사업 쪽을 열어 **지원대상·선정기준** 원문을 확인합니다. 같은 이름이라도 지자체마다 금액과 조건이 다릅니다.",
    ]))
    blocks.append(NOTE(f"{today().isoformat()} 기준, 복지로·지자체 공고와 나라일터 공고를 {BRAND}이 매일 모아 센 숫자입니다. 중앙부처의 전국 사업은 이 집계에서 빠져 있고, 채용은 기관 이름에 '{sg}'가 든 공고만 센 것입니다."))

    title = f"{sido} {sg} 지원금 {n(open_n)}건 — 분야·대상별 현황과 {sg} 채용 {n(jobs_open)}건"
    summary = (f"{sido} {sg}에서 지금 신청할 수 있는 복지·지원 사업 {n(open_n)}건을 분야·대상·지원 방식으로 세고, "
               f"{sh} 도 단위 사업 {n(sido_open)}건과 {sg} 채용 공고를 함께 정리했습니다.")
    kw = [BRAND, f"{sg} 지원금", f"{sido} {sg} 복지", f"{sg} 청년 지원", f"{sg} 채용", f"{sg} 보조금", f"{BRAND} {sg}", "지자체 지원금"]
    return {"slug": f"sigungu-{slugify(sh)}-{slugify(sg)}", "kind": "sigungu", "subject": f"{sido} {sg}", "title": title, "summary": summary,
            "keywords": kw, "body": blocks, "toc": toc}


# ── 글감 고르기 ──────────────────────────────────────────
def rpc(sb, name: str, params: dict, tries: int = 3):
    """DB 함수 호출. 읽기 시간 초과(httpx.ReadTimeout)가 가끔 나서 세 번까지 다시 부른다."""
    for i in range(tries):
        try:
            return sb.rpc(name, params).execute().data
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            print(f"  {name} 다시 시도 {i + 1}/{tries - 1}: {type(e).__name__}", file=sys.stderr)
            time.sleep(15 * (i + 1))


def pick(kind: str, done: set[tuple[str, str]], sb, subject: str | None = None) -> tuple[str, dict]:
    """(subject, stats)"""
    if kind == "topic":
        cands = [t for t in TOPICS if subject in (None, t["slug"], t["label"])]
        fresh = [t for t in cands if ("topic", t["slug"]) not in done] or cands
        for t in fresh:
            s = rpc(sb, "blog_topic_stats", {"p_q": t["q"], "p_who": t["who"]})
            if int(s.get("open_n") or 0) >= 5:
                return t["slug"], {"topic": t, "stats": s}
        raise SystemExit("주제 글감 없음(열린 사업 5건 미만)")
    if kind == "org":
        if subject:
            return subject, {"stats": rpc(sb, "blog_org_stats", {"p_org": subject})}
        cands = rpc(sb, "blog_org_candidates", {"p_min": 40, "p_limit": 300}) or []
        fresh = [c for c in cands if ("org", c["org"]) not in done] or cands
        org = fresh[0]["org"]
        return org, {"stats": rpc(sb, "blog_org_stats", {"p_org": org})}
    if kind == "role":
        cands = [r for r in ROLES if subject in (None, r["key"], r["name"])]
        fresh = [r for r in cands if ("role", r["key"]) not in done] or cands
        for r in fresh:
            s = rpc(sb, "blog_role_stats", {"p_terms": r["terms"]})
            if int(s.get("n3y") or 0) >= 20:
                return r["key"], {"role": r, "stats": s}
        raise SystemExit("직무 글감 없음(3년 공고 20건 미만)")
    if kind == "region":
        rows = sb.table("regions_available").select("sido").execute().data or []
        sidos = sorted({r["sido"] for r in rows if r.get("sido")})
        cands = [s for s in sidos if subject in (None, s, short_sido(s))]
        fresh = [s for s in cands if ("region", s) not in done] or cands
        sido = fresh[0]
        return sido, {"stats": rpc(sb, "blog_region_stats", {"p_sido": sido})}
    if kind == "license":
        cands = rpc(sb, "blog_license_candidates", {"p_min_takers": 3000, "p_limit": 300}) or []
        cands = [c for c in cands if subject in (None, c["code"], c["name"])]
        fresh = [c for c in cands if ("license", c["code"]) not in done] or cands
        for c in fresh:
            s = rpc(sb, "blog_license_stats", {"p_code": c["code"]})
            if s.get("name") and int(s.get("takers_3y") or 0) >= 1000 and s.get("by_year"):
                return c["code"], {"stats": s}
        raise SystemExit("자격증 글감 없음(수험자 동향 없음)")
    if kind == "sigungu":
        cands = rpc(sb, "blog_sigungu_candidates", {"p_min": 15, "p_limit": 300}) or []
        cands = [c for c in cands if subject in (None, c["sigungu"], f"{c['sido']} {c['sigungu']}", f"{short_sido(c['sido'])} {c['sigungu']}")]
        fresh = [c for c in cands if ("sigungu", f"{c['sido']} {c['sigungu']}") not in done] or cands
        if not fresh:
            raise SystemExit("시·군·구 글감 없음(열린 사업 15건 미만)")
        c = fresh[0]
        return f"{c['sido']} {c['sigungu']}", {"stats": rpc(sb, "blog_sigungu_stats", {"p_sido": c["sido"], "p_sigungu": c["sigungu"]})}
    raise SystemExit(f"모르는 갈래: {kind}")


def compose(kind: str, picked: dict) -> dict:
    if kind == "topic": return write_topic(picked["topic"], picked["stats"])
    if kind == "org": return write_org(picked["stats"])
    if kind == "role": return write_role(picked["role"], picked["stats"])
    if kind == "region": return write_region(picked["stats"])
    if kind == "license": return write_license(picked["stats"])
    return write_sigungu(picked["stats"])


def kinds_today(count: int, day: int | None = None) -> list[str]:
    """오늘 차례의 갈래. 둘이면 세 갈래 건너 짝(주제+지역, 기관+자격증, 직무+시군구)이 된다."""
    d = today().timetuple().tm_yday if day is None else day
    return [KINDS[(d + i * (len(KINDS) // 2)) % len(KINDS)] for i in range(max(1, min(count, len(KINDS))))]


def write_one(sb, kind: str, subject: str | None, done: set[tuple[str, str]], dry: bool) -> str:
    subject, picked = pick(kind, done, sb, subject)
    post = compose(kind, picked)
    post["stats"] = picked["stats"]
    toc = post.pop("toc")
    post["body"] = [{"type": "toc", "items": [{"id": i, "label": l} for i, l in toc]}] + post["body"]

    print(f"[{kind}] {subject} → {post['slug']}: {post['title']}")
    if dry:
        print(json.dumps(post, ensure_ascii=False, indent=1)[:4000])
        return post["slug"]
    row = {k: post[k] for k in ("slug", "kind", "subject", "title", "summary", "keywords", "body", "stats")}
    row["updated_at"] = "now()"
    if (kind, subject) not in done:
        row["published_at"] = today().isoformat()
    sb.table("blog_posts").upsert(row, on_conflict="slug").execute()
    done.add((kind, subject))
    print(f"저장: {SITE}/story/{post['slug']}")
    return post["slug"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kind", choices=KINDS)
    ap.add_argument("--subject")
    ap.add_argument("--count", type=int, default=1, help="오늘 차례에서 몇 갈래를 쓸지(갈래를 지정하면 무시)")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    from supabase import create_client
    url, key = os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"]
    try:
        from supabase import ClientOptions
        sb = create_client(url, key, options=ClientOptions(postgrest_client_timeout=120))
    except Exception:  # noqa: BLE001 — 옛 버전은 옵션 이름이 다르다
        sb = create_client(url, key)

    rows = sb.table("blog_posts").select("kind,subject").execute().data or []
    done = {(r["kind"], r["subject"]) for r in rows}
    kinds = [a.kind] if a.kind else kinds_today(a.count)
    written = 0
    for kind in kinds:
        try:
            write_one(sb, kind, a.subject if a.kind else None, done, a.dry)
            written += 1
        except SystemExit as e:
            print(f"[{kind}] 건너뜀: {e}", file=sys.stderr)
        except Exception as e:  # noqa: BLE001 — 한 갈래가 실패해도 다음 갈래는 쓴다
            print(f"[{kind}] 실패: {type(e).__name__}: {e}", file=sys.stderr)
    if not written:
        sys.exit(1)


if __name__ == "__main__":
    main()
