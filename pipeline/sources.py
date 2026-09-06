"""
sources.py — 4개 API의 응답을 공통 형태로 바꾸는 어댑터

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


ADAPTERS = {
    "bokjiro_local": from_bokjiro_local,
    "bokjiro_central": from_bokjiro_central,
    "bizinfo_support": from_bizinfo_support,
    "bizinfo_event": from_bizinfo_event,
}
