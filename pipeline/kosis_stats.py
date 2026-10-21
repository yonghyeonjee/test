"""KOSIS(국가통계포털) 주민등록인구를 시·도·시·군·구별로 받아 region_stats 에 쓴다.

    python -u pipeline/kosis_stats.py          # DB 에 쓴다(KOSIS_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY)
    python -u pipeline/kosis_stats.py --dry    # 받은 것만 찍는다

표: 행정안전부 주민등록인구현황 "행정구역(시군구)별 성별 인구수"(orgId 101, tblId DT_1B040A3), 항목 T20 총인구수, 월 단위 최신 1건.
행정구역 코드 C1: 두 자리는 시·도("11" 서울), 다섯 자리는 시·군·구("11110" 종로구). 구가 있는 시(수원시)는 시 코드와 구 코드가 따로 온다.
KOSIS 이름을 이 사이트의 시·도 이름(강원특별자치도, 전남광주통합특별시 …)으로 옮겨 적는다.
"""
from __future__ import annotations

import argparse
import os
import sys

import requests

API = "https://kosis.kr/openapi/Param/statisticsParameterData.do"
SIDO = {
    "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시", "인천": "인천광역시", "대전": "대전광역시",
    "울산": "울산광역시", "세종": "세종특별자치시", "경기": "경기도", "강원": "강원특별자치도", "충청북": "충청북도",
    "충청남": "충청남도", "전북": "전북특별자치도", "전라북": "전북특별자치도", "경상북": "경상북도", "경상남": "경상남도",
    "제주": "제주특별자치도", "광주": "전남광주통합특별시", "전라남": "전남광주통합특별시", "전남": "전남광주통합특별시",
}


def sido_of(name: str) -> str | None:
    for k, v in SIDO.items():
        if name.startswith(k):
            return v
    return None


def fetch(key: str, tbl: str = "DT_1B040A3", itm: str = "T20", prd: str = "M") -> list[dict]:
    r = requests.get(API, params={
        "method": "getList", "apiKey": key, "itmId": itm + " ", "objL1": "ALL", "objL2": "", "objL3": "", "objL4": "",
        "objL5": "", "objL6": "", "objL7": "", "objL8": "", "format": "json", "jsonVD": "Y", "prdSe": prd,
        "newEstPrdCnt": "1", "orgId": "101", "tblId": tbl,
    }, timeout=60, headers={"User-Agent": "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com/about)"})
    r.raise_for_status()
    j = r.json()
    if isinstance(j, dict) and j.get("err"):
        raise SystemExit(f"KOSIS 오류 {j.get('err')}: {j.get('errMsg')}")
    return j


def to_rows(data: list[dict]) -> list[dict]:
    """시·도 줄에서 시·도 이름을 잡아 두고, 그 아래 시·군·구 줄에 붙인다(코드 앞 두 자리로 묶인다)."""
    sido_by_code: dict[str, str] = {}
    rows = []
    for d in data:
        code = str(d.get("C1", "")).strip()
        name = str(d.get("C1_NM", "")).strip()
        if len(code) == 2 and code != "00":
            sido_by_code[code] = sido_of(name) or name
    for d in data:
        code = str(d.get("C1", "")).strip()
        name = str(d.get("C1_NM", "")).strip()
        try:
            pop = int(str(d.get("DT", "")).replace(",", ""))
        except ValueError:
            continue
        if code == "00":
            level, sido, sgg = 0, None, None
        elif len(code) == 2:
            level, sido, sgg = 1, sido_by_code.get(code), None
        else:
            level, sido, sgg = 2, sido_by_code.get(code[:2]), name
        rows.append({"code": code, "name": name, "sido": sido, "sigungu": sgg, "level": level, "pop": pop, "prd": str(d.get("PRD_DE", ""))})
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args([x for x in sys.argv[1:] if x] or [])
    key = os.environ.get("KOSIS_KEY", "").strip()
    if not key:
        raise SystemExit("KOSIS_KEY 가 없다")
    data = fetch(key)
    rows = to_rows(data)
    print(f"받은 줄 {len(data)}, 시·도 {sum(1 for r in rows if r['level'] == 1)}, 시·군·구 {sum(1 for r in rows if r['level'] == 2)}, 기준 {rows[0]['prd'] if rows else '-'}")
    if a.dry:
        for r in rows[:8]:
            print("  ", r)
        return
    from supabase import create_client
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    for i in range(0, len(rows), 200):
        sb.table("region_stats").upsert([{**r, "updated_at": "now()"} for r in rows[i:i + 200]], on_conflict="code").execute()
    print("region_stats 에 썼다")


if __name__ == "__main__":
    main()
