"""잡알리오 "공공기관 정보"(job.alio.go.kr/mobile2021/info/info02.do)에서 지정 공공기관 목록과 상세를 받아
public_orgs 에 쓴다. 소재지는 Nominatim(OpenStreetMap)으로 좌표를 붙인다 — 하루 한 번, 한 곳에 한 번.

    python -u pipeline/public_orgs.py            # 받아서 DB 에 쓴다(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    python -u pipeline/public_orgs.py --dry      # DB 없이 받은 것만 찍는다(probe.yml 에서 인자 "--dry")
    python -u pipeline/public_orgs.py --geocode-only   # 좌표 없는 곳만 좌표 붙이기

목록(한 쪽 10곳, 35쪽쯤)은 폼 POST(pageNo)로, 상세는 info02View.do 에 apba_id 를 POST 한다.
상세 표: 기관명·기관소개(홈페이지)·주무기관·설립근거·주요기능 및 역할·기관연혁·경영목표 및 전략·기관장·소재지.
소재지는 "중구 퇴계로 97, 601호" 처럼 시·도가 빠져 있어, 좌표를 찾은 뒤 그 주소에서 시·도·시·군·구를 읽는다.

예의: 요청 사이 0.4초, Nominatim 은 1초(이용 규칙). 우리 이름을 밝힌다(User-Agent).
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

BASE = "https://job.alio.go.kr/mobile2021/info"
UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com/about; public org index)"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
SIDO = {
    "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시", "인천": "인천광역시", "대전": "대전광역시",
    "울산": "울산광역시", "세종": "세종특별자치시", "경기": "경기도", "강원": "강원특별자치도", "충북": "충청북도",
    "충남": "충청남도", "전북": "전북특별자치도", "경북": "경상북도", "경남": "경상남도", "제주": "제주특별자치도",
    "광주": "전남광주통합특별시", "전남": "전남광주통합특별시", "전라남": "전남광주통합특별시",
    "전라북": "전북특별자치도", "충청북": "충청북도", "충청남": "충청남도", "경상북": "경상북도", "경상남": "경상남도",
}

ITEM = re.compile(
    r"fnDetail\('([A-Z]\d+)'\);\">\s*<div class=\"tit\">(.*?)</div>\s*<p>(.*?)</p>(?:\s*<div class=\"site\"[^>]*>(.*?)</div>)?",
    re.S,
)
ROW = re.compile(r"<th scope=\"row\">(.*?)</th>\s*<td>(.*?)</td>", re.S)


def clean(s: str | None) -> str:
    """태그를 걷고 줄을 정리한다. <br> 은 줄 나눔으로."""
    t = re.sub(r"<br\s*/?>", "\n", s or "", flags=re.I)
    t = re.sub(r"</p>\s*<p>", "\n", t, flags=re.I)
    t = html.unescape(re.sub(r"<[^>]+>", "", t))
    return "\n".join(ln.strip() for ln in t.replace("\r", "").split("\n") if ln.strip())


def parse_list(page_html: str) -> list[dict]:
    out = []
    for oid, name, sub, site in ITEM.findall(page_html):
        sub_t = clean(sub)
        parts = [p.strip() for p in re.split(r"\s*\|\s*", sub_t) if p.strip()]
        out.append({
            "id": oid, "name": clean(name), "ministry": parts[0] if parts else None,
            "kind": parts[1] if len(parts) > 1 else None, "homepage": (clean(site) or None),
        })
    return out


def last_page(page_html: str) -> int:
    nums = [int(n) for n in re.findall(r"goPage\((\d+)\)", page_html)]
    return max(nums) if nums else 1


FIELD = {
    "기관명": "name", "기관소개": "intro", "주무기관": "ministry", "설립근거": "basis",
    "주요기능 및 역할": "roles", "기관연혁": "history", "경영목표 및 전략": "goals", "기관장": "head", "소재지": "address",
}


def parse_detail(page_html: str) -> dict:
    d: dict = {}
    for th, td in ROW.findall(page_html):
        key = FIELD.get(clean(th))
        if not key:
            continue
        val = clean(td)
        if key == "intro":
            m = re.search(r"href=\"([^\"]+)\"", td)
            if m:
                d["homepage_detail"] = html.unescape(m.group(1)).strip()
            val = re.sub(r"홈페이지연결\s*:\s*\S+", "", val).strip()
        d[key] = val or None
    return d


def addr_query(addr: str) -> str:
    """지오코더에 보낼 주소. 괄호·호수·층·건물 이름은 떼고 "구 길 번지"까지만. "대학로57" 은 "대학로 57" 로.
    "서구 둔산대로 117번길 95 제6층 …" → "서구 둔산대로 117번길 95"."""
    a = re.sub(r"\([^)]*\)", " ", addr)
    a = a.split(",")[0]
    a = re.sub(r"(로|길)(\d)", r"\1 \2", a)
    a = re.sub(r"\s+", " ", a).strip()
    m = re.match(r"^(.*?(?:[가-힣0-9]+(?:로|길)\s+)+\d+(?:-\d+)?)", a)
    if m:
        return m.group(1).strip()
    a = re.sub(r"\s*\d+(층|호)\b.*$", "", a)
    return a.strip()


def sido_of(text: str) -> str | None:
    for k, v in SIDO.items():
        if k in text:
            return v
    return None


def sgg_of(display: str, sido: str | None) -> str | None:
    """Nominatim 의 표시 이름("97, 퇴계로, 명동, 중구, 서울특별시, 04634, 대한민국")에서 시·군·구."""
    toks = [t.strip() for t in display.split(",")]
    sgg = None
    for t in toks:
        if re.fullmatch(r"[가-힣]{1,6}(시|군|구)", t) and t != sido:
            # 구가 있는 시(수원시 팔달구)는 시 이름을 쓴다 — 공고 자료가 그렇게 적는다. 광역시의 구는 구.
            if t.endswith("시") and sido and not sido.endswith(("특별시", "광역시")):
                return t
            sgg = sgg or t
    return sgg


def geocode(s: requests.Session, addr: str) -> dict | None:
    q = addr_query(addr)
    if not q:
        return None
    r = s.get(NOMINATIM, params={"q": q, "format": "jsonv2", "countrycodes": "kr", "limit": 1, "accept-language": "ko"},
              headers={"User-Agent": UA}, timeout=30)
    time.sleep(1.1)
    if r.status_code != 200:
        return None
    rows = r.json()
    if not rows:
        # 번지를 떼고 길 이름까지만 — OSM 에 번지가 없는 길이 많다.
        q2 = re.sub(r"\s+\d[\d-]*$", "", q)
        if q2 == q:
            return None
        r = s.get(NOMINATIM, params={"q": q2, "format": "jsonv2", "countrycodes": "kr", "limit": 1, "accept-language": "ko"},
                  headers={"User-Agent": UA}, timeout=30)
        time.sleep(1.1)
        rows = r.json() if r.status_code == 200 else []
        if not rows:
            return None
        rows[0]["_approx"] = True
    top = rows[0]
    disp = top.get("display_name", "")
    sido = sido_of(disp)
    return {"lat": round(float(top["lat"]), 5), "lng": round(float(top["lon"]), 5), "sido": sido,
            "sigungu": sgg_of(disp, sido), "geo_src": "osm-road" if top.get("_approx") else "osm", "display": disp}


def fetch_all(s: requests.Session, limit_pages: int | None = None) -> list[dict]:
    first = s.post(f"{BASE}/info02.do", data={"pageNo": "1"}, headers={"User-Agent": UA}, timeout=40)
    first.raise_for_status()
    pages = last_page(first.text)
    if limit_pages:
        pages = min(pages, limit_pages)
    items = parse_list(first.text)
    for p in range(2, pages + 1):
        time.sleep(0.4)
        r = s.post(f"{BASE}/info02.do", data={"pageNo": str(p)}, headers={"User-Agent": UA}, timeout=40)
        if r.status_code != 200:
            print(f"  ! 목록 {p}쪽 {r.status_code}", file=sys.stderr)
            continue
        items += parse_list(r.text)
    seen: dict[str, dict] = {}
    for it in items:
        seen.setdefault(it["id"], it)
    print(f"목록 {pages}쪽, 기관 {len(seen)}곳")
    return list(seen.values())


def fetch_detail(s: requests.Session, oid: str) -> dict:
    time.sleep(0.4)
    r = s.post(f"{BASE}/info02View.do", data={"apba_id": oid, "pageNo": "1"}, headers={"User-Agent": UA}, timeout=40)
    return parse_detail(r.text) if r.status_code == 200 else {}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--geocode-only", action="store_true")
    ap.add_argument("--pages", type=int, default=None, help="목록 몇 쪽까지만(시험)")
    ap.add_argument("--no-geocode", action="store_true")
    a = ap.parse_args([x for x in sys.argv[1:] if x] or [])

    sb = None
    if not a.dry:
        from supabase import create_client
        sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    s = requests.Session()
    now = dt.datetime.now(dt.timezone.utc).isoformat()

    if not a.geocode_only:
        items = fetch_all(s, a.pages)
        rows = []
        for i, it in enumerate(items, 1):
            d = fetch_detail(s, it["id"])
            row = {**it, **{k: v for k, v in d.items() if k != "homepage_detail"}}
            row["homepage"] = row.get("homepage") or d.get("homepage_detail")
            row["fetched_at"] = now
            rows.append(row)
            if i % 25 == 0:
                print(f"  상세 {i}/{len(items)}")
        print(f"상세 {len(rows)}곳, 소재지 있음 {sum(1 for r in rows if r.get('address'))}곳")
        if a.dry:
            for r in rows[:5]:
                print("  ", {k: (v[:60] if isinstance(v, str) else v) for k, v in r.items()})
        else:
            # 좌표는 이미 있는 것을 지우지 않는다 — 주소가 바뀐 곳만 다시 찾는다.
            have = {x["id"]: x for x in (sb.table("public_orgs").select("id,address,lat").execute().data or [])}
            for r in rows:
                h = have.get(r["id"])
                if h and h.get("lat") is not None and h.get("address") == r.get("address"):
                    continue
                r["lat"] = None
                r["lng"] = None
            for i in range(0, len(rows), 100):
                sb.table("public_orgs").upsert(rows[i:i + 100], on_conflict="id").execute()
            print("public_orgs 에 썼다")

    if a.no_geocode:
        return
    if a.dry:
        return
    todo = [x for x in (sb.table("public_orgs").select("id,name,address").is_("lat", "null").execute().data or []) if x.get("address")]
    print(f"좌표 붙일 곳 {len(todo)}곳")
    ok = 0
    for x in todo:
        try:
            g = geocode(s, x["address"])
        except Exception as e:  # noqa: BLE001
            print(f"  ! {x['name']}: {type(e).__name__}", file=sys.stderr)
            continue
        if not g:
            continue
        ok += 1
        sb.table("public_orgs").update({"lat": g["lat"], "lng": g["lng"], "sido": g["sido"], "sigungu": g["sigungu"],
                                        "geo_src": g["geo_src"]}).eq("id", x["id"]).execute()
    print(f"좌표 붙임 {ok}/{len(todo)}")


if __name__ == "__main__":
    main()
