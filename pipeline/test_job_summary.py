"""job_summary 의 파일 고르기·정리. DB·Gemini 없이."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import job_summary as j  # noqa: E402

bad = 0
def ok(c, m):
    global bad
    if not c:
        bad += 1; print("  ✗", m)

files = [{"name": "입사지원서.hwp", "ext": "hwp"}, {"name": "채용 공고문.pdf", "ext": "pdf"}, {"name": "직무기술서.zip", "ext": "zip"}, {"name": "안내.hwpx", "ext": "hwpx"}]
picked = j.pick_files(files)
ok([f["name"] for f in picked] == ["채용 공고문.pdf", "입사지원서.hwp"], "공고문 먼저, zip 제외: " + str([f["name"] for f in picked]))

raw = {"one_line": " 환경미화원 2명, 10월 20일 18:00까지 접수 ", "positions": [{"name": "환경미화", "headcount": "2명", "grade": "", "type": "공무직"}, {"name": "", "headcount": "1"}],
       "requirements": ["만 18세 이상", "만 18세 이상", "운전면허 1종 보통"], "preferred": [], "period": {"start": "2026.10.13", "end": "2026.10.20 18:00", "how": "방문·우편"},
       "documents": ["응시원서", "자기소개서"], "process": ["서류", "체력", "면접"], "work": {"place": "옥천군", "hours": "", "pay": "", "term": ""}, "contact": "총무과 043-000-0000", "notes": [""]}
s = j.clean(raw)
ok(s["one_line"] == "환경미화원 2명, 10월 20일 18:00까지 접수" and len(s["positions"]) == 1, "한 줄·빈 분야 제거")
ok(s["requirements"] == ["만 18세 이상", "운전면허 1종 보통"] and s["notes"] == [], "중복·빈 값 제거")
ok(s["period"]["end"] == "2026.10.20 18:00" and s["work"]["place"] == "옥천군", "접수·근무")
ok(j.clean({"one_line": "x"}) == {} and j.clean({}) == {}, "내용 없으면 빈 dict")
ok("공고문에서 뽑은 글" in j.prompt("t", "o", "본문") and j.prompt("t", None, "본문").endswith("본문"), "프롬프트")
print("job_summary: " + (f"{bad}개 틀림" if bad else "모두 통과"))
sys.exit(1 if bad else 0)
