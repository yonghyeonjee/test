"""
채용 공고 수집 — 나라일터(인사혁신처 PblJobService)와 월드잡플러스(worldjob30).

두 API 모두 오래된 것부터 준다. 그래서 마지막 쪽부터 거꾸로 읽어 최신 공고를
먼저 담고, 기준일(SINCE)보다 오래된 쪽이 나오면 멈춘다. 항목 이름을 모르는
서비스(나라일터)는 첫 건의 태그 이름을 로그에 남기고, 원문 전체를 raw 에 둔다.
매일 아침 GitHub Actions 가 돌린다.

    python pipeline/collect_jobs.py            # 둘 다
    python pipeline/collect_jobs.py gojobs     # 나라일터만
    SINCE=2026-08-01 MAX_PAGES=60
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

import requests
from supabase import create_client

KEY = os.environ["DATA_GO_KR_KEY"].strip()
SB = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
SINCE = os.environ.get("SINCE", "2026-08-01")
MAX_PAGES = int(os.environ.get("MAX_PAGES", "60"))
ROWS = 100
TIMEOUT = 20

SOURCES = {
    "gojobs": {
        "url": "https://apis.data.go.kr/1760000/PblJobService/getList",
        "item": "item",
        "alias": {
            "source_id": ["idx", "pbancNo", "id", "seq"],
            "title": ["title", "pbancNm", "subject", "recrutPbancTtl"],
            "org": ["orgName", "instNm", "ognNm", "orgNm", "instName"],
            "region": ["workRegion", "workRegionNm", "region", "workRgnNm"],
            "hire": ["hireType", "hireTypeNm", "emplymType", "hireTypeLst"],
            "recruit": ["recruitType", "recruitTypeNm", "careerType", "recrutSe"],
            "sectors": ["sectors", "ncsCdNmLst", "field", "sector"],
            "headcount": ["recruitNum", "rcritNmpr", "recrutNope"],
            "start_date": ["startDate", "pbancBgngDt", "receiptStart", "pbancBgngYmd"],
            "end_date": ["endDate", "pbancEndDt", "receiptEnd", "pbancEndYmd"],
            "reg_date": ["regDate", "regDt", "registDt", "regDttm"],
            "url": ["srcUrl", "url", "detailUrl", "link", "homepage"],
        },
        "order_key": "reg_date",
    },
    "worldjob": {
        "url": "http://apis.data.go.kr/B490007/worldjob30/openApi30",
        "item": "ITEM",
        "alias": {
            "source_id": ["rctntcSj"],
            "title": ["rctntcSj"],
            "org": ["entNm"],
            "nation": ["rctntcNationNm"],
            "sectors": ["rctntcKscoNm"],
            "industry": ["lplcKscoNm"],
            "career": ["careerStleNm"],
            "lang": ["rctntcLang"],
            "visa": ["rctntcVisaNm"],
            "headcount": ["rctntcNmprCo"],
            "start_date": ["rctntcBgnDe"],
            "end_date": ["rctntcEndDe"],
            "reg_date": ["rctntcBgnDe"],
        },
        "order_key": "start_date",
    },
}


def mask(t):
    return str(t).replace(KEY, "***")


def fetch(url, page):
    """serviceKey 는 이미 인코딩된 키일 수 있어 그대로 붙인다."""
    key = KEY if re.search(r"%[0-9A-Fa-f]{2}", KEY) else requests.utils.quote(KEY, safe="")
    full = f"{url}?serviceKey={key}&numOfRows={ROWS}&pageNo={page}"
    for attempt in range(3):
        try:
            r = requests.get(full, timeout=TIMEOUT)
            if r.status_code == 200 and r.text.strip():
                return r.text
            print(f"  응답 {r.status_code}, 재시도")
        except requests.RequestException as e:
            print("  실패:", mask(e))
        time.sleep(1.5 * (attempt + 1))
    return None


def parse(xml, item_tag):
    """<item> 하나를 평평한 dict 로. 결과 코드가 나쁘면 예외."""
    root = ET.fromstring(xml)
    code = root.findtext(".//resultCode") or root.findtext(".//ERR_CD")
    if code and code not in ("00", "0"):
        msg = root.findtext(".//resultMsg") or root.findtext(".//ERR_NM") or root.findtext(".//returnAuthMsg")
        raise RuntimeError(f"결과 코드 {code} {msg}")
    total = root.findtext(".//totalCount")
    items = []
    for el in root.iter(item_tag):
        d = {}
        for c in el:
            if c.tag and c.text is not None:
                d[c.tag] = c.text.strip()
        items.append(d)
    return int(total) if total and total.isdigit() else None, items


def iso(v):
    m = re.search(r"(\d{4})[.\-/]?(\d{2})[.\-/]?(\d{2})", v or "")
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def pick(d, keys):
    for k in keys:
        v = (d.get(k) or "").strip()
        if v:
            return v
    return None


def to_row(name, conf, d):
    a = conf["alias"]
    title = pick(d, a["title"])
    if not title:
        return None
    sid = pick(d, a["source_id"]) or title
    row = {"id": f"{name}:{sid}"[:500], "source": name, "source_id": sid[:400], "title": title[:500], "raw": d,
           "fetched_at": datetime.now(timezone.utc).isoformat()}
    for col in ("org", "region", "hire", "recruit", "sectors", "headcount", "url",
                "nation", "lang", "visa", "career", "industry"):
        if col in a:
            row[col] = pick(d, a[col])
    for col in ("start_date", "end_date", "reg_date"):
        if col in a:
            row[col] = iso(pick(d, a[col]))
    if name == "worldjob":
        # 같은 공고명이 여러 회사에서 나올 수 있어 회사와 시작일을 붙여 구별한다
        row["id"] = f"worldjob:{title}|{row.get('org') or ''}|{row.get('start_date') or ''}"[:500]
        row["source_id"] = row["id"][9:][:400]
    return row


def upsert(rows):
    for i in range(0, len(rows), 200):
        SB.table("job_posts").upsert(rows[i:i + 200], on_conflict="id").execute()


def run(name):
    conf = SOURCES[name]
    print(f"== {name}")
    first = fetch(conf["url"], 1)
    if not first:
        print("  첫 쪽을 못 받았다"); return 0
    total, items = parse(first, conf["item"])
    if items:
        print("  항목 이름:", sorted(items[0].keys()))
        print("  첫 건 예:", json.dumps(items[0], ensure_ascii=False)[:600])
    if not total:
        total = len(items)
    last = max(1, -(-total // ROWS))
    print(f"  전체 {total}건, {last}쪽. 마지막 쪽부터 거꾸로 읽는다 (기준일 {SINCE})")

    saved, seen_old = 0, False
    page = last
    pages = 0
    while page >= 1 and pages < MAX_PAGES and not seen_old:
        xml = first if page == 1 else fetch(conf["url"], page)
        if not xml:
            page -= 1; pages += 1; continue
        _, items = parse(xml, conf["item"])
        rows = [r for r in (to_row(name, conf, d) for d in items) if r]
        if rows:
            upsert(rows); saved += len(rows)
        dates = [r.get(conf["order_key"]) for r in rows if r.get(conf["order_key"])]
        newest = max(dates) if dates else None
        oldest = min(dates) if dates else None
        print(f"  page {page}: {len(rows)}건 저장, {oldest}~{newest}", flush=True)
        # 날짜를 못 읽으면 멈출 기준이 없다 — 쪽수 상한까지만 읽는다
        if oldest and oldest < SINCE:
            seen_old = True
        page -= 1; pages += 1
        time.sleep(0.15)
    print(f"  합계 {saved}건")
    return saved


def main():
    names = [a for a in sys.argv[1:] if a in SOURCES] or list(SOURCES)
    for n in names:
        try:
            run(n)
        except Exception as e:  # 한 소스가 죽어도 다른 소스는 돈다
            print(f"  {n} 실패:", mask(e))


if __name__ == "__main__":
    main()
