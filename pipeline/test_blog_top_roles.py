"""blog_top_roles 의 세기·문장 만들기. DB 없이 고정 행으로 돈다.
   python pipeline/test_blog_top_roles.py"""
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import blog_top_roles as t  # noqa: E402

bad = 0
def ok(c, m):
    global bad
    if not c:
        bad += 1; print("  ✗", m)

TODAY = dt.date(2026, 10, 17)
def row(i, title, org, region="서울특별시", hire="공공", reg="2026-09-01", end="2026-09-10"):
    return {"id": str(i), "title": title, "org": org, "region": region, "hire": hire, "reg_date": reg, "end_date": end}

rows = [row(i, "2026년 공무직 채용 공고", "조달청", reg="2026-08-01", end="2026-08-08") for i in range(6)]
rows += [row(10 + i, "임기제공무원 채용시험 공고", "국토교통부", hire="국가", reg="2026-10-10", end="2026-10-25") for i in range(4)]
rows += [row(20 + i, "간호사 채용", "대한적십자사", region=None, reg="2026-03-01", end="2026-03-15") for i in range(2)]
rows += [row(30, "환경미화 및 조리원 채용", "한국농어촌공사", reg="2026-10-01", end="2026-10-20")]   # 두 직무에 든다

ov = t.overview(rows, prev_count=10, today=TODAY)
ok(ov["n12"] == 13 and ov["open_now"] == 5, f"전체·접수 중: {ov['n12']} {ov['open_now']}")
ok(ov["open_by_hire"] == [{"hire": "국가", "n": 4}, {"hire": "공공", "n": 1}], ov["open_by_hire"])
ok(ov["by_month"][0]["m"] == "2026-03", ov["by_month"])

rr = t.role_rows(rows, TODAY)
names = [r["name"] for r in rr]
ok(names[:2] == ["공무직", "임기제공무원"], names)
pw = rr[0]
ok(pw["n12"] == 6 and pw["n_open"] == 0 and pw["orgs"] == 1 and pw["win_med"] == 7, json.dumps(pw, ensure_ascii=False))
ok(any(r["name"] == "환경미화" for r in rr) and any(r["name"] == "조리·급식" for r in rr), "한 공고가 두 직무에")
ok(next(r for r in rr if r["name"] == "임기제공무원")["n90"] == 4, "최근 석 달")
ok(pw["by_month"] == [{"m": "2026-08", "n": 6}], f"직무별 월별: {pw['by_month']}")

stats = {"overview": ov, "roles": rr}
p = t.write(stats)
text = json.dumps(p, ensure_ascii=False)
ok(p["slug"] == "jobs-top10-roles-2026-10" and p["kind"] == "role" and p["subject"] == "top10-2026-10", p["slug"])
ok("순위 TOP10 |" in p["title"] and "13건" in p["title"], p["title"])
h2 = [x["text"] for x in p["body"] if x["type"] == "h2"]
ok(h2[0] == "공공기관 채용 현황은?" and h2[1] == "1위 공무직" and h2[-1] == "직무를 고를 때 이렇게 보세요", h2)
ok(len([x for x in h2 if x[1:3] == "위 " or x[2:4] == "위 "]) == len(rr[:10]), f"순위 절 수: {h2}")
ok("30% 늘었" in text, "증가율 (13 vs 10)")
links = [i for x in p["body"] if x["type"] == "links" for i in x["items"]]
ok(any(i["href"] == "/jobs/q/공무직" and i["label"].startswith("공무직 접수 중인 공고") for i in links), "직무 검색 링크")
ok(any(i["href"] == "/jobs/q/임기제" for i in links), "임기제 검색 낱말은 terms[0]")
ok(any(i["href"].startswith("/jobs/org/") and i["label"].endswith("채용 이력") for i in links), "기관 링크")
ok("무기계약 직원" in text, "직무 설명 한 줄")
ok("None" not in text and "nan" not in text.lower(), "빈 값이 글에 섞이지 않았다")
ok(any(x["type"] == "table" and x["head"][0] == "순위" for x in p["body"]), "비교 표")
toc = p["body"][0]
ok(toc["type"] == "toc" and toc["items"][1]["label"] == "1위 공무직" and toc["items"][-1]["id"] == "howto", "목차")

print("실패 %d" % bad if bad else "모두 통과")
sys.exit(1 if bad else 0)
