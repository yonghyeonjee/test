"""배포 전 외부 자료의 생김새를 본다 — 글이 아니라 링크·폼·스크립트·표를 태그째로.
사용: python probe_links.py "주소|거름말|글자수,주소2|..."  (거름말: href 나 줄에 든 낱말. 비우면 전부)
주소 안의 {KOSIS_KEY} 같은 자리는 같은 이름의 환경변수로 바꾼다. 출력에는 키를 찍지 않는다.
2026-10-21 공공기관 정보(잡알리오 info02)·정부24 누리집 목록·KOSIS 를 붙이려고 만들었다.
"""
import html
import os
import re
import sys

import requests

UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com/about; probe)"


def fill(url: str) -> str:
    return re.sub(r"\{([A-Z_]+)\}", lambda m: os.environ.get(m.group(1), ""), url)


def mask(s: str) -> str:
    for k, v in os.environ.items():
        if k.endswith("_KEY") and v and len(v) >= 8:
            s = s.replace(v, "***")
    return s


for spec in [s.strip() for s in (sys.argv[1] if len(sys.argv) > 1 else "").split(",") if s.strip()]:
    url, _, rest = spec.partition("|")
    word, _, n = rest.partition("|")
    n = int(n or 6000)
    print(f"\n== {url}  거름말: {word!r}")
    try:
        r = requests.get(fill(url), timeout=60, headers={"User-Agent": UA, "Accept-Language": "ko-KR"})
    except Exception as e:  # noqa: BLE001
        print("   실패:", mask(str(e)))
        continue
    t = r.text
    print(f"   status {r.status_code}  len {len(t)}  type {r.headers.get('content-type','')}")
    if "json" in r.headers.get("content-type", "") or t.lstrip().startswith(("{", "[")):
        print("   " + mask(t[:n]))
        continue
    out = []
    for m in re.finditer(r"<(a|form|script|select|option|iframe|input)\b[^>]*>", t, flags=re.I):
        tag = m.group(0)
        if word and word not in tag:
            # a 태그는 글자(이름)에 거름말이 있어도 잡는다.
            end = t.find("</a>", m.end())
            text = re.sub(r"<[^>]+>", "", t[m.end():end])[:60] if m.group(1).lower() == "a" and 0 < end - m.end() < 400 else ""
            if word not in text:
                continue
        end = t.find("</" + m.group(1), m.end())
        text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t[m.end():end]))[:70].strip() if 0 < end - m.end() < 600 else ""
        out.append(html.unescape(re.sub(r"\s+", " ", tag))[:220] + ("  » " + html.unescape(text) if text else ""))
    body = "\n   ".join(out)
    print("   " + mask(body[:n]) + (f"\n   … (전체 {len(body)}자, 태그 {len(out)}개)" if len(body) > n else f"\n   (태그 {len(out)}개)"))
