"""
probe_hf.py — 주택금융공사 누리집의 금리안내 쪽과 공공데이터포털 목록 쪽의 상태를 본다.

    python pipeline/probe_hf.py

  1) hf.go.kr robots.txt
  2) 보금자리론 금리안내 / 디딤돌 금리안내 쪽의 표를 글자로 찍는다
  3) data.go.kr 15082039 쪽이 살아 있는지(제목·상태 문구)
  4) HF Open API 안내 쪽 목록
인증키는 쓰지 않는다.
"""

import re
import sys

import requests

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 narajiwon-probe/1.0 (+https://jiwon.knowhow-it.com)"
S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9"})


def text(html: str) -> str:
    html = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?i)</(tr|p|div|li|h\d|table)>", "\n", html)
    html = re.sub(r"(?i)</t[dh]>", " | ", html)
    html = re.sub(r"<[^>]+>", " ", html)
    html = re.sub(r"&nbsp;", " ", html)
    html = re.sub(r"[ \t]+", " ", html)
    html = re.sub(r"\n\s*\n+", "\n", html)
    return html.strip()


def show(url, around=None, n=4000):
    try:
        r = S.get(url, timeout=30)
        print(f"\n--- {url}\n    {r.status_code} {r.headers.get('content-type')} {len(r.text)}자")
        t = text(r.text)
        if around:
            i = t.find(around)
            print("    " + (t[max(0, i - 300): i + n] if i >= 0 else t[:n]).replace("\n", "\n    "))
        else:
            print("    " + t[:n].replace("\n", "\n    "))
    except Exception as e:
        print(f"\n--- {url}\n    실패 {type(e).__name__}: {e}")


def rates(url):
    """금리표가 있는 자리만 찍는다. 본문은 나침 뒤라 '%' 가 처음 나오는 곳부터 본다."""
    r = S.get(url, timeout=30)
    html = r.text
    print(f"\n--- {url}\n    {r.status_code} {len(html)}자  '%' {html.count('%')}개")
    # 화면이 XHR 로 표를 채우는지: 스크립트 안의 주소
    urls = sorted(set(re.findall(r"""["']((?:/[A-Za-z0-9_./-]+)\.(?:do|json|jsp)(?:\?[^"']*)?)["']""", html)))
    print("    스크립트 주소:", [u for u in urls if re.search(r"rate|int|list|ajax|json|금리", u, re.I)][:30])
    t = text(html)
    # 본문 시작: 제목 다음의 '금리안내' 이후
    k = t.find("금리안내", t.find("금리안내") + 1)
    body = t[k:] if k > 0 else t
    i = body.find("%")
    print("    본문 '%' 위치:", i)
    print("    " + body[max(0, i - 1500): i + 6000].replace("\n", "\n    "))


def main():
    show("https://www.hf.go.kr/robots.txt", n=300)
    rates("https://www.hf.go.kr/ko/sub01/sub01_01_04.do")
    rates("https://www.hf.go.kr/ko/sub01/sub01_02_03.do")
    show("https://www.hf.go.kr/ko/sub02/sub02_01_08.do", around="금리", n=3000)


if __name__ == "__main__":
    main()
