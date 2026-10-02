"""osm_dong.py 출력(JSON 줄)을 web/lib/dongData.ts 로 만든다.

    python pipeline/build_dong_data.py run1.jsonl run2.jsonl ... > web/lib/dongData.ts

규칙
- 시·도 이름은 사이트가 쓰는 이름으로(광주·전남 → 전남광주통합특별시, 강원도 → 강원특별자치도 …).
- 시·군·구는 수준 6(시·군·자치구). 수준 7(일반구: 수원시 장안구)은 구 이름으로만 남긴다 — 공고 자료가
  "수원시"로 적기 때문.
- 동 자리 = 행정복지센터(주민센터·읍면사무소). OSM 의 동 경계는 빠진 곳이 많아, 센터 이름에서 동 이름을
  읽는다("비인면 행정복지센터" → 비인면). 경계 가운데가 있으면 동 가운데로 쓰고, 없으면 센터 자리.
- 같은 동에 센터가 여럿(행정복지센터·주민센터·주민자치센터 등록이 겹침)이면 하나만: 행정복지센터 > 주민센터 >
  사무소 > 주민자치센터, 같은 급이면 먼저 나온 것.
- 시청·구청·군청은 OFFICE 로 따로(같은 이름은 하나만). 시·도청(서울특별시청 등)은 시·도 대표라 뺀다.
- 세종은 시·군·구가 없어 "세종시" 한 칸에 둔다(사이트의 SGG_POINT 이름).
- 제주는 OSM 에 제주시·서귀포시 경계가 없어 섬 하나로 온다. 서귀포시 읍·면·동 17곳(SEOGWIPO)으로 가른다.
- 센터 이름의 오타·줄임말은 FIX 로 바로잡는다("한립읍" → 한림읍, "남포" → 남포동). 동이 아닌 곳(남악복합 등)은 뺀다.
- 청사는 이름의 시·군·구로 보낸다: 옹진군청은 미추홀구 땅에 있지만 옹진군 칸. 이름의 시·군·구가 이제 없으면
  (2026년 7월 개편으로 없어진 인천 중구의 "중구청") 옛 이름이라 뺀다. 일반구 청사(성산구청)는 시 칸에 둔다.
- OSM 수준 8 경계에는 행정동 말고 법정동도 섞여 있다(부평구 "갈산동" — 행정동은 갈산1·2동, 중구 "관동1가").
  센터 없이 경계만 있는 이름은 같은 칸에 "이름+숫자" 행정동이 있거나 "○가"로 끝나면 법정동으로 보고 뺀다.

자료: © OpenStreetMap 기여자, ODbL 1.0.
"""
import json
import re
import sys
from collections import OrderedDict

SIDO = [
    (r"^서울", "서울특별시"), (r"^부산", "부산광역시"), (r"^대구", "대구광역시"), (r"^인천", "인천광역시"),
    (r"^광주|^전라남|^전남", "전남광주통합특별시"), (r"^대전", "대전광역시"), (r"^울산", "울산광역시"),
    (r"^세종", "세종특별자치시"), (r"^경기", "경기도"), (r"^강원", "강원특별자치도"), (r"^충청북|^충북", "충청북도"),
    (r"^충청남|^충남", "충청남도"), (r"^전라북|^전북", "전북특별자치도"), (r"^경상북|^경북", "경상북도"),
    (r"^경상남|^경남", "경상남도"), (r"^제주", "제주특별자치도"),
]
HALL_SUFFIX = [("행정복지센터", 0), ("주민센터", 1), ("동사무소", 2), ("읍사무소", 2), ("면사무소", 2), ("주민자치센터", 3)]
OFFICE_RE = re.compile(r"(시청|구청|군청)$")
# 서귀포시의 읍·면·동(3읍 2면 12동). 나머지 제주 땅은 제주시.
SEOGWIPO = {"대정읍", "남원읍", "성산읍", "안덕면", "표선면", "송산동", "정방동", "중앙동", "천지동", "효돈동",
            "영천동", "동홍동", "서홍동", "대륜동", "대천동", "중문동", "예래동"}
# 센터 이름에서 읽은 동 이름 바로잡기. None 이면 동이 아니라서 뺀다.
FIX = {
    "한립읍": "한림읍",      # 제주 한림읍사무소 오타
    "남포": "남포동",        # 부산 중구 "남포행정복지센터"
    "엄사": "엄사면",        # 계룡시 "엄사주민자치센터"
    "안면도": "안면읍",      # 태안군 "안면도 주민자치센터"
    "남악복합": None,        # 무안 삼향읍 안의 복합주민센터 — 동이 아니다
}
NUM_WORD = {"일": "1", "이": "2", "삼": "3", "사": "4", "오": "5"}
SIDO_OFFICE = re.compile(r"(특별시청|광역시청|특별자치시청|도청)$")


def norm_sido(name: str) -> str | None:
    for pat, out in SIDO:
        if re.search(pat, name):
            return out
    return None


def hall_dong(name: str) -> tuple[str, int] | None:
    """"비인면 행정복지센터" → ("비인면", 0). 동 이름을 못 읽으면 None."""
    t = re.sub(r"\s+", "", name)
    t = re.sub(r"임시청사$", "", t)  # "효덕동 행정복지센터 임시청사" — 지금 일하는 자리
    for suf, rank in HALL_SUFFIX:
        if t.endswith(suf):
            d = t[: -len(suf)]
            if suf in ("동사무소", "읍사무소", "면사무소"):
                d += suf[0]  # "금산읍사무소" → 금산읍
            if d in FIX:
                if FIX[d] is None:
                    return None
                d = FIX[d]
            if len(d) >= 2:
                return d, rank
    return None


def num_dong(name: str, known: set[str]) -> str:
    """OSM 경계 이름 "일도이동" → 센터 이름에 있는 "일도2동". 짝이 없으면 그대로."""
    m = re.match(r"^(.+)(일|이|삼|사|오)동$", name)
    if m:
        alt = f"{m.group(1)}{NUM_WORD[m.group(2)]}동"
        if alt in known:
            return alt
    return name


def legal_dong(name: str, others: set[str]) -> bool:
    """센터 없는 경계 이름이 법정동으로 보이면 True: "관동1가", 또는 "갈산동" 옆에 "갈산1동"이 있을 때."""
    if re.search(r"\d가$", name):
        return True
    stem = name[:-1] if name.endswith("동") else None
    return bool(stem) and any(re.match(rf"^{re.escape(stem)}\d", o) for o in others)


def sgg_of(sido: str, sgg: str, dong: str) -> str:
    if sido == "세종특별자치시":
        return "세종시"
    if sido == "제주특별자치도" and not sgg:
        return "서귀포시" if dong in SEOGWIPO else "제주시"
    return sgg


def main(paths: list[str]) -> None:
    blocks = []
    seen_lines = set()
    for p in paths:
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if not line.startswith("{") or line in seen_lines:
                continue
            seen_lines.add(line)
            blocks.append(json.loads(line))

    # 시·군·구(수준 6) 덩어리와, 일반구(수준 7) → 소속 시 찾기용 집합
    dongs: dict[str, dict[str, dict[tuple[str, str], dict]]] = {}
    offices: dict[str, dict[str, OrderedDict]] = {}
    gu_of: dict[tuple[str, float, float], str] = {}
    for b in blocks:
        if b["lv"] == 7:
            for nm, lat, lng in b["hall"]:
                gu_of[(nm, lat, lng)] = b["sgg"]
            for nm, lat, lng, _lv in b["dong"]:
                gu_of[(nm, lat, lng)] = b["sgg"]
    # 시·도마다 지금 있는 시·군·구(수준 6)와 일반구(수준 7) 이름 — 청사 이름을 읽어 칸을 정할 때 쓴다.
    sgg_names: dict[str, set[str]] = {}
    gu_names: dict[str, set[str]] = {}
    for b in blocks:
        sido = norm_sido(b["sido"])
        if sido and b["sgg"]:
            (gu_names if b["lv"] == 7 else sgg_names).setdefault(sido, set()).add(b["sgg"])
    for b in blocks:
        if b["lv"] == 7:
            continue
        sido = norm_sido(b["sido"])
        if not sido:
            continue
        known = {hd[0] for hd in (hall_dong(h[0]) for h in b["hall"]) if hd}
        centers = {}
        for nm, lat, lng, lv in b["dong"]:
            nm = num_dong(nm, known) if nm else nm
            if lv == 8 and nm and nm not in centers:
                centers[nm] = (lat, lng, gu_of.get((nm, lat, lng), ""))
        for nm, lat, lng in b["hall"]:
            if OFFICE_RE.search(nm):
                if SIDO_OFFICE.search(nm):
                    continue
                own = re.sub(r"\s+", "", nm)[:-1]  # "옹진군청" → 옹진군
                here = sgg_of(sido, b["sgg"], "")
                if sido == "제주특별자치도" and not b["sgg"]:
                    o_sgg = own                     # 제주시청 → 제주시
                elif own == here or own in gu_names.get(sido, set()):
                    o_sgg = here                    # 제 칸, 또는 일반구 청사(성산구청 → 창원시)
                elif own in sgg_names.get(sido, set()):
                    o_sgg = own                     # 다른 시·군·구 땅에 있는 청사(옹진군청)
                elif sido == "세종특별자치시":
                    o_sgg = here
                else:
                    continue                        # 없어진 이름(인천 중구청)
                offices.setdefault(sido, {}).setdefault(o_sgg, OrderedDict()).setdefault(nm, (lat, lng))
                continue
            hd = hall_dong(nm)
            if not hd:
                continue
            d, rank = hd
            table = dongs.setdefault(sido, {}).setdefault(sgg_of(sido, b["sgg"], d), {})
            c = centers.get(d)
            gu = gu_of.get((nm, lat, lng), c[2] if c else "")
            cur = table.get((gu, d))  # 일반구가 다르면 같은 동 이름도 따로
            if cur is None or rank < cur["rank"]:
                table[(gu, d)] = {"clat": c[0] if c else lat, "clng": c[1] if c else lng,
                                  "hall": re.sub(r"\s+", " ", nm).strip(), "hlat": lat, "hlng": lng, "rank": rank}
        # 센터는 못 찾았지만 경계가 있는 동(가운데만)
        for d, (lat, lng, gu) in centers.items():
            table = dongs.setdefault(sido, {}).setdefault(sgg_of(sido, b["sgg"], d), {})
            if any(k[1] == d for k in table) or legal_dong(d, {k[1] for k in table}):
                continue
            table[(gu, d)] = {"clat": lat, "clng": lng, "hall": "", "hlat": lat, "hlng": lng, "rank": 9}

    n_d = sum(len(t) for s in dongs.values() for t in s.values())
    n_h = sum(1 for s in dongs.values() for t in s.values() for v in t.values() if v["hall"])
    n_o = sum(len(t) for s in offices.values() for t in s.values())
    out = []
    out.append("/**")
    out.append(" * 읍·면·동 자리표 — 행정복지센터(주민센터·읍면사무소)와 시청·구청·군청.")
    out.append(" *")
    out.append(" * © OpenStreetMap 기여자, ODbL 1.0 (https://www.openstreetmap.org/copyright).")
    out.append(" * 이 파일은 OSM 자료에서 만든 파생 데이터베이스이며 ODbL 1.0 으로 배포한다.")
    out.append(" * 만든 곳: pipeline/osm_dong.py(받기) → pipeline/build_dong_data.py(정리). 손으로 고치지 말 것.")
    out.append(f" * 동 {n_d}곳(센터 {n_h}곳), 청사 {n_o}곳.")
    out.append(" */")
    out.append("/** [구(일반구, 없으면 \"\"), 읍·면·동, 동 가운데 위도, 경도, 행정복지센터 이름(\"\" 이면 없음), 센터 위도, 경도] */")
    out.append("export type DongTuple = [string, string, number, number, string, number, number];")
    out.append("export const DONG: Record<string, Record<string, DongTuple[]>> = {")
    for sido in sorted(dongs):
        out.append(f"  {json.dumps(sido, ensure_ascii=False)}: {{")
        for sgg in sorted(dongs[sido]):
            rows = dongs[sido][sgg]
            if not rows:
                continue
            items = []
            for gu, d in sorted(rows):
                v = rows[(gu, d)]
                items.append(json.dumps([gu, d, round(v["clat"], 5), round(v["clng"], 5), v["hall"], round(v["hlat"], 5), round(v["hlng"], 5)],
                                        ensure_ascii=False, separators=(",", ":")))
            out.append(f"    {json.dumps(sgg, ensure_ascii=False)}: [" + ",".join(items) + "],")
        out.append("  },")
    out.append("};")
    out.append("/** 시청·구청·군청: [이름, 위도, 경도] */")
    out.append("export const OFFICE: Record<string, Record<string, [string, number, number][]>> = {")
    for sido in sorted(offices):
        out.append(f"  {json.dumps(sido, ensure_ascii=False)}: {{")
        for sgg in sorted(offices[sido]):
            items = [json.dumps([nm, round(lat, 5), round(lng, 5)], ensure_ascii=False, separators=(",", ":")) for nm, (lat, lng) in offices[sido][sgg].items()]
            out.append(f"    {json.dumps(sgg, ensure_ascii=False)}: [" + ",".join(items) + "],")
        out.append("  },")
    out.append("};")
    out.append('export const DONG_AT = "2026-10-02";')
    print("\n".join(out))
    print(f"# 동 {n_d}, 센터 {n_h}, 청사 {n_o}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1:])
