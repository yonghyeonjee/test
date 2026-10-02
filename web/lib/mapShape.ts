import { SIDO_SHORT } from "./geo";

/**
 * 정책지도 핀의 모양. 서버(lib/mapData)와 화면(PolicyMap)이 같이 쓴다 — db 를
 * 끌어오지 않는 순수 모듈.
 *
 * 쪽에 실을 때는 핀을 짧은 배열(PinRow)로 보낸다. 이름표·주소·"모두 보기" 링크는
 * 시·도와 시·군·구에서 다시 만들 수 있어 싣지 않는다. 230개 핀이 RSC 자료로
 * 두 번(HTML·스크립트) 실리므로 한 핀에 300바이트만 줄여도 쪽이 60KB 가벼워진다.
 */
export type MapKind = "programs" | "jobs";

export type MapPointLite = {
  key: string;
  sido: string;
  sigungu: string | null;
  label: string;
  lat: number;
  lng: number;
  approx: boolean;
  n: number;
  nW: number;
  nB: number;
  more: string;
};

/** [시·도, 시·군·구, 위도, 경도, 건수, 복지, 기업, 시·도가운데(1), "모두 보기" 링크(다를 때만)] */
export type PinRow = [string, string | null, number, number, number, number, number, 0 | 1, string?];

export type MapDataLite = { p: PinRow[]; j: PinRow[]; nationwide: number; jobsNoPlace: number; at: string };

export const keyOf = (sido: string, sigungu: string | null) => `${sido}|${sigungu ?? ""}`;
export const labelOf = (sido: string, sigungu: string | null) =>
  sigungu ? `${SIDO_SHORT[sido] ?? sido} ${sigungu}` : (SIDO_SHORT[sido] ?? sido);

/** 그 핀의 공고를 모두 보는 곳. */
export function moreOf(kind: MapKind, sido: string, sigungu: string | null): string {
  if (kind === "jobs") return sigungu ? `/jobs/q/${encodeURIComponent(sigungu)}` : "/jobs";
  return sigungu
    ? `/?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(sigungu)}&via=map`
    : `/area/${encodeURIComponent(sido)}`;
}

export function toRow(kind: MapKind, p: MapPointLite): PinRow {
  const row: PinRow = [p.sido, p.sigungu, +p.lat.toFixed(4), +p.lng.toFixed(4), p.n, p.nW, p.nB, p.approx ? 1 : 0];
  if (p.more !== moreOf(kind, p.sido, p.sigungu)) row.push(p.more);
  return row;
}

export function fromRows(kind: MapKind, rows: PinRow[]): MapPointLite[] {
  return rows.map(([sido, sigungu, lat, lng, n, nW, nB, approx, more]) => ({
    key: keyOf(sido, sigungu), sido, sigungu, label: labelOf(sido, sigungu), lat, lng,
    approx: approx === 1, n, nW, nB, more: more ?? moreOf(kind, sido, sigungu),
  }));
}
