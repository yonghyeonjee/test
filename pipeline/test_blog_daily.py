"""blog_daily 의 문장 만들기. DB 없이 고정 숫자로 돌린다.
   python pipeline/test_blog_daily.py"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import blog_daily as b  # noqa: E402

bad = 0
def ok(c, m):
    global bad
    if not c:
        bad += 1; print("  ✗", m)

ORG = {"org": "한국농어촌공사", "total": 421, "n3y": 214, "open_n": 1, "first_reg": "2009-04-09", "last_reg": "2026-09-30",
       "by_year": [{"y": 2022, "n": 61}, {"y": 2023, "n": 57}, {"y": 2024, "n": 57}, {"y": 2025, "n": 85}, {"y": 2026, "n": 63}],
       "by_month": [{"m": m, "n": n} for m, n in zip(range(1, 13), [4, 18, 26, 27, 24, 16, 14, 15, 16, 11, 29, 14])],
       "win_med": 15, "win_q1": 14, "win_q3": 15, "win_le7": 4, "win_n": 214, "regions": [], "hires": [{"hire": "공공", "n": 214}],
       "open_list": [{"id": "304682", "title": "2026년도 직무중심 신입사원(5급, 6급) 채용 공고", "end": "2026-10-19", "region": None}],
       "recent": [{"id": "304682", "title": "2026년도 직무중심 신입사원(5급, 6급) 채용 공고", "reg": "2026-09-30", "end": "2026-10-19"}]}
p = b.write_org(ORG)
text = json.dumps(p, ensure_ascii=False)
ok(p["slug"] == "org-한국농어촌공사", p["slug"])
ok("214건" in p["title"], p["title"])
ok("**1건**" in text and "11월" in text, "접수 중·피크 달")
ok("49%" in text or "48%" in text or "47%" in text, "상위 세 달 비중이 적혔다: " + text[:300])
ok("[한국농어촌공사 채용 이력](/jobs/org/한국농어촌공사)" in text, "기관 이력 링크")
ok("None" not in text and "nan" not in text.lower(), "빈 값이 글에 섞이지 않았다")
ok(any(x["type"] == "bars" for x in p["body"]) and any(x["type"] == "table" for x in p["body"]), "막대·표")
ok("49% 늘" in text or "늘었습니다" in text, "2025년 증가 시사점: 57→85")

ROLE = {"pattern": "간호", "n3y": 574, "orgs_n": 161, "open_n": 3,
        "by_year": [{"y": 2024, "n": 177}, {"y": 2025, "n": 205}, {"y": 2026, "n": 158}],
        "by_month": [{"m": m, "n": n} for m, n in zip(range(1, 13), [43, 44, 62, 61, 40, 56, 42, 42, 53, 40, 46, 45])],
        "win_med": 11, "win_le7": 115, "win_n": 572,
        "orgs": [{"org": "대한적십자사", "n": 32, "open_n": 0}, {"org": "국민건강보험공단 본부 일산병원", "n": 22, "open_n": 0}, {"org": "경상북도 문경시", "n": 19, "open_n": 0}],
        "regions": [{"region": "부산광역시", "n": 103}, {"region": "서울특별시", "n": 62}],
        "hires": [{"hire": "지자체", "n": 339}, {"hire": "국가", "n": 137}],
        "open_list": [{"id": "304790", "title": "간호직 공무원 경력경쟁채용시험 공고", "org": "보건복지부 국립재활원", "end": "2026-10-13", "region": None}]}
p = b.write_role({"key": "nurse", "name": "간호사", "pattern": "간호"}, ROLE)
text = json.dumps(p, ensure_ascii=False)
ok(p["slug"] == "role-nurse" and "574건" in p["title"], p["title"])
ok("59%" in text, "지자체 비중 59%")
ok("여러 기관에서 조금씩" in text, "상위 세 기관 비중이 낮으면 그렇게 말한다")
ok("20%" in text and "일주일 안에" in text, "일주일 마감 비중")
ok("[대한적십자사](/jobs/org/대한적십자사)" in text, "기관 링크")

TOPIC = {"total": 78, "open_n": 78, "always_n": 75, "closing30": 0, "new30": 78,
         "by_sido": [{"sido": "경기도", "n": 22}, {"sido": "부산광역시", "n": 7}, {"sido": "전국", "n": 4}],
         "support": [{"k": "현금지급", "n": 70}, {"k": "지역화폐", "n": 3}],
         "household": [{"k": "저소득", "n": 5}], "youth_n": 66, "amount_med": None, "amount_n": 0,
         "closing_list": [{"id": "WLF00005418", "title": "청년ㆍ신혼 희망터치(Touch) 보증금 이자지원", "sido": "경기도", "sigungu": "수원시", "end": "2026-12-31"}],
         "sample": [{"id": "WLF00006135", "title": "청년 월세 지원", "sido": "경기도", "sigungu": "수원시", "end": None, "always": False}]}
p = b.write_topic(b.TOPICS[0], TOPIC)
text = json.dumps(p, ensure_ascii=False)
ok(p["slug"] == "topic-wolse-youth" and "78건" in p["title"], p["title"])
ok("96%" in text and "상시 접수" in text, "상시 비중")
ok("30일 안에 마감되는 사업은 없습니다" in text, "마감 없음 문장")
ok("85%" in text, "청년 비중 66/78")
ok("[청년 월세 지원 찾기](/?q=청년 월세&via=story)" in text, "검색 링크")
ok("전국 단위(중앙부처) 사업은 4건" in text, "전국 건수")

REGION = {"sido": "경기도", "total": 572, "open_n": 571, "closing30": 0,
          "topics": [{"k": "서민금융", "n": 402}, {"k": "임신·출산", "n": 58}],
          "sigungu": [{"k": "성남시", "n": 32}, {"k": "안산시", "n": 26}], "household": [{"k": "장애인", "n": 126}],
          "closing_list": [], "jobs_open": 54, "jobs_3y": 6299,
          "jobs_orgs": [{"org": "경기도 의왕시", "n": 134}], "jobs_open_list": [{"id": "304652", "title": "기간제교사 채용 공고(통합사회) 3차", "org": "경기도교육청 대지고등학교", "end": "2026-10-02"}]}
p = b.write_region(REGION)
text = json.dumps(p, ensure_ascii=False)
ok(p["slug"] == "region-경기도" and "571건" in p["title"] and "54건" in p["title"], p["title"])
ok("[경기도 지원금 모아보기](/area/경기도)" in text, "지역 링크")
ok("성남시" in text and "6,299건" in text, "시군구·채용")

ok(b.josa("공단", "은는") == "공단은" and b.josa("공사", "이가") == "공사가", "조사")
ok(b.short_sido("전북특별자치도") == "전북" and b.short_sido("경기도") == "경기도", "시·도 짧게")
print("blog_daily: " + (f"{bad}개 틀림" if bad else "모두 통과"))
sys.exit(1 if bad else 0)
