"""tistory_top_roles 의 글 만들기 — jiwon 글을 자료로 티스토리용 글이 따로 나오는지. DB 없이 돈다.
   python pipeline/test_tistory_top_roles.py"""
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import blog_top_roles as src  # noqa: E402
import tistory_top_roles as t  # noqa: E402
import tistory_publish as tp  # noqa: E402

bad = 0
def ok(c, m):
    global bad
    if not c:
        bad += 1; print("  ✗", m)

TODAY = dt.date(2026, 10, 17)
def row(i, title, org, region="서울특별시", hire="공공", reg="2026-09-01", end="2026-09-10"):
    return {"id": str(i), "title": title, "org": org, "region": region, "hire": hire, "reg_date": reg, "end_date": end}
rows = [row(i, "공무직 채용 공고", "조달청", reg="2026-08-01", end="2026-08-08") for i in range(6)]
rows += [row(10 + i, "임기제공무원 채용", "국토교통부", hire="국가", reg="2026-10-10", end="2026-10-25") for i in range(4)]
rows += [row(20 + i, "간호사 채용", "대한적십자사", reg="2026-03-01", end="2026-03-15") for i in range(2)]
origin = src.write({"overview": src.overview(rows, 10, TODAY), "roles": src.role_rows(rows, TODAY)})

p = t.compose(origin)
text = json.dumps(p, ensure_ascii=False)
ok(p["slug"] == origin["slug"], "slug 는 원문 그대로(기록용)")
ok(p["title"] != origin["title"] and "순위 TOP10 |" in p["title"], p["title"])
ok(p["summary"] != origin["summary"] and "K나라지원" in p["summary"], "요약문이 다르고 출처가 있다")
h2 = [x["text"] for x in p["body"] if x["type"] == "h2"]
ok(h2[0] == "공공기관 채용 현황은?" and h2[1].startswith("1위 공무직 — 최근 1년 공고 6건") and h2[-1] == "참고 문헌", h2)
ok(text.count("출처: [") >= 5, f"절마다 출처 줄: {text.count('출처: [')}")
ok("/story/jobs-top10-roles-2026-10" in text and "gojobs.go.kr" in text and "alio.go.kr" in text, "참고 문헌에 원문·원 자료")
ok("어떤 일인가요?" in text and "이렇게 준비하세요." in text and "요즘 흐름." in text, "항목마다 설명·흐름·준비")
ok("자격 요건: 시설·청소·조리·사무 보조처럼 하는 일은 공고마다 다르고" in text, "요건 줄은 NOTES 두 번째 문장")
# 원문 문장을 그대로 옮기지 않았다 — 원문 본문 문단이 티스토리 글에 없어야 한다
orig_ps = {x["text"] for x in origin["body"] if x["type"] == "p"}
new_ps = {x["text"] for x in p["body"] if x["type"] == "p"}
dup = orig_ps & new_ps
ok(not dup, f"원문 문단 복사: {list(dup)[:2]}")
# 사진 13장을 끼우면: 들머리 뒤 1 + 현황 1 + 순위 N + 비교 1 (정리·참고 문헌엔 안 들어간다)
imgs = [(f"[IMG{i}]", None) for i in range(1, 14)]
html = tp.render(p, "full", imgs)
n_roles = len([x for x in h2 if x[1:3] == "위 "])
used = sum(1 for i in range(1, 14) if f"[IMG{i}]" in html)
ok(used == 13, f"사진 13장 모두 들어갔다: {used}")
ok(html.index("[IMG1]") < html.index("<h2>공공기관 채용 현황은?</h2>") < html.index("[IMG2]"), "첫 장은 들머리 뒤")
ok("None" not in text and "nan" not in text.lower(), "빈 값 없음")

print("실패 %d" % bad if bad else "모두 통과")
sys.exit(1 if bad else 0)
