import { SIDO_POINT } from "@/lib/geoData";
import { SIDO_SHORT, fmtKm, mapLinks } from "@/lib/geo";
import type { MapItem, MapPointLite } from "@/lib/mapData";

/**
 * 지도 엔진(Leaflet·카카오)이 같이 쓰는 핀과 말풍선 — HTML 글자로 만든다.
 *
 * 핀은 세 단계로 그린다. 멀리서(전국)는 시·도마다 하나씩 건수를 적은 큰 핀, 중간은
 * 건수만 적은 작은 동그라미, 가까이서는 이름과 건수가 적힌 말풍선 핀. 230개 핀에
 * 전부 이름을 달면 수도권에서 서로 가린다.
 */
export type Kind = "programs" | "jobs";
export type Tier = "far" | "mid" | "near";

export type Pin = {
  key: string;
  lat: number;
  lng: number;
  label: string;
  n: number;
  nW: number;
  nB: number;
  approx: boolean;
  kind: Kind;
  level: "sido" | "sgg";
  sido: string;
  sigungu: string | null;
  more: string;
  km: number | null;
};

/** Leaflet zoom → 단계. */
export const tierOfZoom = (z: number): Tier => (z <= 8 ? "far" : z <= 10 ? "mid" : "near");
/** 카카오맵 level(작을수록 가까움, 대략 zoom ≈ 19 − level) → 단계. */
export const tierOfLevel = (lv: number): Tier => (lv >= 11 ? "far" : lv >= 9 ? "mid" : "near");

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export const itemHref = (it: MapItem) => (it.kind === "job" ? `/jobs/${encodeURIComponent(it.id)}` : `/p/${encodeURIComponent(it.id)}`);
export const itemWhen = (it: MapItem) => (it.always ? "상시" : it.end ? `~${it.end.slice(5).replace("-", ".")}` : "");

export function toPin(p: MapPointLite, kind: Kind, km: number | null): Pin {
  return { key: p.key, lat: p.lat, lng: p.lng, label: p.label, n: p.n, nW: p.nW, nB: p.nB, approx: p.approx,
           kind, level: "sgg", sido: p.sido, sigungu: p.sigungu, more: p.more, km };
}

/** 시·도마다 하나로 묶는다(멀리서 볼 때). */
export function sidoPins(pins: Pin[]): Pin[] {
  const m = new Map<string, Pin>();
  for (const p of pins) {
    const pt = SIDO_POINT[p.sido];
    if (!pt) continue;
    const cur = m.get(p.sido) ?? {
      key: `sido|${p.sido}`, lat: pt[0], lng: pt[1], label: SIDO_SHORT[p.sido] ?? p.sido, n: 0, nW: 0, nB: 0,
      approx: false, kind: p.kind, level: "sido", sido: p.sido, sigungu: null, more: `/area/${encodeURIComponent(p.sido)}`, km: null,
    };
    cur.n += p.n; cur.nW += p.nW; cur.nB += p.nB;
    m.set(p.sido, cur);
  }
  return [...m.values()];
}

const fmtN = (n: number) => n.toLocaleString("ko-KR");

/** 핀 HTML. CSS 가 자리(아래쪽 뾰족한 끝이 좌표)를 잡는다. */
export function pinHtml(p: Pin, tier: Tier, selected = false): string {
  const cls = ["pm-pin", `pm-${tier}`, p.kind === "jobs" ? "pm-jobs" : "", p.approx ? "pm-approx" : "", selected ? "pm-sel" : ""].filter(Boolean).join(" ");
  if (tier === "mid") return `<div class="${cls}" title="${esc(p.label)} ${fmtN(p.n)}건"><i>${fmtN(p.n)}</i></div>`;
  // 건수 0 은 상세 쪽 작은 지도(핀 하나, 건수 없음).
  return `<div class="${cls}"><b>${esc(p.label)}</b>${p.n > 0 ? `<i>${fmtN(p.n)}</i>` : ""}</div>`;
}

/** 점 하나를 눌렀을 때의 카드. items 가 null 이면 아직 받는 중. */
export function cardHtml(p: Pin, items: MapItem[] | null, opts: { close?: boolean } = {}): string {
  const list = items === null
    ? '<li class="pm-wait">불러오는 중…</li>'
    : items.length === 0 ? '<li class="pm-wait">요약을 못 받았습니다. 모두 보기로 가 주세요.</li>'
    : items.slice(0, 4).map((it) => `<li><a href="${itemHref(it)}">${esc(it.t)}</a><span>${esc(itemWhen(it))}</span></li>`).join("");
  const links = mapLinks(`${p.sigungu ?? p.sido}청`);
  const counts = p.kind === "jobs" ? `채용 ${fmtN(p.n)}건 접수 중` : `복지 ${fmtN(p.nW)} · 기업 ${fmtN(p.nB)} 접수 중`;
  const dist = p.km !== null
    ? `내 위치 기준 <b>${fmtKm(p.km)}</b> (직선거리)`
    : p.approx ? "시·도 가운데 기준" : "시·군·구 가운데 기준";
  const first = items && items[0] ? itemHref(items[0]) : p.more;
  return `<div class="pm-card">` +
    (opts.close ? '<button type="button" class="pm-close" data-close aria-label="닫기">×</button>' : "") +
    `<b class="pm-title">${esc(p.label)}</b>` +
    `<div class="pm-dist">${dist}${p.approx ? ' <span class="pm-approx-tag">시·군·구 미표기</span>' : ""}</div>` +
    `<div class="pm-meta">${counts}</div>` +
    `<ul class="pm-items">${list}</ul>` +
    `<div class="pm-nav"><a href="${links.naver}" target="_blank" rel="noopener">네이버지도로 길찾기</a><a href="${links.kakao}" target="_blank" rel="noopener">카카오맵으로 길찾기</a></div>` +
    `<div class="pm-btns"><a class="pm-btn" href="${p.more}">${fmtN(p.n)}건 모두 보기</a><a class="pm-btn pm-btn-primary" href="${first}">상세보기</a></div>` +
    `</div>`;
}

/** 카드가 핀 위에 뜨도록 하는 좌표 보정(미터). 반경 원을 화면에 맞출 때도 쓴다. */
export function boundsAround(lat: number, lng: number, km: number) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180));
  return { sw: [lat - dLat, lng - dLng] as [number, number], ne: [lat + dLat, lng + dLng] as [number, number] };
}
