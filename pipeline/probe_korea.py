"""
korea.kr 채용정보 쪽의 실제 HTML 모양을 본다. 손으로만 돌린다(probe 워크플로).

나라일터 공고는 korea.kr(정책브리핑)에도 같은 제목으로 올라오고, 그쪽에는
첨부파일(공고문·이력서 양식) 내려받기 링크가 있다. 그 링크를 우리 공고 아래에
붙이려면 (1) 제목으로 korea.kr 쪽을 찾는 법, (2) 상세 쪽에서 첨부를 읽는 법을
알아야 한다. 짐작으로 파서를 쓰지 않고 먼저 본다.
"""
import re
import sys
import html as H
import urllib.parse as U
import requests

UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com)"
BASE = "https://www.korea.kr"
S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept": "text/html,*/*", "Accept-Language": "ko"})


def get(url, **kw):
    try:
        r = S.get(url, timeout=25, **kw)
        return r
    except Exception as e:
        print(f"  !! {url} → {e}")
        return None


def strip(h):
    return re.sub(r"\s+", " ", H.unescape(re.sub(r"<[^>]*>", " ", h))).strip()


def forms(h):
    out = []
    for m in re.finditer(r"<form[^>]*>([\s\S]*?)</form>", h, re.I):
        head = m.group(0)[:200]
        act = re.search(r'action="([^"]*)"', head)
        meth = re.search(r'method="([^"]*)"', head)
        names = re.findall(r'<(?:input|select|textarea)[^>]*name="([^"]+)"', m.group(1))
        out.append(f"form action={act.group(1) if act else '?'} method={meth.group(1) if meth else '?'} names={names[:20]}")
    return out


def links(h, pat):
    seen, out = set(), []
    for m in re.finditer(r'<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)</a>', h, re.I):
        href, txt = m.group(1), strip(m.group(2))
        if re.search(pat, href) and href not in seen:
            seen.add(href)
            out.append((href, txt[:80]))
    return out


def around(h, word, n=600, k=2):
    out = []
    for m in list(re.finditer(word, h))[:k]:
        out.append(h[max(0, m.start() - 150): m.start() + n].replace("\n", " "))
    return out


def main():
    data_id = sys.argv[1] if len(sys.argv) > 1 else "393231"

    r = get(f"{BASE}/robots.txt")
    print("== robots.txt", r.status_code if r else "-")
    if r is not None:
        print("\n".join("  " + l for l in r.text.splitlines()[:40]))

    r = get(f"{BASE}/archive/recruitInfoView.do?dataId={data_id}")
    print(f"\n== 상세 {data_id}:", r.status_code if r else "-", len(r.text) if r else 0, "자")
    if r is not None and r.ok:
        h = r.text
        t = re.search(r"<title>([\s\S]*?)</title>", h)
        print("  title:", strip(t.group(1)) if t else "-")
        for hd in re.findall(r"<h[1-4][^>]*>([\s\S]*?)</h[1-4]>", h)[:12]:
            print("  h:", strip(hd)[:120])
        print("  forms:", *forms(h), sep="\n    ")
        print("  download 링크:")
        for href, txt in links(h, r"download\.do|fileId=")[:20]:
            print("    ", href, "|", txt)
        print("  바깥 링크(go.kr 등):")
        for href, txt in links(h, r"go\.kr|gojobs|http")[:25]:
            print("    ", href[:120], "|", txt)
        print("  '첨부파일' 주변 원본:")
        for a in around(h, "첨부파일", 1800, 1):
            print("    ", a)
        print("  '등록일' 주변:")
        for a in around(h, "등록일", 300, 1):
            print("    ", strip(a))
        print("  '출처' 주변:")
        for a in around(h, "출처", 300, 1):
            print("    ", strip(a))
        # 본문 영역 단서
        for cls in re.findall(r'class="([^"]*(?:cont|view|article|body|detail)[^"]*)"', h)[:15]:
            print("  class:", cls)

    for path in ["/archive/recruitInfoList.do", "/archive/recruitInfoList.do?pageIndex=2"]:
        r = get(BASE + path)
        print(f"\n== 목록 {path}:", r.status_code if r else "-", len(r.text) if r else 0, "자")
        if r is None or not r.ok:
            continue
        h = r.text
        print("  forms:", *forms(h), sep="\n    ")
        rows = links(h, r"recruitInfoView|dataId=")
        print(f"  상세 링크 {len(rows)}개:")
        for href, txt in rows[:8]:
            print("    ", href, "|", txt)
        # onclick 으로 넘기는 경우
        oc = re.findall(r'onclick="([^"]*(?:dataId|fn_[A-Za-z]+\()[^"]*)"', h)[:6]
        print("  onclick:", oc)
        print("  '첨부파일' 주변(목록):")
        for a in around(h, "첨부", 200, 1):
            print("    ", strip(a))
        cnt = re.search(r"총[^<]{0,20}?([\d,]+)\s*건", strip(h))
        print("  건수:", cnt.group(0) if cnt else "-")
        for a in around(h, "pageIndex", 200, 2):
            print("  pageIndex 주변:", a[:220])

    # 제목 검색이 되는지. 이름 후보를 하나씩 넣어 본다.
    q = "시설관리원 채용시험 최종합격자"
    for name in ["srchWord", "searchWord", "srchKeyword", "keyword", "searchKeyword", "srchTxt"]:
        r = get(f"{BASE}/archive/recruitInfoList.do?{name}={U.quote(q)}")
        if r is None or not r.ok:
            print(f"\n== 검색 {name}: 실패")
            continue
        rows = links(r.text, r"recruitInfoView|dataId=")
        hit = [x for x in rows if "시설관리" in x[1]]
        print(f"\n== 검색 {name}: 링크 {len(rows)} · 제목 맞음 {len(hit)} · {hit[:2]}")


if __name__ == "__main__":
    main()
