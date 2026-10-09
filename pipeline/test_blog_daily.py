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

ROLE = {"terms": ["간호사"], "n3y": 574, "orgs_n": 161, "open_n": 3,
        "by_year": [{"y": 2024, "n": 177}, {"y": 2025, "n": 205}, {"y": 2026, "n": 158}],
        "by_month": [{"m": m, "n": n} for m, n in zip(range(1, 13), [43, 44, 62, 61, 40, 56, 42, 42, 53, 40, 46, 45])],
        "win_med": 11, "win_le7": 115, "win_n": 572,
        "orgs": [{"org": "대한적십자사", "n": 32, "open_n": 0}, {"org": "국민건강보험공단 본부 일산병원", "n": 22, "open_n": 0}, {"org": "경상북도 문경시", "n": 19, "open_n": 0}],
        "regions": [{"region": "부산광역시", "n": 103}, {"region": "서울특별시", "n": 62}],
        "hires": [{"hire": "지자체", "n": 339}, {"hire": "국가", "n": 137}],
        "open_list": [{"id": "304790", "title": "간호직 공무원 경력경쟁채용시험 공고", "org": "보건복지부 국립재활원", "end": "2026-10-13", "region": None}]}
p = b.write_role({"key": "nurse", "name": "간호사", "terms": ["간호사"]}, ROLE)
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

LICENSE = {"code": "1320", "kind": "T", "name": "정보처리기사", "all_n": 483, "field": "정보통신", "series": "기사", "kind_name": "국가기술자격", "sub_field": "정보기술",
           "peers": [{"code": "1320", "name": "정보처리기사", "takers": 384214, "passers": 164636}, {"code": "9545", "name": "멀티미디어콘텐츠제작전문가", "takers": 8825, "passers": 4627}],
           "peers_n": 2, "rank_peers": 1, "rank_all": 3, "takers_3y": 384214, "passers_3y": 164636, "jobs_3y": 0, "jobs_open_list": [],
           "rounds": [{"y": 2026, "label": "정기 기사 3회", "stage": None, "reg_start": "2026-07-20", "reg_end": "2026-07-23", "exam_start": "2026-08-07", "exam_end": "2026-09-01", "pass_date": "2026-09-09",
                       "prac_reg_start": "2026-09-21", "prac_reg_end": "2026-09-28", "prac_exam_start": "2026-10-24", "prac_exam_end": "2026-11-13", "final_pass": "2026-12-18"}],
           "by_year": [{"y": 2023, "rate": 20.9, "stage": "실기", "takers": 52071, "passers": 10871, "applicants": 68850}, {"y": 2023, "rate": 59, "stage": "필기", "takers": 59667, "passers": 35216, "applicants": 87858},
                       {"y": 2024, "rate": 28.6, "stage": "실기", "takers": 66305, "passers": 18980, "applicants": 88237}, {"y": 2024, "rate": 60.8, "stage": "필기", "takers": 65986, "passers": 40097, "applicants": 96021},
                       {"y": 2025, "rate": 22.1, "stage": "실기", "takers": 73858, "passers": 16326, "applicants": 102228}, {"y": 2025, "rate": 65.1, "stage": "필기", "takers": 66327, "passers": 43146, "applicants": 98329}]}
b.today = lambda: __import__("datetime").date(2026, 10, 9)
p = b.write_license(LICENSE)
text = json.dumps(p, ensure_ascii=False)
ok(p["slug"] == "license-정보처리기사" and p["subject"] == "1320", p["slug"])
ok("필기 62%" in p["title"] and "실기 24%" in p["title"], p["title"])
ok("384,214명" in text and "2023~2025년" in text, "3년 응시자·기간")
ok("필기 합격률 **62%** · 실기 합격률 **24%**" in text, "필기가 먼저")
ok("정기 기사 3회 실기" in text and "10월 24일~11월 13일" in text, "남은 시험: 3회 실기")
ok("접수 마감" in text, "실기 접수(9/21~28)는 지났다")
ok("고비는 **실기**" in text and "어려운 편" in text, "병목 단계")
ok("셋 중 둘이 떨어집니다" in text, "필기 62·실기 24 시사점")
ok("[멀티미디어콘텐츠제작전문가](/license/9545)" in text, "같은 분야 종목 링크")
ok("그대로 적힌 공고는 없습니다" in text, "공고 0건 문장")
ok("2년 동안 필기를 다시 보지 않습니다" in text, "기술자격 필기 면제 안내")
ok("None" not in text and "nan" not in text.lower(), "빈 값 없음")
ok("접수 기간은 회차마다 **4일**" in text, "짧은 접수 기간 안내")

SIGUNGU = {"sido": "충청북도", "sigungu": "옥천군", "total": 40, "open_n": 40, "always_n": 39, "closing30": 0, "new30": 0, "sido_open_n": 24,
           "topics": [{"k": "서민금융", "n": 26}, {"k": "신체건강", "n": 2}, {"k": "주거", "n": 1}],
           "household": [{"k": "보훈대상자", "n": 15}, {"k": "저소득", "n": 5}], "support": [{"k": "현금지급", "n": 23}, {"k": "현물지급", "n": 4}],
           "youth_n": 7, "senior_n": 11,
           "closing_list": [{"id": "WLF00004947", "end": "2032-12-31", "title": "청소년 꿈키움 바우처 지원"}],
           "sample": [{"id": "WLF00004004", "end": None, "title": "청년 월세 지원", "always": False}],
           "sido_sample": [{"id": "WLF00003010", "end": None, "title": "한부모가족 난방비 지원", "always": False}],
           "jobs_3y": 53, "jobs_open": 1, "jobs_orgs": [{"org": "충청북도 옥천군", "n": 50}, {"org": "충청북도 옥천군 의회사무과", "n": 3}],
           "jobs_open_list": [{"id": "304498", "end": "2026-10-16", "org": "충청북도 옥천군", "title": "2026년 제8회 옥천군 시간선택제임기제공무원 임용시험 계획 공고(비서)"}],
           "jobs_by_month": [{"m": m, "n": n} for m, n in zip(range(1, 13), [7, 6, 6, 5, 1, 2, 3, 5, 5, 2, 4, 7])]}
p = b.write_sigungu(SIGUNGU)
text = json.dumps(p, ensure_ascii=False)
ok(p["slug"] == "sigungu-충청북도-옥천군" and p["subject"] == "충청북도 옥천군", p["slug"])
ok("40건" in p["title"] and "채용 1건" in p["title"], p["title"])
ok("도 단위 사업 **24건**" in text, "도 단위 건수")
ok("65%" in text and "크게 쏠려" in text, "서민금융 26/40 쏠림")
ok("상시 접수" in text and "2032" not in text, "6년 뒤 마감은 상시로 본다")
ok("[충청북도 옥천군](/jobs/org/충청북도 옥천군) 50건" in text, "기관 링크")
ok("1월·12월·2월" in text or "12월·1월·2월" in text, "채용 몰리는 달")
ok("/?sido=충청북도&sigungu=옥천군&via=story" in text, "조건 검색 링크")
ok("None" not in text and "nan" not in text.lower(), "빈 값 없음")

ok(b.kinds_today(2, 0) == ["topic", "region"] and b.kinds_today(2, 1) == ["org", "license"] and b.kinds_today(2, 2) == ["role", "sigungu"], "두 갈래 짝")
ok(b.kinds_today(1, 4) == ["license"] and len(b.kinds_today(9, 0)) == 6, "갈래 수 한도")
ok(b.BRAND == "K나라지원", "이름")

ok(b.josa("공단", "은는") == "공단은" and b.josa("공사", "이가") == "공사가", "조사")
p = b.write_license({**LICENSE, "name": "지게차운전기능사", "code": "7875", "rounds": []})
text = json.dumps(p, ensure_ascii=False)
ok("고비는 실기" in p["title"] and "남은 시험" not in p["title"], "일정 없는 종목의 제목: " + p["title"])
ok("상시 시험" in text and "시험 일정은 어디서 보나" in text, "정기표에 없는 종목 안내")
ok(b.josa_k("미용사(일반)", "은는") == "미용사(일반)은" and b.josa_k("정보처리기사", "이가") == "정보처리기사가", "괄호 뒤 조사")
ok(b.short_sido("전북특별자치도") == "전북" and b.short_sido("경기도") == "경기도", "시·도 짧게")
print("blog_daily: " + (f"{bad}개 틀림" if bad else "모두 통과"))
sys.exit(1 if bad else 0)
