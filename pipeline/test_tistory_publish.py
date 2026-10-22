"""tistory_publish 의 HTML 변환과 세션 만료 판정. 네트워크·DB 없이 돈다.
   python pipeline/test_tistory_publish.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import tistory_publish as t  # noqa: E402

bad = 0
def ok(c, m):
    global bad
    if not c:
        bad += 1; print("  ✗", m)

# 인라인: 굵게·링크·HTML 이스케이프. 상대 주소는 사이트 절대 주소로.
h = t.inline_html("**10월 16일** 기준 [채용 공고](/jobs)와 <b>는 글자</b> & 그대로")
ok("<b>10월 16일</b>" in h, h)
ok('<a href="https://jiwon.knowhow-it.com/jobs">채용 공고</a>' in h, h)
ok("&lt;b&gt;는 글자&lt;/b&gt;" in h and "&amp;" in h, "HTML 이 글자로만 남는다: " + h)
ok("https://q-net.or.kr" in t.inline_html("[큐넷](https://q-net.or.kr)"), "절대 주소는 그대로")

# 블록
ok(t.block_html({"type": "toc", "items": [{"id": "a", "label": "A"}]}) == "", "목차는 뺀다")
ok(t.block_html({"type": "h2", "text": "합격률", "id": "rate"}) == "<h2>합격률</h2>", "h2")
ok(t.block_html({"type": "list", "items": ["하나", "**둘**"]}) == "<ul><li>하나</li><li><b>둘</b></li></ul>", "list")
tb = t.block_html({"type": "table", "head": ["종목", "합격률"], "rows": [["**한식**", "39%"], ["[양식](/license/7911)", "39%"]]})
ok(tb.startswith("<table><thead><tr><th>종목</th><th>합격률</th></tr></thead>") and "<td><b>한식</b></td>" in tb
   and 'href="https://jiwon.knowhow-it.com/license/7911"' in tb, tb)
bars = t.block_html({"type": "bars", "unit": "건", "items": [{"label": "공공", "n": 1069}]})
ok("<td>공공</td><td>1,069건</td>" in bars, bars)
lk = t.block_html({"type": "links", "items": [{"href": "/jobs/1", "label": "A & B — 10월 20일 마감"}]})
ok('<li><a href="https://jiwon.knowhow-it.com/jobs/1">A &amp; B — 10월 20일 마감</a></li>' in lk, lk)
ok(t.block_html({"type": "note", "text": "기준"}) == "<blockquote>기준</blockquote>", "note")

# 요약판: 첫 절 앞 문단 하나, 절마다 첫 블록 하나, 링크는 5개까지, 각주(note)는 뺀다
BODY = [
    {"type": "toc", "items": []},
    {"type": "p", "text": "들머리 1"}, {"type": "p", "text": "들머리 2"},
    {"type": "h2", "text": "새 공고", "id": "fresh"},
    {"type": "p", "text": "전국 3건"},
    {"type": "links", "items": [{"href": f"/jobs/{i}", "label": str(i)} for i in range(12)]},
    {"type": "h2", "text": "마감", "id": "closing"},
    {"type": "links", "items": [{"href": f"/jobs/{i}", "label": str(i)} for i in range(12)]},
    {"type": "h2", "text": "빈 절", "id": "empty"},
    {"type": "note", "text": "기준"},
]
s = t.summary_blocks(BODY)
types = [b["type"] for b in s]
ok(types == ["p", "h2", "p", "h2", "links"], f"요약 블록 순서: {types}")
ok(s[0]["text"] == "들머리 1", "들머리는 첫 문단만")
ok(len(s[4]["items"]) == 5, "링크 5개까지")
ok(all(b.get("text") != "빈 절" for b in s), "본문 없는 절 제목은 뺀다")

POST = {"slug": "jobs-2026-10-16", "title": "브리핑 <1>", "summary": "요약문 & 설명", "keywords": ["a"], "body": BODY}
out = t.render(POST, "summary")
ok(out.startswith("<p>요약문 &amp; 설명</p>"), out[:80])
ok("이 글은 요약입니다" in out and 'href="https://jiwon.knowhow-it.com/story/jobs-2026-10-16"' in out, "원문 링크")
ok("원문: <a" in out and "브리핑 &lt;1&gt;" in out, "꼬리에 원문 제목(이스케이프)")
full = t.render(POST, "full")
ok("이 글은 요약입니다" not in full and full.count("<li>") == 24, "전문엔 요약 안내 없이 링크 전부")
ok("<blockquote>기준</blockquote>" in full and "<blockquote>" not in out, "note 는 전문에만")

# 쿠키 정리·만료 판정
ok(t.clean_cookie("Cookie: TSSESSION=abc;\n  _T_ANO=x") == "TSSESSION=abc; _T_ANO=x", "Cookie: 접두·줄바꿈 정리")

class R:
    def __init__(self, status, location="", text="", method="GET", url="u"):
        self.status_code, self.headers, self.text, self.ok = status, {"location": location}, text, 200 <= status < 300
        self.request, self.url = type("Q", (), {"method": method})(), url
def raises(fn, exc):
    try:
        fn()
    except exc:
        return True
    except Exception:  # noqa: BLE001
        return False
    return False
ok(raises(lambda: t.check_response(R(302, "https://www.tistory.com/auth/login?redirectUrl=x")), t.SessionExpired), "로그인으로 302 = 만료")
ok(raises(lambda: t.check_response(R(302, "https://accounts.kakao.com/login")), t.SessionExpired), "카카오로 302 = 만료")
ok(raises(lambda: t.check_response(R(401)), t.SessionExpired), "401 = 만료")
ok(raises(lambda: t.check_response(R(500, text="boom")), t.TistoryError), "500 = 오류")
ok(not raises(lambda: t.check_response(R(200)), Exception), "200 통과")

# entryUrl 해석
ok(t.parse_entry_url("abcfact.tistory.com", "https://abcfact.tistory.com/12") == ("12", "https://abcfact.tistory.com/12"), "절대 주소")
ok(t.parse_entry_url("abcfact.tistory.com", "/34") == ("34", "https://abcfact.tistory.com/34"), "상대 주소")
ok(raises(lambda: t.parse_entry_url("abcfact.tistory.com", "https://evil.example/1"), t.TistoryError), "다른 host 거부")
ok(raises(lambda: t.parse_entry_url("abcfact.tistory.com", "/auth/login"), t.SessionExpired), "로그인 주소 = 만료")
ok(raises(lambda: t.parse_entry_url("abcfact.tistory.com", ""), t.TistoryError), "빈 entryUrl")

# 문자 주소 블로그: /entry/<슬러그> 도 글이다 (2026-10-17 실측: abcfact 는 문자 주소)
pid, purl = t.parse_entry_url("abcfact.tistory.com", "https://abcfact.tistory.com/entry/2026%EB%85%84-%EB%B8%8C%EB%A6%AC%ED%95%91")
ok(pid == "2026년-브리핑" and purl == "https://abcfact.tistory.com/entry/2026%EB%85%84-%EB%B8%8C%EB%A6%AC%ED%95%91", f"{pid} {purl}")
ok(raises(lambda: t.parse_entry_url("abcfact.tistory.com", "/entry/"), t.TistoryError), "빈 entry 슬러그")

# 이미지: 첨부 ref·치환자·PNG 크기·끼워 넣기
up = {"url": "https://blog.kakaocdn.net/dna/abc/k1/img.png?credential=x&expires=1&signature=s", "key": "k1", "filename": "img.png"}
ref = t.attachment_ref(up)
ok(ref == "kage@k1/img.png?credential=x&amp;expires=1&amp;signature=s", ref)
rep = t.image_replacer(ref, 1280, 800)
ok(rep == '[##_Image|kage@k1/img.png?credential=x&amp;expires=1&amp;signature=s|CDM|1.3|{"originWidth":1280,"originHeight":800,"style":"alignCenter"}_##]', rep)
ok('"style":"widthOrigin"' in t.image_replacer(ref, 0, 0), "크기 모르면 widthOrigin")
png = b"\x89PNG\r\n\x1a\n" + (13).to_bytes(4, "big") + b"IHDR" + (640).to_bytes(4, "big") + (480).to_bytes(4, "big") + b"\x08\x06\x00\x00\x00"
ok(t.png_size(png) == (640, 480) and t.png_size(b"\xff\xd8jpeg") == (0, 0), "PNG IHDR")
ok(raises(lambda: t.attachment_ref({"url": "x"}), t.TistoryError), "응답에 key 없으면 오류")
imgs = [("[IMG1]", "첫 장"), ("[IMG2]", None), ("[IMG3]", "셋")]
woven = "\n".join(t.weave_images(BODY, imgs))
i1, i2, i3 = woven.index("[IMG1]"), woven.index("[IMG2]"), woven.index("[IMG3]")
ok(i1 < woven.index("<h2>새 공고</h2>") < i2 < woven.index("<h2>마감</h2>") < i3, "들머리 뒤 · 절마다 첫 블록 뒤")
ok("<p><em>첫 장</em></p>" in woven and woven.count("<em>") == 2, "캡션은 있을 때만")
four = t.weave_images(BODY, imgs + [("[IMG4]", None)])
ok("[IMG4]" in four[-1], "절보다 사진이 많으면 맨 뒤에")
out_img = t.render(POST, "full", imgs)
ok(out_img.index("[IMG1]") < out_img.index("<h2>새 공고</h2>"), "render 에도 끼워진다")

# 고쳐 쓸 때 기존 슬러그를 slogan 으로 — 기록된 주소에서 꺼낸다
class SB:
    def __init__(self, url): self._u = url
    def table(self, _): return self
    def select(self, _): return self
    def eq(self, *_): return self
    def execute(self):
        return type("R", (), {"data": [{"url": self._u}] if self._u else []})()
ok(t.recorded_slogan(SB("https://abcfact.tistory.com/entry/%EA%B3%B5%EA%B3%B5-TOP10-1"), "x") == "공공-TOP10-1", "entry 슬러그 디코딩")
ok(t.recorded_slogan(SB("https://abcfact.tistory.com/12"), "x") == "" and t.recorded_slogan(SB(""), "x") == "", "숫자 주소·기록 없음이면 빈 값")

# 카테고리: 자격증 → 일상TIP, 기업지원 → B2G, 나머지(채용·공무원·복지·브리핑) → policy
ok(t.category_for({"slug": "top10-license-hard-2026-11", "kind": "license"}) == t.CATEGORIES["일상TIP"], "자격증은 일상TIP")
ok(t.category_for({"slug": "top10-biz-field-2026-11", "kind": "topic"}) == t.CATEGORIES["B2G"], "기업지원은 B2G")
ok(t.category_for({"slug": "top10-civil-2026-10", "kind": "role"}) == t.CATEGORIES["policy"], "공무원은 policy")
ok(t.category_for({"slug": "top10-welfare-sido-2026-10", "kind": "topic"}) == t.CATEGORIES["policy"], "복지는 policy")
ok(t.category_for({"slug": "daily-2026-10-17", "kind": "daily"}) == t.CATEGORIES["policy"], "브리핑은 policy")
ok(all(isinstance(v, int) and v > 0 for v in t.CATEGORIES.values()), "카테고리 id 는 양의 정수")

# 쿠키 이름만 뽑는다(값은 안 나온다)
ok(t.cookie_names("_fwb=abc; TSSESSION=secret123; __T_=1") == ["_fwb", "TSSESSION", "__T_"], "쿠키 이름")
ok("secret123" not in " ".join(t.cookie_names("TSSESSION=secret123")), "값은 안 찍는다")
ok(t.cookie_names(t.clean_cookie("Cookie: a=1;\n b=2")) == ["a", "b"], "Cookie: 접두어·줄바꿈 정리 뒤에도 이름이 나온다")

# 하루 공개 한도: 그날(KST) PUBLIC 글만 센다
import datetime as _dt
_items = [{"visibility": "PUBLIC", "date": "2026-10-21 22:43"}, {"visibility": "PUBLIC", "date": "2026-10-21 09:00"},
          {"visibility": "PRIVATE", "date": "2026-10-21 10:00"}, {"visibility": "PUBLIC", "date": "2026-10-20 23:59"}]
ok(t.published_on(_items, _dt.date(2026, 10, 21)) == 2, "오늘 공개 글 수(비공개·어제 제외)")
ok(t.DAILY_MAX == 3, "하루 3편 한도")

# 모음 글: 여러 편을 하나로, 운영 사이트 링크는 하나만
_P = [{"slug": "daily-2026-10-21", "kind": "daily", "title": "2026년 10월 21일 공공기관 채용 브리핑", "summary": "새 공고 110건.",
       "keywords": ["채용"], "body": [{"type": "p", "text": "오늘 [공고](/jobs/1)"}, {"type": "h2", "text": "마감"},
       {"type": "links", "items": [{"label": "A", "href": "/jobs/a"}]}]},
      {"slug": "loan-1", "kind": "story", "title": "전세대출 1편", "summary": "전세가율.", "keywords": ["전세대출", "채용"],
       "body": [{"type": "h2", "text": "전세가율"}, {"type": "p", "text": "[잡알리오](https://job.alio.go.kr) 80%"}]}]
_d = t.digest(_P, _dt.date(2026, 10, 21))
_h = t.render(_d, "full")
ok(_d["title"].startswith("10월 21일") and _d["title"].count("10월 21일") == 1 and "외 1편" in _d["title"], "모음 글 제목")
ok(_h.count(t.SITE) == 1 and "job.alio.go.kr" in _h, "운영 사이트 링크 1개, 공식 링크는 남김")
ok("<h3>마감</h3>" in _h and _d["keywords"] == ["채용", "전세대출"] and [s["slug"] for s in _d["sources"]] == ["daily-2026-10-21", "loan-1"], "절은 h3, 태그 합침, 원 글 기록")

# 모음 글: 묶인 글마다 원 자료 화면 key 와 근거 링크, 분량 재기
ok([x["key"] for x in _d["shots"]] == ["d1_gojobs", "d1_alio", "d2_hf_jeonse", "d2_nhuf_youth"] and "근거 자료: <a href=\"https://www.gojobs.go.kr\">인사혁신처 나라일터</a>" in _h, "채용 브리핑 절: 나라일터·잡알리오 화면과 근거 링크")
_P2 = [{**_P[1], "slug": "jeonse-loan-1", "title": "전세대출 가능 매물 1편"}]
_d2 = t.digest(_P2, _dt.date(2026, 10, 22))
ok([x["key"] for x in _d2["shots"]] == ["d1_hf_jeonse", "d1_nhuf_youth"] and "nhuf.molit.go.kr" in t.render(_d2, "full"), "전세 글 절: 주택금융공사·주택도시기금 화면과 링크")
ok([m["key"] for m in t.take_shots(_d["shots"], dry=True)][:2] == ["d1_gojobs", "d1_alio"], "화면 찍기(dry)는 key 를 그대로")
ok(t.text_len("<p>가 나</p>[##_Image|kage@x|CDM|1.3|{}_##]<b>a&amp;b</b>") == 5 and t.MIN_CHARS == 1250, "본문 글자 수(태그·사진·공백 제외), 최소 1,250자")

# 모음 글 다듬기: 지난 마감 목록·길잡이 절·같은 절 반복은 빼고, 첫 문단은 문장 단위로, 제목은 따로 쓴 글을 앞세운다
_B = lambda d, n: {"slug": f"jobs-2026-10-{d}", "kind": "daily", "title": f"2026년 10월 {d}일 공공기관 채용 브리핑 — 새 공고 {n}건",
                   "summary": f"10월 {d}일 새 공고 {n}건을 모았습니다. 마감순으로 정리했습니다.", "keywords": [],
                   "body": [{"type": "p", "text": f"{n}건"}, {"type": "h2", "text": "새로 올라온 공고"},
                            {"type": "p", "text": "**서울** 27건 · [서울 채용 전체](/jobs/region/서울)"},
                            {"type": "list", "items": ["A — 기관 · 10월 29일 마감"]},
                            {"type": "h2", "text": "사흘 안에 마감"}, {"type": "p", "text": "오늘부터 모레까지"},
                            {"type": "links", "items": [{"label": f"B — 기관 · 10월 {d}일 마감", "href": "/jobs/b"}]}, {"type": "p", "text": "그 밖에 200건"},
                            {"type": "h2", "text": "놓치지 않으려면"}, {"type": "list", "items": ["저장 단추"]},
                            {"type": "h2", "text": "어떤 자리인가"}, {"type": "p", "text": "오늘 공고를 많이 낸 기관: 甲 3건"}]}
_S = {**_P[1], "slug": "jeonse-loan-listing-1", "title": "전세대출 가능 매물, 믿어도 될까 — 전세가율 80%와 90% (1편)",
      "summary": "은행 지점이 심사조차 받지 않았습니다. 과정을 따라갑니다.",
      "body": [{"type": "h2", "text": "기준"}, {"type": "p", "text": "90%"}, {"type": "h2", "text": "다음 편"}, {"type": "list", "items": ["2편: 금리"]}]}
_d3 = t.digest([_B(20, 113), _B(21, 110), _S], _dt.date(2026, 10, 22))
_h3 = t.render(_d3, "full")
ok(_d3["title"] == "10월 22일 공공 채용·생활 정보 모음 | 전세대출 가능 매물, 믿어도 될까 외 2편", "모음 제목은 따로 쓴 글 앞세우고 부제 뺌: " + _d3["title"])
ok("10월 20일 마감" not in _h3 and "10월 21일 마감" not in _h3 and "사흘 안에 마감" not in _h3 and "10월 29일 마감" in _h3, "지난 마감 목록 절은 빠지고 남은 마감은 둔다")
ok("놓치지 않으려면" not in _h3 and "다음 편" not in _h3 and "2편: 금리" not in _h3, "길잡이 절은 뺀다")
ok("서울 채용 전체" not in _h3 and "<b>서울</b> 27건" in _h3, "운영 사이트 길잡이 링크는 글자째 뺀다")
ok("오늘 공고를" not in _h3 and _h3.count("그날 공고를 많이 낸") == 1, "같은 절은 한 번만, '오늘'은 '그날'로")
ok(_d3["summary"] == "10월 20일 새 공고 113건을 모았습니다. 10월 21일 새 공고 110건을 모았습니다. 은행 지점이 심사조차 받지 않았습니다.", "첫 문단은 글마다 첫 문장: " + _d3["summary"])

# 공개 범위 정수
ok(t.VISIBILITY == {"private": 0, "protected": 15, "public": 20}, "visibility 값")

print("실패 %d" % bad if bad else "모두 통과")
sys.exit(1 if bad else 0)
