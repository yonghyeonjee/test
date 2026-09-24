"""
sources.py — 각 소스의 응답을 공통 형태로 바꾸는 어댑터

각 소스마다 필드명이 다르므로, 여기서만 차이를 흡수한다.
반환 형태는 programs 테이블 컬럼과 1:1로 맞춘 dict.
정규화 컬럼(age_min, income_pct 등)은 여기서 건드리지 않는다 -> normalize.py 담당.
"""

import html
import re
from datetime import date, datetime

from revenue import parse_revenue_cap

# ── 공통 유틸 ────────────────────────────────────────────────

TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"[ \t\xa0]+")


def clean(s):
    """HTML 태그 제거 + 엔티티 복원 + 공백 정리"""
    if not s:
        return None
    s = TAG_RE.sub(" ", str(s))
    s = html.unescape(s)
    s = html.unescape(s)          # &#9312; 이중 인코딩 대응
    s = WS_RE.sub(" ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = s.strip()
    return s or None


def dedup(*texts):
    """지자체는 sprtTrgtCn 과 slctCritCn 이 같은 경우가 잦다. 중복 제거."""
    out, seen = [], set()
    for t in texts:
        t = clean(t)
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return "\n\n".join(out) if out else None


def ymd(s):
    """20260905 -> date. 99991231 등 무기한은 None."""
    if not s:
        return None
    s = str(s).strip()
    if not re.fullmatch(r"\d{8}", s):
        return None
    if s.startswith("9999"):
        return None
    try:
        return datetime.strptime(s, "%Y%m%d").date().isoformat()
    except ValueError:
        return None


def is_forever(s):
    return bool(s) and str(s).strip().startswith("9999")


def split_list(s):
    """'서민금융, 일자리' / '보육,보호·돌봄' 둘 다 처리"""
    if not s:
        return None
    parts = [p.strip() for p in str(s).split(",")]
    parts = [p for p in parts if p]
    return parts or None


def parse_range_de(s):
    """'2026-09-03 ~ 2026-09-17' -> (start, end)"""
    if not s:
        return None, None
    m = re.findall(r"(\d{4})[-.](\d{2})[-.](\d{2})", str(s))
    if not m:
        return None, None
    def mk(t):
        try:
            return date(int(t[0]), int(t[1]), int(t[2])).isoformat()
        except ValueError:
            return None
    if len(m) > 1:
        return mk(m[0]), mk(m[1])
    # '~ 2026-09-18' 처럼 물결이 앞에 오면 단일 날짜는 마감일
    if str(s).strip().startswith("~"):
        return None, mk(m[0])
    return mk(m[0]), None


def parse_event_de(s):
    """'20260919 ~ 20260919' -> (start, end)"""
    if not s:
        return None, None
    m = re.findall(r"\d{8}", str(s))
    if not m:
        return None, None
    return ymd(m[0]), ymd(m[1] if len(m) > 1 else m[0])


# ── 시도 추출 (bizinfo hashtags 용) ──────────────────────────

SIDO_ALIAS = {
    "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시",
    "인천": "인천광역시",
    # 2026-07-01 전남광주통합특별시 출범 (광주광역시 + 전라남도)
    "광주": "전남광주통합특별시", "전남광주": "전남광주통합특별시",
    "전남": "전남광주통합특별시", "전라남도": "전남광주통합특별시",
    "광주광역시": "전남광주통합특별시", "전남광주통합특별시": "전남광주통합특별시",
    "대전": "대전광역시", "울산": "울산광역시", "세종": "세종특별자치시",
    "경기": "경기도", "강원": "강원특별자치도",
    "충북": "충청북도", "충남": "충청남도",
    "전북": "전북특별자치도",
    "경북": "경상북도", "경남": "경상남도", "제주": "제주특별자치도",
}


def sido_from_hashtags(tags: str):
    """
    해시태그에서 시도를 뽑는다.
    17개 시도가 전부 들어있으면 '전국' 공고이므로 None(=전국) 반환.
    2개 이상이어도 특정이 안 되므로 None.
    """
    if not tags:
        return None
    found = {SIDO_ALIAS[t.strip()] for t in str(tags).split(",")
             if t.strip() in SIDO_ALIAS}
    if len(found) == 1:
        return found.pop()
    return None


def norm_sido(s):
    if not s:
        return None
    s = str(s).strip()
    if s in ("전국", ""):
        return None
    return SIDO_ALIAS.get(s, s)


# ── 어댑터 ───────────────────────────────────────────────────

def from_bokjiro_local(item: dict, detail: dict | None) -> dict:
    d = detail or {}
    end_raw = d.get("enfcEndYmd")
    return {
        "kind": "welfare",
        "source": "bokjiro_local",
        "source_id": item.get("servId"),
        "title": clean(item.get("servNm")),
        "summary": clean(item.get("servDgst")),
        "detail_url": item.get("servDtlLink"),
        "org_name": clean(item.get("ctpvNm")),
        "dept_name": clean(item.get("bizChrDeptNm")),

        "sido": norm_sido(item.get("ctpvNm")),
        "sigungu": clean(item.get("sggNm")),

        "life_cycle": split_list(item.get("lifeNmArray")),
        "household": split_list(item.get("trgterIndvdlNmArray")),
        "topics": split_list(item.get("intrsThemaNmArray")),

        "apply_start": ymd(d.get("enfcBgngYmd")),
        "apply_end": ymd(end_raw),
        "is_always_on": is_forever(end_raw),

        "support_type": clean(item.get("srvPvsnNm")),
        "support_cycle": clean(item.get("sprtCycNm")),
        "apply_method": clean(item.get("aplyMtdNm") or d.get("aplyMtdCn")),
        "contact": clean(d.get("wlfareInfoReldCn")),

        "raw_target": clean(d.get("sprtTrgtCn")),
        "raw_criteria": (None
                         if clean(d.get("slctCritCn")) == clean(d.get("sprtTrgtCn"))
                         else clean(d.get("slctCritCn"))),
        "raw_benefit": clean(d.get("alwServCn")),
    }


def from_bokjiro_central(item: dict, detail: dict | None) -> dict:
    d = detail or {}
    return {
        "kind": "welfare",
        "source": "bokjiro_central",
        "source_id": item.get("servId"),
        "title": clean(item.get("servNm")),
        "summary": clean(item.get("servDgst") or d.get("wlfareInfoOutlCn")),
        "detail_url": item.get("servDtlLink"),
        "org_name": clean(item.get("jurMnofNm")),
        "dept_name": clean(item.get("jurOrgNm")),

        "sido": None,          # 중앙부처 = 전국
        "sigungu": None,

        "life_cycle": split_list(item.get("lifeArray") or d.get("lifeArray")),
        "household": split_list(item.get("trgterIndvdlArray") or d.get("trgterIndvdlArray")),
        "topics": split_list(item.get("intrsThemaArray") or d.get("intrsThemaArray")),

        "apply_start": None,
        "apply_end": None,
        "is_always_on": True,   # 중앙부처 사업은 상시가 기본

        "online_apply": (item.get("onapPsbltYn") == "Y") if item.get("onapPsbltYn") else None,
        "support_type": clean(item.get("srvPvsnNm")),
        "support_cycle": clean(item.get("sprtCycNm")),
        "contact": clean(item.get("rprsCtadr")),

        "raw_target": clean(d.get("tgtrDtlCn")),
        "raw_criteria": clean(d.get("slctCritCn")),
        "raw_benefit": clean(d.get("alwServCn")),
    }


def from_bizinfo_support(item: dict, detail=None) -> dict:
    start, end = parse_range_de(item.get("reqstBeginEndDe"))
    return {
        "kind": "business",
        "source": "bizinfo_support",
        "source_id": item.get("pblancId"),
        "title": clean(item.get("pblancNm")),
        "summary": (clean(item.get("bsnsSumryCn")) or "")[:600] or None,
        "detail_url": item.get("pblancUrl"),
        "org_name": clean(item.get("jrsdInsttNm")),
        "dept_name": clean(item.get("excInsttNm")),

        "sido": sido_from_hashtags(item.get("hashtags")),
        "sigungu": None,

        "biz_field": split_list(item.get("pldirSportRealmLclasCodeNm")),

        "apply_start": start,
        "apply_end": end,
        "is_always_on": end is None,

        "apply_method": clean(item.get("reqstMthPapersCn")),
        "contact": clean(item.get("refrncNm")),

        "raw_target": clean(item.get("trgetNm")),
        "raw_criteria": clean(item.get("hashtags")),
        "raw_benefit": clean(item.get("bsnsSumryCn")),

        # 신청 자격의 매출 상한. 못 뽑으면 None 이고, 그 공고는 매출로 거르지 않는다.
        "revenue_max": parse_revenue_cap(
            clean(item.get("trgetNm")),
            clean(item.get("bsnsSumryCn")),
        ),
    }


def from_bizinfo_event(item: dict, detail=None) -> dict:
    start, end = parse_event_de(item.get("eventBeginEndDe"))
    _, rcept_end = parse_range_de(item.get("rceptPd"))
    return {
        "kind": "event",
        "source": "bizinfo_event",
        "source_id": item.get("eventInfoId"),
        "title": clean(item.get("nttNm")),
        "summary": (clean(item.get("nttCn")) or "")[:600] or None,
        "detail_url": item.get("orginlUrlAdres"),
        "org_name": clean(item.get("originEngnNm")),

        "sido": norm_sido(item.get("areaNm")) or sido_from_hashtags(item.get("hashtags")),
        "sigungu": None,

        "biz_field": split_list(item.get("pldirSportRealmLclasCodeNm")),

        "apply_start": start,
        "apply_end": rcept_end or end,
        "is_always_on": False,

        "support_type": clean(item.get("eventInfoTyNm")),

        "raw_benefit": clean(item.get("nttCn")),
    }


# ── 소상공인24 ───────────────────────────────────────────────

# 시도 정식 명칭(값)과 줄임말(키)을 긴 것부터 찾는다. "전북특별자치도" 를
# "전북" 보다 먼저 봐야 한다.
_SIDO_NAMES = sorted({*SIDO_ALIAS.keys(), *SIDO_ALIAS.values()}, key=len, reverse=True)
_SIDO_RX = re.compile("|".join(map(re.escape, _SIDO_NAMES)))
_BRACKET_RX = re.compile(r"^\s*[\[(]\s*([가-힣]{2,10})\s*[\])]")

# 화면 주소. 해시 라우터라 서버 경로가 아니라 #/ 뒤에 붙는다.
SBIZ_URL = {
    "A": "https://www.sbiz24.kr/#/pbanc/{sn}",
    "D": "https://www.sbiz24.kr/#/lcgPbanc/{sn}",
    "C": "https://www.sbiz24.kr/#/loanProduct/{sn}",
}


def sido_in_text(*texts):
    """
    '[전북] …', '「2026년 울산광역시 …」' 처럼 제목·지역 필드에 박힌 시도를 뽑는다.
    두 곳 이상이 나오면 특정이 안 되므로 None(=전국).
    """
    found = set()
    for t in texts:
        if not t:
            continue
        t = str(t)
        m = _BRACKET_RX.match(t)
        if m and m.group(1) in SIDO_ALIAS:
            found.add(SIDO_ALIAS[m.group(1)])
        for name in _SIDO_RX.findall(t):
            found.add(SIDO_ALIAS.get(name, name))
    return found.pop() if len(found) == 1 else None


_SEC_STOP = r"(?=\n\s*(?:[□■○◦●▶▷※•·\-]|\d+\.|[가-힣]\.|[①-⑳])|\n\s*(?:지원\s*내용|지원\s*규모|사업\s*내용|신청\s*기간|접수\s*기간|신청\s*방법|접수\s*방법|제출\s*서류|선정\s*방법|문의)|$)"
_SEC_TARGET = re.compile(r"(?:지원|신청|모집|참여|공고)\s*(?:대상|자격)(?:\s*(?:및|/)\s*(?:자격|요건|조건))?\s*[:：]?\s*(.+?)" + _SEC_STOP, re.S)
_SEC_CRIT = re.compile(r"(?:(?:신청|참여)\s*자격|(?:신청|지원|참여|자격)\s*(?:요건|조건))\s*[:：]?\s*(.+?)" + _SEC_STOP, re.S)


def tidy(text):
    """
    소상공인24 본문은 <p> 마다 줄바꿈이 있고 빈 문단이 많아 ' \n \n \n ' 이
    길게 이어진다. 줄 앞뒤 공백을 걷고 빈 줄은 하나만 남긴다.
    """
    if not text:
        return None
    text = re.sub(r"[ \t]*\n[ \t]*", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() or None


def section(text, rx, limit=600):
    """공고 본문에서 '□ 지원대상 : …' 같은 항목의 본문만 잘라 온다."""
    if not text:
        return None
    m = rx.search(text)
    if not m:
        return None
    body = m.group(1).strip(" :：-\n")
    body = re.sub(r"\n{2,}", "\n", body)
    return body[:limit] or None


_PHONE = re.compile(r"0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}")


def contact_from(body):
    """본문에서 전화번호가 처음 나오는 줄을 문의처로 쓴다. '- 사업문의 : 담당자(02-742-3771)' 같은 줄."""
    if not body:
        return None
    for line in body.split("\n"):
        if _PHONE.search(line):
            line = line.strip(" -:：※☞▶•·")
            return line[:160] or None
    return None


def _sbiz_dates(item: dict, detail: dict):
    """접수기간. 목록의 aplyPd('2026-09-14 ~ 2026-09-28' / '상시')가 우선, 없으면 상세 rcptPd."""
    aply = (item.get("aplyPd") or "").strip()
    start, end = parse_range_de(aply)
    if start is None and end is None:
        rp = detail.get("rcptPd") if isinstance(detail.get("rcptPd"), dict) else {}
        start, _ = parse_range_de(rp.get("from"))
        end, _ = parse_range_de(rp.get("to"))
    always = aply == "상시" or (start is None and end is None)
    return start, end, always


def _sbiz_pbanc(item: dict, d: dict) -> dict:
    """A 공단지원사업 / D 지방정부사업. 상세는 /api/pbanc/{sn}."""
    g, sn = item.get("pbancGubun"), item.get("pbancSn")
    body = tidy(clean(d.get("pbancDtlCn")))
    target = section(body, _SEC_TARGET)
    crit = section(body, _SEC_CRIT)
    who = clean(item.get("rcrtTypeCdNm") or d.get("rcrtTypeCdNm"))
    # 정규화 규칙이 '소상공인' 같은 대상 어휘를 raw_target 에서 찾는다.
    # 공고 유형(소상공인/예비창업자)을 앞에 붙여 두면 본문에 대상 항목이 없어도 걸린다.
    raw_target = dedup(who, target) if target else dedup(who, (body or "")[:500])
    start, end, always = _sbiz_dates(item, d)
    sido = sido_in_text(d.get("ctpvCdNm"), d.get("pbancRgn")) or sido_in_text(item.get("pbancNm"))
    org = clean(item.get("departNm") or d.get("rprsInstNm"))
    return {
        "kind": "business",
        "source": "sbiz24",
        "source_id": f"P{sn}",
        "title": clean(item.get("pbancNm") or d.get("pbancNm")),
        "summary": (body or "")[:600] or None,
        "detail_url": SBIZ_URL[g].replace("{sn}", str(sn)),
        "org_name": org,
        "dept_name": None,   # sprtBizTypeNm 은 내부 분류 라벨이라 화면에 낼 게 못 된다

        "sido": sido,
        "sigungu": None,

        "apply_start": start,
        "apply_end": end,
        "is_always_on": always,

        "support_type": clean(item.get("bizType")),
        "contact": contact_from(body),
        "online_apply": True if d.get("pbancAplyYn") in (True, "Y") else None,
        "apply_method": "소상공인24 온라인 신청" if d.get("pbancAplyYn") in (True, "Y") else None,

        "raw_target": raw_target,
        "raw_criteria": crit if crit and crit != target else None,
        "raw_benefit": (body or "")[:4000] or None,

        "revenue_max": parse_revenue_cap(raw_target, body),
    }


def _num(s):
    try:
        return int(float(str(s).replace(",", "")))
    except (TypeError, ValueError):
        return None


def _sbiz_loan(item: dict, d: dict) -> dict:
    """C 대출상품. 상세는 /api/loanProduct/{sn}. 공고가 아니라 상시 상품이다."""
    sn = item.get("pbancSn")
    who = clean(d.get("trgtCn"))
    cond = clean(d.get("sprtTrgtDtlCndCn"))
    extras = []
    for label, key in (("나이", "ageVl"), ("소득", "earnInfoCn"), ("신용", "crdtScrCn")):
        v = clean(d.get(key))
        if v and v not in ("없음", "-"):
            extras.append(f"{label}: {v}")
    raw_target = dedup(clean(item.get("rcrtTypeCdNm")), who, cond, "\n".join(extras) or None)

    limit = _num(d.get("loanLimitVl"))
    benefit = []
    if limit:
        benefit.append(f"대출 한도 {limit:,}만원")
    for label, key in (("금리", "irVl"), ("금리 방식", "irTypeVl"), ("대출 기간", "totalLoanPdCn"),
                       ("상환 방법", "rpmtMthdCn"), ("용도", "useUsgVl"), ("취급 기관", "trmtInstNm"),
                       ("기타", "etcRfrncMttrCn")):
        v = clean(d.get(key))
        if not v or v in ("없음", "-"):
            continue
        if label == "금리" and re.search(r"\d$", v):
            v += "%"
        # 원천 데이터에 금리 방식 칸에 금리 숫자를 다시 적은 상품이 있다
        if label == "금리 방식" and v == clean(d.get("irVl")):
            continue
        if label == "대출 기간" and re.fullmatch(r"\d+", v):
            v += "년"
        benefit.append(f"{label}: {v}")
    region = clean(d.get("srvcPvsnRgnVl"))
    return {
        "kind": "business",
        "source": "sbiz24",
        "source_id": f"L{sn}",
        "title": clean(item.get("pbancNm") or d.get("fncGdsNm")),
        "summary": ("; ".join(benefit))[:600] or None,
        "detail_url": SBIZ_URL["C"].replace("{sn}", str(sn)),
        "org_name": clean(d.get("pvsnInstNm") or item.get("departNm")),
        "dept_name": clean(d.get("trmtInstNm")),

        "sido": sido_in_text(region) if region and region != "전국" else None,
        "sigungu": None,

        "apply_start": None,
        "apply_end": None,
        "is_always_on": True,

        "support_type": "대출",
        "apply_method": clean(d.get("joinMthdCn")),
        "contact": clean(d.get("rfrnMttr")),

        "raw_target": raw_target,
        "raw_criteria": clean(d.get("excptnMttr")) if clean(d.get("excptnMttr")) not in (None, "-") else None,
        "raw_benefit": "\n".join(benefit) or None,

        "amount_max": limit * 10000 if limit else None,
    }


def from_sbiz24(item: dict, detail: dict | None) -> dict | None:
    """
    소상공인24 통합조회 한 건. 상세가 없으면(B, 또는 상세 실패) None —
    B 는 기업마당 미러라 bizinfo_support 에 이미 있고, 나머지는 상세가 있어야
    대상 문구가 생긴다.
    """
    g = item.get("pbancGubun")
    if not detail or item.get("pbancSn") is None:
        return None
    if g in ("A", "D"):
        row = _sbiz_pbanc(item, detail)
    elif g == "C":
        row = _sbiz_loan(item, detail)
    else:
        return None
    # 목록에는 있는데 상세가 빈 껍데기로 오는 건이 있다(내려간 대출상품 등).
    # 제목 없는 행은 programs 의 NOT NULL 에 걸리므로 여기서 거른다.
    return row if row.get("title") else None


ADAPTERS = {
    "bokjiro_local": from_bokjiro_local,
    "bokjiro_central": from_bokjiro_central,
    "bizinfo_support": from_bizinfo_support,
    "bizinfo_event": from_bizinfo_event,
    "sbiz24": from_sbiz24,
}
