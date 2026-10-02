import { DONG, OFFICE } from "./dongData";
import { SIDO_SHORT, haversineKm, sggNow } from "./geo";

/**
 * 읍·면·동 자리(서버 전용 — dongData 가 크다). 정책지도 동네 단계와 "내 위치"가 쓴다.
 *
 * 자료는 OpenStreetMap(ODbL)의 행정동 경계 가운데와 행정복지센터·시청 위치다
 * (pipeline/osm_dong.py → lib/dongData.ts). 동이 어느 시·군·구인지는 OSM 경계 안에
 * 들었는지로 정했다. 경계선 자체는 싣지 않아, "내 위치가 어느 동인가"는 가장 가까운
 * 동 가운데로 어림한다 — 화면에는 "○○동 근처"라고 적는다.
 */
export type DongPlace = {
  key: string;
  sido: string;
  /** 시·군·구. 구가 있는 시는 시 이름(수원시) — 공고 자료가 그렇게 적는다. */
  sgg: string;
  /** 구가 있는 시의 구(장안구). 없으면 "". */
  gu: string;
  /** 읍·면·동 이름. 시청·구청 핀이면 "". */
  dong: string;
  /** 핀 자리: 행정복지센터가 있으면 그 자리, 없으면 동 가운데. */
  lat: number;
  lng: number;
  /** 동 가운데(동 어림에 쓴다). */
  clat: number;
  clng: number;
  /** 행정복지센터·청사 이름. 없으면 null. */
  hall: string | null;
  office: boolean;
};

export const dongKey = (sido: string, sgg: string, dong: string) => `dong|${sido}|${sgg}|${dong}`;
export const officeKey = (sido: string, sgg: string, name: string) => `office|${sido}|${sgg}|${name}`;

let flat: DongPlace[] | null = null;
let bySgg: Map<string, DongPlace[]> | null = null;

function build() {
  if (flat) return;
  const out: DongPlace[] = [];
  const m = new Map<string, DongPlace[]>();
  for (const [sido, table] of Object.entries(DONG)) {
    for (const [sgg, rows] of Object.entries(table)) {
      const list: DongPlace[] = [];
      for (const [gu, dong, clat, clng, hall, hlat, hlng] of rows) {
        const p: DongPlace = {
          key: dongKey(sido, sgg, gu ? `${gu} ${dong}` : dong), sido, sgg, gu, dong,
          lat: hall ? hlat : clat, lng: hall ? hlng : clng, clat, clng, hall: hall || null, office: false,
        };
        list.push(p);
        out.push(p);
      }
      m.set(`${sido}|${sgg}`, list);
    }
  }
  for (const [sido, table] of Object.entries(OFFICE)) {
    for (const [sgg, rows] of Object.entries(table)) {
      for (const [name, lat, lng] of rows) {
        out.push({ key: officeKey(sido, sgg, name), sido, sgg, gu: "", dong: "", lat, lng, clat: lat, clng: lng, hall: name, office: true });
      }
    }
  }
  flat = out;
  bySgg = m;
}

/** 화면 범위 안의 동·청사. 많으면 가운데에서 가까운 것부터 limit 개. */
export function placesIn(b: { s: number; w: number; n: number; e: number }, limit = 400): DongPlace[] {
  build();
  const inside = flat!.filter((p) => p.lat >= b.s && p.lat <= b.n && p.lng >= b.w && p.lng <= b.e);
  if (inside.length <= limit) return inside;
  const c: [number, number] = [(b.s + b.n) / 2, (b.w + b.e) / 2];
  return inside.map((p) => ({ p, d: haversineKm(c, [p.lat, p.lng]) })).sort((a, b2) => a.d - b2.d).slice(0, limit).map((x) => x.p);
}

/** 시·군·구 하나의 읍·면·동(이름 차례). 지역 고르기 셋째 칸. */
export function dongsOf(sido: string, sgg: string): DongPlace[] {
  build();
  return [...(bySgg!.get(`${sido}|${sggNow(sido, sgg)}`) ?? [])].sort((a, b) => (a.gu + a.dong).localeCompare(b.gu + b.dong, "ko"));
}

/**
 * 이 점에서 가장 가까운 동과 가장 가까운 행정복지센터. 15km 넘게 떨어지면 없음.
 *
 * 동까지의 거리는 동 가운데와 그 동 센터 중 가까운 쪽으로 잰다. 경계 가운데만 쓰면 넓은 동(제주
 * 중문동처럼 산까지 걸친 곳)의 가운데가 사람 사는 곳에서 멀어, 센터 바로 앞에서도 옆 동이 걸린다.
 */
export function nearestOf(lat: number, lng: number): { dong: (DongPlace & { km: number }) | null; hall: (DongPlace & { km: number }) | null } {
  build();
  let dong: (DongPlace & { km: number }) | null = null;
  let hall: (DongPlace & { km: number }) | null = null;
  for (const p of flat!) {
    if (Math.abs(p.clat - lat) > 0.2 || Math.abs(p.clng - lng) > 0.25) continue;
    if (!p.office) {
      const kc = haversineKm([lat, lng], [p.clat, p.clng]);
      const kh = p.hall ? haversineKm([lat, lng], [p.lat, p.lng]) : Infinity;
      const kd = Math.min(kc, kh);
      if (kd <= 15 && (!dong || kd < dong.km)) dong = { ...p, km: kd };
      if (kh <= 15 && (!hall || kh < hall.km)) hall = { ...p, km: kh };
    }
  }
  return { dong, hall };
}

/** "경기 시흥시 정왕1동" */
export const placeLabel = (p: DongPlace) =>
  [SIDO_SHORT[p.sido] ?? p.sido, p.sgg, p.gu, p.dong].filter(Boolean).join(" ");

const HALL_WORD = /^(행정복지센터|주민센터|주민자치센터|동사무소|읍사무소|면사무소)/;

/**
 * 글에 이 시·군·구의 읍·면·동 이름이 분명히 적혔으면 그 동. 공고를 동에 붙일 때만 쓴다.
 *
 *  - 띄어쓰기로 갈린 말마디가 동 이름과 똑같거나, 동 이름 바로 뒤에 행정복지센터·주민센터가
 *    붙은 경우만("소룡동 어린이 장난감도서관", "정왕1동행정복지센터").
 *  - 두 글자 이름(중동·신동·본동)은 "중동 수출"처럼 다른 뜻이 흔해 뒤에 센터 말이 올 때만.
 *  - "읍·면·동 행정복지센터"처럼 어느 동인지 없는 말은 걸리지 않는다(동 이름표에 없다).
 *  - 둘 이상 걸리면 고르지 않는다.
 */
export function dongInText(sido: string, sgg: string, ...texts: (string | null | undefined)[]): DongPlace | null {
  build();
  const list = bySgg!.get(`${sido}|${sggNow(sido, sgg)}`);
  if (!list?.length) return null;
  const hits = new Set<DongPlace>();
  for (const t of texts) {
    if (!t) continue;
    const toks = t.split(/[\s,()[\]/·「」『』<>]+/).filter(Boolean);
    for (let i = 0; i < toks.length; i++) {
      const tok = toks[i];
      for (const p of list) {
        if (!p.dong || !tok.startsWith(p.dong)) continue;
        const rest = tok.slice(p.dong.length);
        const nextHall = HALL_WORD.test(rest) || (rest === "" && HALL_WORD.test(toks[i + 1] ?? ""));
        if (p.dong.length <= 2 ? nextHall : rest === "" || nextHall) hits.add(p);
      }
    }
  }
  return hits.size === 1 ? [...hits][0] : null;
}
