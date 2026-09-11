"""
정규화 규칙 검증. 전부 DB 에 실제로 있던 원문이다.

    python -m pytest pipeline/test_normalize.py -q
    python pipeline/test_normalize.py            # pytest 없이
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from normalize import (  # noqa: E402
    normalize_business, normalize_welfare, parse_age, parse_income, parse_years,
)

AGE_CASES = [
    # (원문, age_min, age_max)
    ("거창군에 주소를 둔, 70세이상 어르신", 70, None),
    ("연천군 거주 1년 이상 만 65세이상 어르신", 65, None),
    ("8세~13세(만7세~만12세)", 8, 13),
    ("신청연도 기준 음성군에 주민등록을 두고 있는 19세~39세 이하 부모님과 별도 거주 무주택 청년", 19, 39),
    ("1) 주소지가 음성군으로 등록되어 있는 자(신청일 기준)2) 19 ~ 39세3) 관내 또는 관외", 19, 39),
    ("어린이집 이용 만3세~만5세 아동 *생애 최초 1회 지급", 3, 5),
    ("정부 미지원(민간, 가정)어린이집에 재원 중인 만 3~5세아", 3, 5),
    ("실제 영농에 종사하는 만20세이상~ 만75세 미만의 여성농업인으로 2025.1.1이전 농업경영체 등록자", 20, 74),
    ("만18세이상 재산 3억원이하 실업자또는 정기소득이 없는 일용근로자", 18, None),
    ("만 19세 이상 34세 이하 청년", 19, 34),
    ("생후 24개월 미만 영아", None, 1),
    ("생후 36개월 이하", None, 3),
    ("만 65세 미만", None, 64),
    # 연도·횟수·세대는 나이가 아니다
    ("'26. 1. 1.이후 출생아, 1∼2회 지급, 3개월 전부터 거주, 6개월 이내 신청", None, None),
    ("2세대 이상 동거 가구", None, None),
    ("2025년 1월 1일 기준 3세대", None, None),
    # 숫자가 없을 때 어휘
    ("초등학생", 6, 12),
    ("어린이집에 재원 중인 영유아", 0, 6),
    ("관내 어르신 무료 급식", 65, None),
    # 종사자 이야기면 어휘를 쓰지 않는다
    ("어린이집 보육교사 처우개선비", None, None),
    ("노인복지관 종사자 수당", None, None),
    ("노숙인 및 연고자가 없는 자", None, None),
]


def test_age():
    for text, lo, hi in AGE_CASES:
        got = parse_age(text)[:2]
        assert got == (lo, hi), f"{text!r}: {got} != {(lo, hi)}"


def test_income():
    assert parse_income("청년 기준중위소득 150% 이하 ※ 소득이 없는 경우") == 150
    assert parse_income("기초생활수급자(기준 중위소득 50%이하) 가구") == 50
    assert parse_income("생계급여(30%), 의료급여(40%), 주거 48%, 교육 중위소득 50% 이하") == 50
    assert parse_income("재산 3억원 이하") is None


def test_years():
    assert parse_years("사업 공고일 기준 창업 후 만 5년 이내인 자") == (None, 5)
    assert parse_years("업력 3년 이상 중소기업") == (3, None)
    assert parse_years("창업 7년 미만") == (None, 6)
    assert parse_years("2026년 사업") == (None, None)


def test_welfare_rows():
    # 음성군 청년월세: 나이·무주택·소득이 다 잡혀야 한다
    r = normalize_welfare({
        "raw_target": "신청연도 기준 음성군에 주민등록을 두고 있는 19세~39세 이하 부모님과 별도 거주 무주택 청년 - (소득) 청년 기준중위소득 150% 이하",
        "raw_criteria": "청년 기준중위소득 150% 이하",
        "household": None,
    })
    assert (r["age_min"], r["age_max"]) == (19, 39)
    assert "무주택" in r["household"]
    assert r["income_pct"] == 150
    assert r["norm_confidence"] >= 0.9

    # 진천 출생지원금: 나이는 없지만 다자녀·출산으로 화면에는 나와야 한다
    r = normalize_welfare({
        "raw_target": "❍ (지원대상) 진천군 출생가정 (’26. 1. 1.이후 출생아 ) ※ 셋째아 이하(100만원) / 넷째아(500만원) ❍ (신청시기) 출생신고 후 6개월 이내",
        "raw_criteria": None, "household": None,
    })
    assert r["age_min"] is None and r["age_max"] is None
    assert "다자녀" in r["household"] and "임산부" in r["household"]
    assert r["norm_confidence"] > 0.3

    # 원본 household 는 유지하고 본문에서 찾은 것을 더한다
    r = normalize_welfare({
        "raw_target": "장애인복지법 제32조에 의한 등록장애인 임신, 출산 또는 영유아 자녀를 둔 여성장애인 중증 및 고령의 독거 여성장애인",
        "raw_criteria": None, "household": ["장애인"],
    })
    assert r["household"][0] == "장애인"
    assert "1인가구" in r["household"] and "임산부" in r["household"]

    # 걸 만한 게 없으면 0.2 — 화면에서 빠진다
    r = normalize_welfare({"raw_target": "노숙인 및 연고자가 없는 자",
                           "raw_criteria": "긴급하게 잠자리가 필요한 자", "household": None})
    assert r["norm_confidence"] == 0.2

    # 취업 상태
    r = normalize_welfare({"raw_target": "창원시 여성폭력관련시설 종사자 사회복지자격수당",
                           "raw_criteria": "종사자 사회복지사 자격유무", "household": None})
    assert r["employment"] == ["재직"]
    r = normalize_welfare({"raw_target": "사천시 관내에 거주하는 기초생활보장수급자 자녀 대학생",
                           "raw_criteria": None, "household": None})
    assert "학생" in r["employment"] and "저소득" in r["household"]


def test_business_rows():
    r = normalize_business({
        "title": "2026년 로봇분야 예비창업자 및 재창업자를 위한 창업 성장 프로그램 참가자 모집 공고",
        "raw_target": "창업벤처",
        "raw_criteria": "창업,서울,부산,2026,한국로봇산업진흥원,로봇,컨설팅,예비창업,초기창업,재창업",
    })
    assert r["biz_target"] == ["예비창업자", "창업기업"]
    assert r["industry"] is None
    assert r["norm_confidence"] > 0.3

    r = normalize_business({
        "title": "[울산] 2026년 뿌리기업 기술애로 해결 및 제품 고도화 지원사업 모집공고",
        "raw_target": "중소기업",
        "raw_criteria": "기술,울산,2026,뿌리산업,3D프린팅",
    })
    assert r["biz_target"] == ["중소기업"]
    assert r["industry"] == ["제조업"]

    # 해시태그에 '관광'이 있다고 업종을 붙이지 않는다 — 붙이면 다른 업종에서 안 보인다
    r = normalize_business({
        "title": "AI 기반 지역관광 문제해결 프로젝트 AI 배리어프리 부문 모집 공고",
        "raw_target": "중소기업",
        "raw_criteria": "기술,서울,관광,한국관광공사,AI",
    })
    assert r["industry"] is None

    r = normalize_business({
        "title": "[제주] 서귀포시 2026년 소상공인 출산급여 지원사업 공고",
        "raw_target": "여성기업",
        "raw_criteria": "인력,제주,소상공인,출산급여,1인여성소상공인",
    })
    assert "소상공인" in r["biz_target"]

    r = normalize_business({
        "title": "청년창업 초기기업 지원", "raw_target": "중소기업",
        "raw_criteria": "창업 후 만 5년 이내, 업력 1년 이상",
    })
    assert (r["biz_years_min"], r["biz_years_max"]) == (1, 5)


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
