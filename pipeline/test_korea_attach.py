"""korea_attach 의 파싱·맞추기. 탐침(2026-10)에서 본 실제 HTML 모양으로.
   python pipeline/test_korea_attach.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import korea_attach as k  # noqa: E402

bad = 0
def ok(c, m):
    global bad
    if not c:
        bad += 1; print("  ✗", m)

VIEW = """<html><head><title>[수원지방법원·수원가정법원 안산지원] 공무직 근로자(시설관리원) 채용시험 최종합격자 발표 및 제출서류 공고 - 채용정보 | 정책자료 | 대한민국 정책브리핑</title></head>
<body><div class="article_head"><h2>[수원지방법원·수원가정법원 안산지원] 공무직 근로자(시설관리원) 채용시험 최종합격자 발표 및 제출서류 공고</h2>
<h3>기관명 : 대법원 수원지방법원 안산지원</h3><span>등록일 : 2026.08.28</span> <span>마감일 : 2026.08.28</span></div>
<div class="file"><strong>첨부파일</strong><ul>
<li><a href="/common/download.do?fileId=145793846&amp;tblKey=GBD">1. 공무직 근로자(시설관리) 채용시험 최종합격자 발표 및 제출서류 안내 공고.pdf</a>
<a href="/common/docViewer.do?fileId=145793846&amp;tblKey=GBD">바로보기</a></li>
<li><a href="/common/download.do?fileId=145793847&amp;tblKey=GBD">2. 이력서(양식).hwp</a><a href="/common/docViewer.do?fileId=145793847&amp;tblKey=GBD">바로보기</a></li>
<li><a href="/common/download.do?fileId=145793847&amp;tblKey=GBD">2. 이력서(양식).hwp</a></li>
</ul></div></body></html>"""

v = k.parse_view(VIEW, "393231")
ok(v["title"].startswith("[수원지방법원·수원가정법원 안산지원] 공무직"), v["title"])
ok(v["org"] == "대법원 수원지방법원 안산지원", v["org"])
ok(v["reg"] == "2026-08-28" and v["end"] == "2026-08-28", (v["reg"], v["end"]))
ok(len(v["files"]) == 2, len(v["files"]))
ok(v["files"][0]["name"].startswith("공무직 근로자(시설관리) 채용시험"), v["files"][0]["name"])
ok(v["files"][0]["ext"] == "pdf" and v["files"][1]["ext"] == "hwp", [f["ext"] for f in v["files"]])
ok(v["files"][0]["dl"] == "https://www.korea.kr/common/download.do?fileId=145793846&tblKey=GBD", v["files"][0]["dl"])
ok(v["files"][0]["view"] == "https://www.korea.kr/common/docViewer.do?fileId=145793846&tblKey=GBD", v["files"][0]["view"])
ok(v["url"] == "https://www.korea.kr/archive/recruitInfoView.do?dataId=393231", v["url"])

LIST = """<ul><li><a href="/archive/recruitInfoView.do?dataId=395882" onclick="goDetailView('/archive/recruitInfoView.do?dataId=395882','395882'); return false;">과학기술정보통신부 전문임기제 면접전형 합격자 공고</a></li>
<li><a href="/archive/recruitInfoView.do?dataId=395880">[북한산도봉] 한시인력(환경관리, 5차) 직원 채용</a></li>
<li><a href="/archive/recruitInfoView.do?dataId=395880">[북한산도봉] 한시인력(환경관리, 5차) 직원 채용</a></li></ul>"""
items = k.parse_list(LIST)
ok(items == [("395882", "과학기술정보통신부 전문임기제 면접전형 합격자 공고"), ("395880", "[북한산도봉] 한시인력(환경관리, 5차) 직원 채용")], items)

# 제목 맞추기: 띄어쓰기 차이는 무시
ok(k.norm("공무직근로자(통계조사관 ) 채용") == k.norm("공무직근로자 (통계조사관) 채용"), "norm")

# 같은 제목이 둘이면 기관명으로
rows = [{"id": "gojobs:1", "title": "기간제근로자(통계조사관) 채용 공고", "org": "고용노동부 여수지청", "reg_date": "2026-09-30"},
        {"id": "gojobs:2", "title": "기간제근로자(통계조사관) 채용 공고", "org": "고용노동부 구미지청", "reg_date": "2026-09-29"}]
ok(k.pick_row(rows, {"org": "고용노동부 구미지청", "reg": "2026-09-29"})["id"] == "gojobs:2", "pick by org")
ok(k.pick_row(rows, {"org": "고용노동부", "reg": "2026-09-30"})["id"] == "gojobs:1", "pick by org+date")
ok(k.pick_row(rows, {"org": "국방부", "reg": None}) is None, "ambiguous → None")
ok(k.pick_row(rows[:1], {"org": None, "reg": None})["id"] == "gojobs:1", "single")

# 적을 내용: raw 는 덧붙이고 url 은 비어 있을 때만
p = k.build({"id": "gojobs:1", "url": None, "raw": {"sys": "020", "from": "site"}}, v, "2026-10-02T00:00:00+00:00")
ok(p["raw"]["sys"] == "020" and p["raw"]["korea"]["id"] == "393231", p["raw"])
ok(p["url"] == v["url"], p.get("url"))
p2 = k.build({"id": "gojobs:1", "url": "https://x", "raw": None}, v, "t")
ok("url" not in p2 and p2["raw"]["korea"]["files"][1]["name"] == "이력서(양식).hwp", p2)

print("korea_attach OK" if not bad else f"{bad}건 실패")
sys.exit(1 if bad else 0)
