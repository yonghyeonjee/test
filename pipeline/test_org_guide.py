"""org_guide 의 문장 만들기와 출처 거르기. DB·Gemini 없이 고정 값으로 돌린다.
   python pipeline/test_org_guide.py"""
import datetime
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import org_guide as g  # noqa: E402

bad = 0
def ok(c, m):
    global bad
    if not c:
        bad += 1; print("  ✗", m)

g.today = lambda: datetime.date(2026, 10, 10)

ROWS = [
    {"source_id": "304682", "title": "2026년도 직무중심 신입사원(5급, 6급) 채용 공고", "reg_date": "2026-09-30", "end_date": "2026-10-19",
     "raw": {"gojobs": {"files": [{"name": "2026년 신입사원 채용 공고문.pdf"}, {"name": "입사지원서(안).hwp"}, {"name": "5급 및 6급 직무기술서.zip"}]}}},
    {"source_id": "301000", "title": "2026년 제3회 임기제공무원(농지은행 전문위원) 채용 공고", "reg_date": "2026-06-01", "end_date": "2026-06-12",
     "raw": {"gojobs": {"files": [{"name": "공고문.hwp"}, {"name": "직무수행계획서 양식.hwp"}]}}},
    {"source_id": "299000", "title": "공무직(사무보조) 채용 공고", "reg_date": "2026-03-01", "end_date": "2026-03-10", "raw": {}},
]
posts = g.shape_posts(ROWS)
ok(posts["plan_n"] == 1 and posts["plan_recent"][0]["id"] == "301000", "임기제 자리 1건")
ok(posts["has_plan_file"] and posts["has_desc_file"] and not posts["has_essay_file"], "첨부 파일 종류")
ok([k["k"] for k in posts["kinds"]] == ["임기제·전문경력관", "공무직·무기계약", "정규직·신입"] or len(posts["kinds"]) == 3, posts["kinds"])
ok(posts["with_files"][0]["files"] == ["직무기술서", "입사지원서·응시원서", "공고문"], posts["with_files"][0]["files"])

SOURCES = [{"title": "ekr.or.kr", "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc", "domain": "ekr.or.kr"},
           {"title": "alio.go.kr", "uri": "https://vertexaisearch.cloud.google.com/grounding-api-redirect/def", "domain": "alio.go.kr"}]
RAW = {"official_site": "https://www.ekr.or.kr", "recruit_page": "", "mission": "농어촌 자원의 효율적 이용·관리", "vision": "",
       "values": [{"text": "신뢰", "source": "https://www.ekr.or.kr/intro"}, {"text": "복붙한 가치", "source": "https://blog.naver.com/x"}],
       "ideal": [{"text": "소통하는 전문가", "source": "https://www.ekr.or.kr/intro"}, {"text": "출처 없음", "source": ""}],
       "process": {"steps": ["서류", "필기(NCS)", "면접"], "blind": "yes", "source": "https://www.alio.go.kr/job/1"},
       "essay_questions": [{"text": "한국농어촌공사에 지원한 동기와 입사 후 이루고 싶은 목표를 기술하시오.", "limit": "700자", "year": "2026", "position": "5급", "source": "https://www.alio.go.kr/job/1"},
                           {"text": "너무 짧음", "limit": "", "year": "", "position": "", "source": "https://www.alio.go.kr/job/1"},
                           {"text": "잡코리아에서 본 문항입니다 어쩌구저쩌구", "limit": "", "year": "", "position": "", "source": "https://www.jobkorea.co.kr/x"}],
       "plan": {"required": "yes", "positions": ["임기제 전문위원"], "format": "A4 5쪽 이내", "source": "https://www.gojobs.go.kr/x"},
       "rules": [{"text": "출신 학교·가족 관계 기재 금지", "source": "https://www.alio.go.kr/job/1"}]}
facts = g.clean_facts(RAW, SOURCES)
ok(len(facts["values"]) == 1 and len(facts["ideal"]) == 1, "블로그 출처·출처 없는 항목은 버린다")
ok(len(facts["essay_questions"]) == 1 and facts["essay_questions"][0]["limit"] == "700자", "문항: 짧은 것·포털 출처 버림")
ok(facts["process"]["blind"] == "yes" and facts["plan"]["required"] == "yes", "전형·직무수행계획서")
ok(facts["official_site"] == "https://www.ekr.or.kr" and facts["recruit_page"] == "", "주소")

STATS = {"org": "한국농어촌공사", "n3y": 214, "open_n": 1, "win_med": 15, "win_n": 214, "win_le7": 4,
         "open_list": [{"id": "304682", "title": "2026년도 직무중심 신입사원(5급, 6급) 채용 공고", "end": "2026-10-19"}]}
post = g.compose("한국농어촌공사", STATS, posts, facts, SOURCES)
text = json.dumps(post, ensure_ascii=False)
ok(post["slug"] == "한국농어촌공사" and "작성법 — 인재상, 문항, 전형 절차, 유의사항 (2026년 채용 기준)" in post["title"], post["title"])
ok(post["summary"].startswith("한국농어촌공사가 ") and "문항 1개 포함)을 모으고" in post["summary"], post["summary"])
ok("**214건**" in text and "**15일**" in text, "공고 수·접수 기간")
ok("소통하는 전문가 (ekr.or.kr)" in text and "신뢰 (ekr.or.kr)" in text, "인재상·가치와 출처")
ok("서류 → 필기(NCS) → 면접" in text and "블라인드 채용으로 진행" in text, "전형 절차")
ok("700자" in text and "**지원 동기** 문항" in text, "문항 표와 유형별 틀")
ok("A4 5쪽 이내" in text and "자리는 1건" in text, "직무수행계획서 요건과 자리 수")
ok("[2026년도 직무중심 신입사원(5급, 6급) 채용 공고](/jobs/304682)" in text, "첨부 공고 링크")
ok(len(post["faq"]) == 4 and "문항 1개" in post["faq"][0]["a"], "FAQ")
ok("None" not in text and "nan" not in text.lower(), "빈 값 없음")
ok("alio.go.kr" not in text.replace("알리오", "") or "알리오" in text, "출처 이름")

# 아무것도 못 찾았을 때
empty = g.clean_facts({}, [])
post2 = g.compose("어느기관", {"n3y": 30, "open_n": 0, "win_med": None, "win_n": 0, "win_le7": 0, "open_list": []}, g.shape_posts([]), empty, [])
text2 = json.dumps(post2, ensure_ascii=False)
ok("확인하지 못해" in text2 and "확인하지 못했습니다" in text2, "못 찾았다고 적는다")
ok("공고문으로 확인하는 법과 작성 틀" in post2["title"], post2["title"])
ok("**지원 동기** —" in text2 and "임기제·전문경력관·개방형 자리가 보이지 않습니다" in text2, "일반 틀·자리 없음")
ok("None" not in text2, "빈 값 없음 2")

merged = g.merge_facts({"essay_questions": [{"text": "공고문 문항입니다 길게 적습니다", "limit": "500자", "year": "2026", "position": "6급", "source": "https://jiwon.knowhow-it.com/jobs/1"}],
                        "process": {"steps": ["서류", "면접"], "blind": "yes", "source": "https://jiwon.knowhow-it.com/jobs/1"}, "plan": None, "rules": [], "values": [], "ideal": []},
                       {"essay_questions": [{"text": "공고문 문항입니다 길게 적습니다", "limit": "", "year": "", "position": "", "source": "https://www.alio.go.kr/x"}],
                        "process": {"steps": ["서류", "필기", "면접"], "blind": "unknown", "source": "https://www.alio.go.kr/x"}, "ideal": [{"text": "소통", "source": "https://www.ekr.or.kr"}], "official_site": "https://www.ekr.or.kr"})
ok(len(merged["essay_questions"]) == 1 and merged["essay_questions"][0]["limit"] == "500자" and merged["process"]["steps"] == ["서류", "면접"], "공고문이 우선, 중복 문항 합침")
ok(merged["ideal"][0]["text"] == "소통" and merged["official_site"] == "https://www.ekr.or.kr", "웹 검색으로 채움")
cleaned = g.clean_facts(merged, [])
ok(len(cleaned["essay_questions"]) == 1 and cleaned["process"]["source"].startswith("https://jiwon"), "우리 공고 쪽 주소는 출처로 인정")
ok(g.source_label("https://jiwon.knowhow-it.com/jobs/1") == "공고문", "출처 이름: 공고문")
docs = g.pick_docs(ROWS)
ok(len(docs) == 2 and docs[0]["id"] == "304682" and docs[0]["files"][0]["name"].endswith("공고문.pdf") and docs[1]["files"][0]["name"] == "공고문.hwp", "문서 붙은 공고 고르기 " + str([d["id"] for d in docs]))
ok("[출처 주소] https://jiwon.knowhow-it.com/jobs/304682" in g.doc_prompt("한국농어촌공사", [{**docs[0], "text": "본문"}]), "문서 프롬프트에 출처 주소")

# HWP 문단 레코드: 머리(태그 67, 크기) + UTF-16LE 글 + 넓은 조절 문자(8글자) + 줄바꿈
def rec(tag, body):
    return (tag | (len(body) << 20)).to_bytes(4, "little") + body
para = "자기소개서 문항".encode("utf-16-le") + (11).to_bytes(2, "little") + b"\0" * 14 + "500자".encode("utf-16-le") + (13).to_bytes(2, "little")
sec = rec(0x10 + 50, b"\0" * 8) + rec(67, para) + rec(67, "둘째 문단".encode("utf-16-le"))
t = g.hwp_para_text(sec)
ok(t.replace("\n", "|") == "자기소개서 문항500자||둘째 문단", "HWP 문단 글자: " + repr(t))
import io, zipfile
buf = io.BytesIO()
with zipfile.ZipFile(buf, "w") as z:
    z.writestr("Contents/section0.xml", '<hs:sec><hp:p><hp:run><hp:t>전형 절차: 서류 &amp; 면접</hp:t></hp:run></hp:p><hp:p><hp:run><hp:t>자기소개서</hp:t><hp:tab/><hp:t>700자</hp:t></hp:run></hp:p></hs:sec>')
    z.writestr("Contents/header.xml", "<x/>")
hx = g.hwpx_text(buf.getvalue())
ok(hx == "전형 절차: 서류 & 면접\n자기소개서 700자", "HWPX 글자: " + repr(hx))
ok(g.doc_text("a.hwpx", buf.getvalue()) == hx and g.doc_text("a.zip", b"PK\x03\x04junk") == "" and g.doc_text("x.bin", b"abc") == "", "형식 가르기")
docs2 = g.pick_docs([{"source_id": "1", "title": "t", "reg_date": "2026-10-01", "raw": {"gojobs": {"files": [{"name": "공고.hwp", "ext": "hwp"}, {"name": "지원서.hwpx", "ext": "hwpx"}, {"name": "사진.jpg", "ext": "jpg"}]}}}])
ok(len(docs2) == 1 and [f["name"] for f in docs2[0]["files"]] == ["공고.hwp", "지원서.hwpx"], "hwp·hwpx 도 고른다")

ok(g.decode_org("/jobs/org/%ED%95%9C%EA%B5%AD%EB%86%8D%EC%96%B4%EC%B4%8C%EA%B3%B5%EC%82%AC") == "한국농어촌공사", "방문 주소 풀기")
ok(g.decode_org("/jobs/org/%EB%B2%95%EB%AC%B4%EB%B6%80/hire/%EA%B5%AD%EA%B0%80") == "법무부" and g.decode_org("/jobs/303583") is None, "방문 주소 풀기 2")
ranked = g.rank([{"org": "A", "n": 100, "open_n": 0}, {"org": "B", "n": 40, "open_n": 2}, {"org": "C", "n": 500, "open_n": 9}],
                {"A": 3}, {"C": "2026-09-01T00:00:00+00:00"}, datetime.date(2026, 10, 10))
ok([r["org"] for r in ranked] == ["A", "B"], "순위: 방문 우선, 최근 쓴 곳 제외 " + str([r["org"] for r in ranked]))
ok(not g.ok_source("https://blog.naver.com/a", {"blog.naver.com"}) and g.ok_source("https://www.ekr.or.kr/a", set()) and not g.ok_source("https://example.com/a", set()), "출처 판정")
ok(g.josa("한국농어촌공사", "은는") == "한국농어촌공사는" and g.josa("법무부", "은는") == "법무부는" and g.josa("강원대학교(춘천)", "은는") == "강원대학교(춘천)은", "조사")
print("org_guide: " + (f"{bad}개 틀림" if bad else "모두 통과"))
sys.exit(1 if bad else 0)
