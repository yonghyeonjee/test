"""gov_sites.py·kosis_stats.py·geocode_offices.py 의 순수 함수 시험. 네트워크·DB 없이 돈다."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import geocode_offices as g  # noqa: E402
import gov_sites as s  # noqa: E402
import kosis_stats as k  # noqa: E402

fails = 0


def ok(cond, name):
    global fails
    if not cond:
        fails += 1
        print("실패:", name)


PAGE = """
<select id="srchFsOrgAstCd"><option value="ALL">전체</option><option value="01000000" >중앙행정기관</option>
<option value="02000000" >지방자치단체</option></select>
<a href="#" onclick="fncGoSite('https://www.bai.go.kr', 'https://www.bai.go.kr', '_blank');return false;" target="_blank" title="감사원 누리집 새창열림">감사원</a>
<a href="#" onclick="fncGoSite('https://www.bai.go.kr', 'https://www.bai.go.kr', '_blank');return false;" target="_blank" title="감사원 누리집 새창열림">https://www.bai.go.kr</a>
<a href="/portal/orgSite?Mcode=11181&amp;pageIndex=5" title="5페이지">5</a><a href="/portal/orgSite?Mcode=11181&amp;pageIndex=92">끝</a>
"""
ok(s.parse(PAGE) == [("감사원", "https://www.bai.go.kr")], "누리집 항목(겹침 하나로)")
ok(s.groups(PAGE) == [("01000000", "중앙행정기관"), ("02000000", "지방자치단체")], "구분")
ok(s.last_page(PAGE) == 92, "끝 쪽")
ok(s.place_of("경기도 시흥시", "지방자치단체") == ("경기도", "시흥시"), "지자체 이름 → 시·도·시·군·구")
ok(s.place_of("시흥시청", "지방자치단체") == (None, "시흥시"), "시·도 없는 이름")
ok(s.place_of("서울특별시 강남구청", "지방자치단체") == ("서울특별시", "강남구"), "구청")
ok(s.place_of("세종특별자치시", "지방자치단체") == ("세종특별자치시", None), "세종")
ok(s.place_of("감사원", "중앙행정기관") == (None, None), "중앙은 비움")

DATA = [
    {"C1": "00", "C1_NM": "전국", "DT": "51082431", "PRD_DE": "202609"},
    {"C1": "11", "C1_NM": "서울특별시", "DT": "9279861", "PRD_DE": "202609"},
    {"C1": "11110", "C1_NM": "종로구", "DT": "135842", "PRD_DE": "202609"},
    {"C1": "42", "C1_NM": "강원특별자치도", "DT": "1500000", "PRD_DE": "202609"},
    {"C1": "42110", "C1_NM": "춘천시", "DT": "280000", "PRD_DE": "202609"},
]
rows = k.to_rows(DATA)
ok(rows[0]["level"] == 0 and rows[1] == {"code": "11", "name": "서울특별시", "sido": "서울특별시", "sigungu": None, "level": 1, "pop": 9279861, "prd": "202609"}, "시·도 줄")
ok(rows[2]["sido"] == "서울특별시" and rows[2]["sigungu"] == "종로구" and rows[2]["level"] == 2, "시·군·구 줄")
ok(rows[4]["sido"] == "강원특별자치도", "강원 이름 옮김")

offices = g.read_src()
ok(len(offices) >= 270, "청사 줄 수")
by = {o["name"]: o for o in offices}
ok(by["시흥시청"]["sido"] == "경기도" and by["시흥시청"]["sgg"] == "시흥시" and by["시흥시청"]["zip"] == "14998", "시흥시청")
ok(by["팔달구청"]["sgg"] == "수원시" and by["팔달구청"]["gu"] == "팔달구", "구가 있는 시")
ok(by["부산 중구청"]["sido"] == "부산광역시" and by["부산 중구청"]["sgg"] == "중구" and by["부산 중구청"]["kind"] == "구청", "광역시 구청")
ok(by["세종특별자치시청"]["sido"] == "세종특별자치시" and by["세종특별자치시청"]["kind"] == "시·도청", "세종")
ok(by["인천 강화군청"]["sgg"] == "강화군" and by["인천 강화군청"]["gu"] == "", "군청")
print("gov_data: 모두 통과" if not fails else f"gov_data: {fails}건 실패")
raise SystemExit(1 if fails else 0)
