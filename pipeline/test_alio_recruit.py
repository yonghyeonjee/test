"""alio_recruit.py 의 순수 함수 시험. 네트워크·DB 없이 돈다."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import alio_recruit as a  # noqa: E402

fails = 0


def ok(cond, name):
    global fails
    if not cond:
        fails += 1
        print("실패:", name)


ok(a.ymd("20261102") == "2026-11-02" and a.ymd("") is None and a.ymd("2026") is None, "날짜")
ok(a.region_of("부산") == "부산광역시", "시·도 하나")
ok(a.region_of("부산,경기") is None and a.region_of("해외") is None and a.region_of(None) is None, "여럿·해외는 비움")
ok(a.region_of("광주") == "전남광주통합특별시" and a.region_of("전남,광주") == "전남광주통합특별시", "전남광주 통합")
ok(a.lines("ㅇ 가\\r\\n  - 나\\r\\n\\r\\n----\\r\\n다") == ["ㅇ 가", "- 나", "다"], "줄 나눔")
row = {
    "recrutPblntSn": 306125, "recrutPbancTtl": "2026년도 제1차 직원 채용 공고", "instNm": "한국수산자원공단",
    "recrutSeNm": "신입+경력", "recrutNope": 79, "hireTypeNmLst": "정규직,무기계약직", "ncsCdNmLst": "사업관리,연구",
    "aplyQlfcCn": "ㅇ 5급\r\n - 필수자격 : 감정평가사", "prefCondCn": "취업지원대상자, 장애인 등",
    "scrnprcdrMthdExpln": "1. 서류전형\r\n2. 면접전형", "workRgnNmLst": "부산,경기",
    "pbancBgngYmd": "20261016", "pbancEndYmd": "20261102", "acbgCondNmLst": "학력무관",
    "disqlfcRsn": "1. 피성년후견인",
}
s = a.to_summary(row)
ok(s["one_line"] == "신입+경력 · 79명 · 정규직, 무기계약직", "한 줄")
ok(s["requirements"] == ["ㅇ 5급", "- 필수자격 : 감정평가사"] and s["process"] == ["1. 서류전형", "2. 면접전형"], "자격·전형")
ok(s["period"] == {"start": "2026-10-16", "end": "2026-11-02", "how": ""}, "기간")
ok(s["positions"][0]["headcount"] == "79명" and a.filled(s), "인원·내용 있음")
ok("피성년후견인" not in str(s), "결격 사유는 싣지 않는다")
ok(not a.filled(a.to_summary({})), "빈 줄은 요약 없음")
g = [{"title": "2026년도 제1차 직원 채용 공고(한국수산자원공단)", "reg_date": "2026-10-16", "end_date": "2026-11-02"}]
ok(a.twin_of(row, g), "나라일터 쌍둥이")
ok(not a.twin_of(row, [{"title": "다른 공고 이름입니다", "reg_date": "2026-10-16", "end_date": "2026-11-02"}]), "쌍둥이 아님")
ok(not a.twin_of(row, [{"title": row["recrutPbancTtl"], "reg_date": "2026-10-16", "end_date": "2026-11-03"}]), "마감일 다르면 아님")
print("alio_recruit: 모두 통과" if not fails else f"alio_recruit: {fails}건 실패")
raise SystemExit(1 if fails else 0)
