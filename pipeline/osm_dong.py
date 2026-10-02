"""OpenStreetMap 에서 읍·면·동과 행정복지센터(주민센터·읍면사무소) 위치를 받는다.

    python -u pipeline/osm_dong.py            # 전국, 표준출력에 한 줄씩(JSON)

정책지도의 세 번째 단계(읍·면·동)에 쓴다. 공고에는 주소가 없어 공고를 동에 꽂을 근거가
거의 없다. 대신 동마다 실제로 찾아가는 곳 — 행정복지센터 — 를 지도에 올리고, 동 이름이
분명히 들어간 공고만 그 동에 붙인다.

자료: © OpenStreetMap 기여자, ODbL 1.0. 여기서 만든 표(web/lib/dongData.ts)도 ODbL 이다.
Overpass API 이용 규칙을 지켜 시·도 하나씩 차례로, 사이에 쉬어 가며 묻는다.

출력(한 줄에 시·군·구 하나):
  {"sido": "경기도", "sgg": "시흥시", "lv": 6, "dong": [[이름, 위도, 경도, 수준], ...],
   "hall": [[이름, 위도, 경도], ...]}
시·군·구가 없는 시·도(세종)는 sgg 가 "" 다.
"""
import json
import sys
import time
import urllib.parse
import urllib.request

SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com)"

HALL = ("행정복지센터", "주민센터", "동사무소", "읍사무소", "면사무소", "주민자치센터")
OFFICE = ("시청", "구청", "군청")


def overpass(q: str) -> dict:
    body = urllib.parse.urlencode({"data": q}).encode()
    last = None
    for attempt in range(6):
        url = SERVERS[attempt % len(SERVERS)]
        try:
            req = urllib.request.Request(url, data=body, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=400) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001 — 서버가 바쁘면 다른 서버로, 쉬었다가
            last = e
            print(f"  ! {url} 실패({type(e).__name__}: {str(e)[:120]}), 쉬었다 다시", file=sys.stderr, flush=True)
            time.sleep(20 + attempt * 15)
    raise RuntimeError(f"Overpass 실패: {last}")


def center(el: dict):
    if "center" in el:
        return el["center"]["lat"], el["center"]["lon"]
    if "lat" in el:
        return el["lat"], el["lon"]
    return None


def name_of(tags: dict) -> str:
    return (tags.get("name:ko") or tags.get("name") or "").strip()


def main() -> None:
    # 인자: "all" 이면 전부. "only:부산,대구" 면 이름에 그 말이 든 시·도만. "light" 가 붙으면 동 경계(무거운
    # 관계 가운데 계산)는 빼고 관공서만 — OSM 동 경계는 빠진 곳이 많고 행정복지센터는 거의 다 있다.
    arg = sys.argv[1] if len(sys.argv) > 1 else "all"
    only = [x for x in arg.split(":", 1)[1].split(",") if x] if arg.startswith("only:") or ":" in arg else []
    light = "light" in arg
    sidos = overpass("""
[out:json][timeout:300];
area["ISO3166-1"="KR"][admin_level=2]->.kr;
rel(area.kr)["boundary"="administrative"]["admin_level"="4"];
out tags;
""")["elements"]
    print(f"# 시·도 {len(sidos)}곳: {', '.join(name_of(x['tags']) for x in sidos)}", file=sys.stderr, flush=True)
    total_d = total_h = 0
    for s in sidos:
        sname = name_of(s["tags"])
        if only and not any(o in sname for o in only):
            continue
        # 시·도 하나: 그 안의 시·군·구(6·7)마다 동(8)과 관공서를 묻는다. 세종처럼 시·군·구가 없는
        # 곳을 위해 시·도 바로 아래 동도 함께 받는다(겹치는 것은 아래에서 가장 깊은 쪽으로 정리).
        q = f"""
[out:json][timeout:900];
rel({s['id']});
map_to_area->.sa;
(
  rel(area.sa)["boundary"="administrative"]["admin_level"="6"];
  rel(area.sa)["boundary"="administrative"]["admin_level"="7"];
)->.sggs;
foreach.sggs->.g(
  .g out tags;
  .g map_to_area->.ga;
  {"" if light else 'rel(area.ga)["boundary"="administrative"]["admin_level"~"^(8|9)$"]; out center tags;'}
  nwr(area.ga)["amenity"="townhall"];
  out center tags;
);
"""
        els = overpass(q)["elements"]
        blocks = []
        cur = None
        for el in els:
            t = el.get("tags", {})
            lv = t.get("admin_level")
            if el["type"] == "relation" and t.get("boundary") == "administrative" and lv in ("6", "7") and "center" not in el:
                cur = {"sido": sname, "sgg": name_of(t), "lv": int(lv), "id": el["id"], "dong": [], "hall": []}
                blocks.append(cur)
                continue
            if cur is None:
                continue
            c = center(el)
            if not c:
                continue
            nm = name_of(t)
            if el["type"] == "relation" and t.get("boundary") == "administrative" and lv in ("8", "9"):
                cur["dong"].append([nm, round(c[0], 5), round(c[1], 5), int(lv)])
            elif t.get("amenity") == "townhall" and nm and (nm.endswith(HALL) or nm.endswith(OFFICE) or "행정복지센터" in nm):
                cur["hall"].append([nm, round(c[0], 5), round(c[1], 5)])
        # 시·군·구가 하나도 없으면(세종) 시·도 바로 아래 동을 따로 묻는다.
        if not blocks:
            els = overpass(f"""
[out:json][timeout:600];
rel({s['id']});
map_to_area->.sa;
rel(area.sa)["boundary"="administrative"]["admin_level"~"^(8|9)$"];
out center tags;
nwr(area.sa)["amenity"="townhall"];
out center tags;
""")["elements"]
            b = {"sido": sname, "sgg": "", "lv": 4, "id": s["id"], "dong": [], "hall": []}
            for el in els:
                t = el.get("tags", {})
                c = center(el)
                nm = name_of(t)
                if not c or not nm:
                    continue
                if el["type"] == "relation" and t.get("admin_level") in ("8", "9"):
                    b["dong"].append([nm, round(c[0], 5), round(c[1], 5), int(t["admin_level"])])
                elif t.get("amenity") == "townhall" and (nm.endswith(HALL) or nm.endswith(OFFICE) or "행정복지센터" in nm):
                    b["hall"].append([nm, round(c[0], 5), round(c[1], 5)])
            blocks.append(b)
        for b in blocks:
            total_d += len(b["dong"])
            total_h += len(b["hall"])
            print(json.dumps(b, ensure_ascii=False, separators=(",", ":")), flush=True)
        print(f"# {sname}: 시·군·구 {len(blocks)}, 동 {sum(len(b['dong']) for b in blocks)}, 관공서 {sum(len(b['hall']) for b in blocks)}",
              file=sys.stderr, flush=True)
        time.sleep(8)
    print(f"# 합계(겹침 포함): 동 {total_d}, 관공서 {total_h}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()
