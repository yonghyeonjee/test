"""top10 엔진·티스토리 작성기·차트 — 고정 자료로 DB 없이 돈다.
   python pipeline/test_top10.py"""
import datetime as dt
import json
import re
import os
import random
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import top10 as t  # noqa: E402
import tistory_top10 as tt  # noqa: E402
import tistory_publish as tp  # noqa: E402
from top10_notes import HARD, PSY  # noqa: E402

bad = 0
def ok(c, m):
    global bad
    if not c:
        bad += 1; print("  ✗", m)

TODAY = dt.date(2026, 10, 17)
random.seed(7)
ORGS = ["조달청", "국방부 국군조직 육군", "법무부 화성외국인보호소", "행정안전부", "국립공원공단", "충남대학교병원", "근로복지공단", "대한적십자사", "서울특별시", "경기도교육청 새솔학교"]
TITLES = ["공무직 채용", "임기제공무원 채용시험", "기간제교사 채용", "행정 사무원 채용", "강사 채용", "청년인턴 모집", "연구원 채용", "시설관리 채용", "집배원 채용",
          "경비원 채용", "간호사 채용", "경찰공무원 경력경쟁채용", "환경직 채용", "전산직 채용", "기계설비 채용", "방호직 채용", "약사 채용", "전기 기술직 채용",
          "의사 채용", "임상병리사 채용", "방사선사 채용", "물리치료사 채용", "영양사 채용", "간호조무사 채용", "조리원 채용", "환경미화원 채용", "운전원 채용", "사서 채용"]
HIRES = ["공공", "국가", "지자체", "교육"]
REGS = ["서울특별시", "경기도", "부산광역시", "인천광역시", "대구광역시", "경상남도", "충청남도", None, "전국"]
rows = []
for m in range(24):
    month = (TODAY.replace(day=1) - dt.timedelta(days=30 * m))
    for k in range(random.randint(80, 140)):
        d = month.replace(day=random.randint(1, 27))
        rows.append({"id": str(len(rows)), "title": random.choice(TITLES), "org": random.choice(ORGS), "region": random.choice(REGS),
                     "hire": random.choice(HIRES), "reg_date": d.isoformat(), "end_date": (d + dt.timedelta(days=random.randint(3, 15))).isoformat()})
programs = []
for i in range(400):
    programs.append({"id": str(i), "kind": random.choice(["welfare", "welfare", "business"]), "title": f"사업 {i}", "sido": random.choice(["서울특별시", "경기도", "경상남도", "부산광역시", "충청남도", "전라남도", "강원특별자치도", None]),
                     "sigungu": random.choice(["수원시", "창원시", "강남구", None]), "topics": random.sample(["서민금융", "주거", "일자리", "교육", "임신·출산"], 2),
                     "life_cycle": random.sample(["청년", "노년", "중장년", "아동"], 1), "support_type": random.choice(["현금지급", None, "대출"]),
                     "status": random.choice(["open", "closed"]), "is_always_on": random.random() < 0.3, "biz_field": random.choice([["경영"], ["기술"], None]), "org_name": "기관"})
exams = []
items = {}
for c in range(15):
    code = f"{1000+c}"
    items[code] = {"code": code, "name": f"종목{c}", "kind_name": "국가기술자격", "series": "기능사" if c % 2 else "기사", "field": "분야", "sub_field": ""}
    for y in (2024, 2025):
        exams.append({"code": code, "year": y, "stage": "필기", "applicants": 3000 + c * 500, "takers": 2500, "passers": 1000, "pass_rate": 40 + c})
        exams.append({"code": code, "year": y, "stage": "실기", "applicants": 2000, "takers": 1800, "passers": 900, "pass_rate": 30 + c * 2})


class FakeData:
    today = TODAY
    def jobs(self): return rows
    def programs(self): return programs
    def exams(self): return exams, items


d = FakeData()
posts = {}
for key in ("civil", "roles", "medical", "orgs", "orgs-national", "regions", "short-window", "welfare-sido", "welfare-topic", "license-applicants", "license-craft-easy"):
    ov, its = t.TOPICS[key]["run"](d)
    ok(len(its) >= (1 if key == "short-window" else 5), f"{key}: 항목 {len(its)}개")   # short-window 는 직무당 100건 이상만 세서 표본에선 적다
    if not its:
        continue
    p = t.write(key, ov, its, TODAY)
    posts[key] = p
    text = json.dumps(p, ensure_ascii=False)
    ok(p["slug"] == f"top10-{key}-2026-10" and p["stats"]["items"] and p["stats"]["entity"] == t.TOPICS[key]["entity"], f"{key}: slug/stats")
    ok("None" not in text and "nan" not in text.lower(), f"{key}: 빈 값 없음")
    h2 = [x["text"] for x in p["body"] if x["type"] == "h2"]
    ok(h2[0] == "현황은?" and h2[1].startswith("1위 ") and h2[-1] == "이렇게 보세요", f"{key}: 절 순서 {h2[:3]}…{h2[-1]}")

civil = posts["civil"]
ok(any(x["text"].startswith("**어려운 점.**") and "jeepedia.com" in x["text"] for x in civil["body"] if x["type"] == "p"), "직렬 글에 어려운 점 + jeepedia 링크")
ok("경찰" in [i["name"] for i in civil["stats"]["items"]], "직렬에 경찰이 있다")
ok(all(i["name"] not in ("임기제", "공무직") for i in civil["stats"]["items"]), "임기제·공무직은 직렬이 아니다")
sw = posts["short-window"]["stats"]["items"]
ok(all(sw[i]["win_med"] <= sw[i+1]["win_med"] for i in range(len(sw) - 1)), "접수 기간 짧은 순")

# 어려운 점 자료가 빠진 key 가 없다
import blog_daily as b
missing = [r["key"] for r in b.ROLES if r["key"] not in HARD["roles"]] + [c["key"] for c in t.CIVIL if c["key"] not in HARD["civil"]] \
    + [c["key"] for c in t.MEDICAL if c["key"] not in HARD["medical"]] + [c["key"] for c in t.EDUCATION if c["key"] not in HARD["education"]] + [c["key"] for c in t.TECH if c["key"] not in HARD["tech"]]
ok(not missing, f"어려운 점 없는 key: {missing}")
ok(all(k in PSY for g in HARD.values() for v in g.values() for k in v["psy"]), "심리 개념 키가 전부 PSY 에 있다")

# 티스토리 작성기: 다른 글, 출처, 참고 문헌, 어려운 점
for key in ("civil", "orgs", "welfare-sido", "license-applicants"):
    c = tt.compose(posts[key])
    text = json.dumps(c, ensure_ascii=False)
    ok(c["title"] != posts[key]["title"] and "순위 TOP10 |" in c["title"], f"{key}: 제목 다름 {c['title'][:40]}")
    h2 = [x["text"] for x in c["body"] if x["type"] == "h2"]
    ok(h2[0] == "현황은?" and h2[-1] == "참고 문헌" and h2[-2] == "함께 보면 좋은 사이트" and h2[-3] == "정리", f"{key}: 티스토리 절 {h2[:2]}…{h2[-3:]}")
    ok("jeepedia.com/psy-dict" in text and "jiwon.knowhow-it.com" in text and "knowhow-it.com/english" in text, f"{key}: 운영 사이트 소개")
    ok(("gojobs.go.kr" in text) if key in ("civil", "orgs") else ("bokjiro.go.kr" in text) if key == "welfare-sido" else ("q-net.or.kr" in text), f"{key}: 공식 사이트")
    ok(text.count("출처: [") >= len(posts[key]["stats"]["items"]) + 2, f"{key}: 출처 줄 {text.count('출처: [')}")
    _links = re.findall(r"\]\((/[^)]*|https?://[^)]+)\)", text) + [i["href"] for x in c["body"] if x["type"] == "links" for i in x["items"]]
    _mine = [h for h in _links if h.startswith("/") or "jiwon.knowhow-it.com" in h]
    ok(len(_mine) <= 2, f"{key}: 운영 사이트(jiwon) 링크는 2개 이하 — 지금 {len(_mine)}개 {_mine[:4]}")
    ok(not re.search(r"\]\(/jobs|\]\(/license|\]\(/story", text), f"{key}: 항목·표에 jiwon 링크 없음")
    ok("K나라지원 자료로 본" not in c["title"], f"{key}: 제목에 운영 사이트 이름 없음")
    orig = {x["text"] for x in posts[key]["body"] if x["type"] == "p"}
    ok(not (orig & {x["text"] for x in c["body"] if x["type"] == "p"}), f"{key}: 원문 문단 복사 없음")
    imgs = [(f"[IMG{i}]", None) for i in range(1, 14)]
    html = tp.render(c, "full", imgs)
    ok(all(f"[IMG{i}]" in html for i in range(1, 14)), f"{key}: 사진 13장 모두 들어감")
c = tt.compose(posts["civil"])
ok(sum(1 for x in c["body"] if x["type"] == "p" and x["text"].startswith("**이 일이 힘든 이유.**")) == len(c["stats"]["items"]), "직렬 티스토리 글: 항목마다 힘든 이유")
ok(any("Maslach" in i["label"] for x in c["body"] if x["type"] == "links" for i in x["items"]), "참고 문헌에 번아웃 척도")
ok(any("jeepedia.com/psy-term/burnout" in i["href"] for x in c["body"] if x["type"] == "links" for i in x["items"]), "참고 문헌에 용어 사전(소진)")
ok(any("용어 사전의 [" in x["text"] for x in c["body"] if x["type"] == "p"), "본문에 용어 사전 링크 줄")

# 차트: 세 갈래 모두 그려진다
import chart_top10 as ct
ct.setup_font()
for key in ("civil", "welfare-sido", "license-applicants"):
    with tempfile.TemporaryDirectory() as tmp:
        st = posts[key]["stats"]
        ct.draw_overview(st, os.path.join(tmp, "o.png")); ct.draw_item(1, st["items"][0], st, os.path.join(tmp, "i.png")); ct.draw_top10(st, os.path.join(tmp, "t.png"))
        ok(all(os.path.getsize(os.path.join(tmp, f)) > 10000 for f in ("o.png", "i.png", "t.png")), f"{key}: 차트 파일")

# 기획표: 35일(10-22~26 은 10-21 에 몰린 글을 하루 한 편씩 다시 공개), 날짜 연속, 주제가 전부 등록돼 있다
plan = json.loads(t.PLAN_FILE.read_text(encoding="utf-8"))
dates = [dt.date.fromisoformat(p["date"]) for p in plan]
ok(len(plan) == 35 and all((dates[i+1] - dates[i]).days == 1 for i in range(34)), "35일 연속")
ok([(p["date"], p["topic"], p.get("update")) for p in plan[4:9]] == [("2026-10-22", "roles", "163"), ("2026-10-23", "civil", "164"), ("2026-10-24", "medical", "165"), ("2026-10-25", "orgs-national", "166"), ("2026-10-26", "regions", "172")], "다시 공개할 5편: 날짜·주제·글 번호")
ok(all(p["topic"] in t.TOPICS or p["topic"] == "" for p in plan), f"미등록 주제: {[p['topic'] for p in plan if p['topic'] not in t.TOPICS]}")
ok(plan[0] == {"date": "2026-10-18", "topic": "civil"}, "첫날은 공무 직군")
ok(t.plan_for(dt.date(2026, 10, 21))["topic"] == "regions" and len({p["topic"] for p in plan}) == 30, "주제 30개, 10-21 은 regions")
ok(t.plan_for(dt.date(2026, 10, 27))["topic"] == "license-applicants" and not t.plan_for(dt.date(2026, 10, 27)).get("update"), "새 연재는 10-27 부터 다시")
# 기획표가 끝난 뒤: 순환. 기획표에 topic "" 인 날(연재 쉼)이 있어도 순환 순서에는 들어가지 않는다
_rot = [t.plan_for(dt.date(2026, 11, 22) + dt.timedelta(days=i)) for i in range(31)]
ok(all(r and r.get("rotation") and r["topic"] in t.TOPICS for r in _rot) and "orgs" in {r["topic"] for r in _rot}, "기획표가 끝나면 순환, 기획표에 없던 orgs 도 31일 안에 나온다")
ok(t.plan_for(dt.date(2027, 1, 1))["topic"] in t.TOPICS, "끝없이 돈다")
_orig = t.PLAN_FILE.read_text(encoding="utf-8")
try:
    _p = json.loads(_orig); _p.insert(3, {"date": "2026-10-21", "topic": ""}); t.PLAN_FILE.write_text(json.dumps(_p), encoding="utf-8")
    ok(t.plan_for(dt.date(2026, 10, 21))["topic"] == "" and "" not in [t.plan_for(dt.date(2026, 11, 18) + dt.timedelta(days=i))["topic"] for i in range(40)], "쉼 날은 빈 주제, 순환엔 안 들어간다")
finally:
    t.PLAN_FILE.write_text(_orig, encoding="utf-8")
ok(t.plan_for(dt.date(2026, 10, 1)) is None, "기획표 시작 전엔 없음")

print("실패 %d" % bad if bad else "모두 통과")
sys.exit(1 if bad else 0)
