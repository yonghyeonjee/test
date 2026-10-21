"""시·군·구청 청사 목록(data/sgg_offices.txt)에 좌표를 붙여 web/lib/govOfficeData.ts 를 만든다.

    python -u pipeline/geocode_offices.py            # 좌표 찾아 TS 파일을 쓴다
    python -u pipeline/geocode_offices.py --dry      # 몇 줄만 찍는다(좌표 찾기 없이)

좌표는 먼저 OpenStreetMap 에서 받아 둔 시청·구청 위치(web/lib/dongData.ts OFFICE)에서 이름으로 찾고,
없으면 Nominatim 에 도로명 주소로 묻는다(1초에 한 번, 이용 규칙). 이미 TS 파일에 있는 좌표는 다시 찾지 않는다.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "pipeline" / "data" / "sgg_offices.txt"
OUT = ROOT / "web" / "lib" / "govOfficeData.ts"
DONG = ROOT / "web" / "lib" / "dongData.ts"
UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com/about; office geocode)"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
SIDO = {
    "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시", "인천": "인천광역시", "광주": "전남광주통합특별시",
    "대전": "대전광역시", "울산": "울산광역시", "세종": "세종특별자치시", "경기": "경기도", "강원": "강원특별자치도",
    "충북": "충청북도", "충남": "충청남도", "전북": "전북특별자치도", "전남": "전남광주통합특별시", "경북": "경상북도",
    "경남": "경상남도", "제주": "제주특별자치도",
}


def read_src() -> list[dict]:
    rows = []
    for ln in SRC.read_text(encoding="utf-8").splitlines():
        if not ln.strip() or ln.startswith("#"):
            continue
        name, addr = ln.split("\t", 1)
        m = re.match(r"\((\d{5})\)\s*(.+)$", addr.strip())
        zipc, road = (m.group(1), m.group(2)) if m else ("", addr.strip())
        toks = road.split()
        sido = SIDO.get(toks[0].replace("시", "") if toks[0] == "세종시" else toks[0])
        rest = toks[1:]
        # "수원시 팔달구 효원로 241" → 시 수원시, 구 팔달구. "강화군 강화읍 …" → 군 강화군.
        sgg = rest[0] if rest else ""
        gu = rest[1] if len(rest) > 1 and re.fullmatch(r"[가-힣]{1,5}구", rest[1]) and sgg.endswith("시") else ""
        if sido and sido.endswith("특별자치시"):
            sgg, gu = "", ""
        kind = "도청" if name.endswith(("도청",)) else "시청" if "시청" in name else "구청" if "구청" in name else "군청" if "군청" in name else "청사"
        if re.search(r"(특별시|광역시|특별자치시)청", name):
            kind = "시·도청"
        rows.append({"name": name.strip(), "sido": sido, "sgg": sgg, "gu": gu, "zip": zipc, "address": road, "kind": kind})
    return rows


def osm_offices() -> dict[str, tuple[float, float]]:
    """dongData.ts 의 OFFICE 표: 이름 → 좌표."""
    s = DONG.read_text(encoding="utf-8")
    i = s.find("export const OFFICE")
    return {n: (float(a), float(b)) for n, a, b in re.findall(r'\["([^"]+)",\s*([\d.]+),\s*([\d.]+)\]', s[i:])}


def have_coords() -> dict[str, tuple[float, float]]:
    if not OUT.exists():
        return {}
    s = OUT.read_text(encoding="utf-8")
    out = {}
    for m in re.finditer(r'\["([^"]+)",\s*"[^"]*",\s*"[^"]*",\s*"[^"]*",\s*"[^"]*",\s*"[^"]*",\s*"[^"]*",\s*([\d.]+),\s*([\d.]+)\]', s):
        out[m.group(1)] = (float(m.group(2)), float(m.group(3)))
    return out


def geocode(s: requests.Session, q: str) -> tuple[float, float] | None:
    for query in (q, re.sub(r"\([^)]*\)", "", q).strip(), re.sub(r"\s+\d[\d-]*(\([^)]*\))?$", "", re.sub(r"\([^)]*\)", "", q)).strip()):
        r = s.get(NOMINATIM, params={"q": query, "format": "jsonv2", "countrycodes": "kr", "limit": 1}, headers={"User-Agent": UA}, timeout=30)
        time.sleep(1.1)
        if r.status_code == 200 and r.json():
            top = r.json()[0]
            return round(float(top["lat"]), 5), round(float(top["lon"]), 5)
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args([x for x in sys.argv[1:] if x] or [])
    rows = read_src()
    print(f"청사 {len(rows)}곳")
    if a.dry:
        for r in rows[:6]:
            print("  ", r)
        return
    osm = osm_offices()
    old = have_coords()
    s = requests.Session()
    found = {"osm": 0, "old": 0, "nominatim": 0, "none": 0}
    for r in rows:
        key = r["name"]
        # OSM 표의 이름은 "시흥시청"·"원미구청" 꼴. 우리 이름에서 시·도 접두("부산 중구청")를 떼고 견준다.
        short = re.sub(r"^(서울|부산|대구|인천|광주|대전|울산|경남|경북|전남|전북|충남|충북|강원|경기|제주|포항)\s+", "", key)
        if key in old:
            r["lat"], r["lng"] = old[key]; found["old"] += 1
        elif short in osm and short.endswith(("시청", "구청", "군청")) and " " not in short:
            r["lat"], r["lng"] = osm[short]; found["osm"] += 1
        else:
            g = geocode(s, r["address"]) or geocode(s, key)
            if g:
                r["lat"], r["lng"] = g; found["nominatim"] += 1
            else:
                r["lat"], r["lng"] = 0, 0; found["none"] += 1
                print("  ! 좌표 못 찾음:", key, r["address"], file=sys.stderr)
    print("좌표 출처:", found)
    lines = [
        "/**",
        " * 시·군·구청 청사(2026-10-21). pipeline/geocode_offices.py 가 pipeline/data/sgg_offices.txt 에서 만든다 — 손으로 고치지 말 것.",
        " * 한 줄: [이름, 시·도, 시·군·구, 구, 우편번호, 도로명 주소, 종류, 위도, 경도]. 좌표 0 은 못 찾은 것.",
        " * 좌표: OpenStreetMap 기여자(ODbL) 자료.",
        " */",
        "export type GovOfficeRow = [string, string, string, string, string, string, string, number, number];",
        "export const GOV_OFFICES: GovOfficeRow[] = [",
    ]
    for r in rows:
        lines.append("  " + json.dumps([r["name"], r["sido"] or "", r["sgg"], r["gu"], r["zip"], r["address"], r["kind"], r["lat"], r["lng"]], ensure_ascii=False) + ",")
    lines.append("];")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("썼다:", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
