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

# 공개 범위 정수
ok(t.VISIBILITY == {"private": 0, "protected": 15, "public": 20}, "visibility 값")

print("실패 %d" % bad if bad else "모두 통과")
sys.exit(1 if bad else 0)
