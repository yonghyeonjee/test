"""정부24 "정부/지자체 누리집"(gov.kr/portal/orgSite?Mcode=11181)에서 기관 누리집 주소를 받아 gov_sites 에 쓴다.

    python -u pipeline/gov_sites.py          # DB 에 쓴다(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    python -u pipeline/gov_sites.py --dry    # 받은 것만 찍는다

쪽은 GET(pageIndex), 기관 구분은 srchFsOrgAstCd(01000000 중앙행정기관 …). 구분마다 끝 쪽까지 읽어 구분 이름(grp)을 남긴다.
항목: <a onclick="fncGoSite('주소', …)" title="기관명 누리집 새창열림">. 지자체는 이름에서 시·도와 시·군·구를 읽는다.
예의: 요청 사이 0.5초, 우리 이름을 밝힌다.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import os
import re
import sys
import time

import requests

URL = "https://www.gov.kr/portal/orgSite"
UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com/about; gov site index)"
ITEM = re.compile(r"fncGoSite\('([^']+)'[^>]*title=\"(.*?) 누리집 새창열림\"", re.S)
OPT = re.compile(r"<option value=\"(\d{8})\"\s*>(.*?)</option>")
PAGE = re.compile(r"pageIndex=(\d+)")
SIDO = {
    "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시", "인천": "인천광역시", "대전": "대전광역시",
    "울산": "울산광역시", "세종": "세종특별자치시", "경기": "경기도", "강원": "강원특별자치도", "충북": "충청북도",
    "충남": "충청남도", "전북": "전북특별자치도", "경북": "경상북도", "경남": "경상남도", "제주": "제주특별자치도",
    "광주": "전남광주통합특별시", "전남": "전남광주통합특별시", "전라남": "전남광주통합특별시", "전라북": "전북특별자치도",
    "충청북": "충청북도", "충청남": "충청남도", "경상북": "경상북도", "경상남": "경상남도",
}


def parse(page_html: str) -> list[tuple[str, str]]:
    seen: dict[tuple[str, str], None] = {}
    for url, name in ITEM.findall(page_html):
        seen[(html.unescape(name).strip(), html.unescape(url).strip())] = None
    return list(seen)


def groups(page_html: str) -> list[tuple[str, str]]:
    return [(c, html.unescape(n).strip()) for c, n in OPT.findall(page_html)]


def last_page(page_html: str) -> int:
    nums = [int(n) for n in PAGE.findall(page_html)]
    return max(nums) if nums else 1


def place_of(name: str, grp: str) -> tuple[str | None, str | None]:
    """지자체 누리집 이름("경기도 시흥시", "시흥시청", "서울특별시 강남구청")에서 시·도와 시·군·구."""
    if "지방" not in grp and "자치" not in grp:
        return None, None
    t = re.sub(r"(누리집|홈페이지)$", "", name.replace(" ", ""))
    t = re.sub(r"청$", "", t)
    sido = None
    for k, v in SIDO.items():
        if t.startswith(k):
            sido = v
            t = re.sub(r"^(특별자치도|특별자치시|특별시|광역시|도|시)?", "", t[len(k):]) if not t.startswith(v) else t[len(v):]
            break
    sgg = t if re.fullmatch(r"[가-힣]{1,6}(시|군|구)", t) else None
    if sido and sido.endswith("특별자치시"):
        sgg = None
    return sido, sgg


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args([x for x in sys.argv[1:] if x] or [])
    s = requests.Session()
    hdr = {"User-Agent": UA, "Accept-Language": "ko-KR"}
    first = s.get(URL, params={"Mcode": "11181"}, headers=hdr, timeout=40)
    first.raise_for_status()
    grps = groups(first.text) or [("ALL", "전체")]
    print("구분:", grps)
    rows: dict[tuple[str, str], dict] = {}
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    for code, label in grps:
        r = s.get(URL, params={"Mcode": "11181", "srchFsOrgAstCd": code, "pageIndex": "1"}, headers=hdr, timeout=40)
        if r.status_code != 200:
            print(f"  ! {label} 1쪽 {r.status_code}", file=sys.stderr)
            continue
        pages = last_page(r.text)
        items = parse(r.text)
        for p in range(2, pages + 1):
            time.sleep(0.5)
            rr = s.get(URL, params={"Mcode": "11181", "srchFsOrgAstCd": code, "pageIndex": str(p)}, headers=hdr, timeout=40)
            if rr.status_code != 200:
                continue
            got = parse(rr.text)
            if not got:
                break
            items += got
        n = 0
        for name, url in items:
            if (name, url) in rows:
                continue
            sido, sgg = place_of(name, label)
            rows[(name, url)] = {"name": name, "url": url, "grp": label, "sido": sido, "sigungu": sgg, "fetched_at": now}
            n += 1
        print(f"  {label}: {pages}쪽, {n}곳")
        time.sleep(0.5)
    out = list(rows.values())
    print(f"누리집 {len(out)}곳, 시·도 읽힘 {sum(1 for x in out if x['sido'])}곳, 시·군·구 읽힘 {sum(1 for x in out if x['sigungu'])}곳")
    if a.dry:
        for x in [x for x in out if x["sido"]][:12]:
            print("  ", x["grp"], x["name"], x["url"], x["sido"], x["sigungu"])
        return
    from supabase import create_client
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    for i in range(0, len(out), 200):
        sb.table("gov_sites").upsert(out[i:i + 200], on_conflict="name,url").execute()
    print("gov_sites 에 썼다")


if __name__ == "__main__":
    main()
