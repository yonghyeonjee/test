import { SIDO_POINT } from "@/lib/geoData";
import { SIDO_SHORT, fmtKm, mapLinks } from "@/lib/geo";
import type { MapItem, MapPointLite } from "@/lib/mapData";

/**
 * 지도 엔진(Leaflet·카카오·네이버)이 같이 쓰는 핀과 카드 — HTML 글자로 만든다.
 *
 * 멀리서(전국)는 시·도마다 핀 하나, 가까이 가면 시·군·구마다 핀 하나. 어느 쪽이든
 * 이름표는 화면에서 서로 겹치지 않는 것만 단다(pickLabels) — 건수 많은 곳부터
 * 자리를 잡고, 자리가 없는 곳은 건수만 적은 작은 동그라미가 된다. 지도를 움직이면
 * 다시 고른다. 230개 핀에 전부 이름을 달면 수도권에서 서로 가렸다.
 */
export type Kind = "programs" | "jobs";
export type Tier = "far" | "near";

export type Pin = {
  key: string;
  lat: number;
  lng: number;
  /** 카드 제목. "경기 시흥시" */
  label: string;
  /** 지도 위 이름표. "시흥시" — 지도 자체가 어느 도인지 보여 준다. */
  short: string;
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

/** Leaflet·네이버 zoom → 단계. 8 이하는 시·도 묶음. */
export const tierOfZoom = (z: number): Tier => (z <= 8 ? "far" : "near");
/** 카카오맵 level(작을수록 가까움, 대략 zoom ≈ 19 − level) → 단계. */
export const tierOfLevel = (lv: number): Tier => (lv >= 11 ? "far" : "near");

export type XY = { x: number; y: number };
/** 이름표 자리. tip: 아래쪽 뾰족한 끝이 좌표(시·군·구). c/n/s/e/w: 가운데·위·아래·오른쪽·왼쪽(시·도). */
export type Pos = "tip" | "c" | "n" | "s" | "e" | "w";
type Box = { l: number; r: number; t: number; b: number };

/** 이름표 상자(px). 글꼴 12.5px 기준 한글 한 자 ≈ 12.5px. */
function labelBox(p: Pin, xy: XY, pos: Pos): Box {
  const w = 24 + p.short.length * 13.4 + (p.n > 0 ? 12 + String(p.n).length * 7.8 : 0);
  const h = 26, g = 6;
  switch (pos) {
    case "tip": return { l: xy.x - w / 2, r: xy.x + w / 2, t: xy.y - h - 9, b: xy.y };
    case "n": return { l: xy.x - w / 2, r: xy.x + w / 2, t: xy.y - h - g, b: xy.y - g };
    case "s": return { l: xy.x - w / 2, r: xy.x + w / 2, t: xy.y + g, b: xy.y + h + g };
    case "e": return { l: xy.x + g, r: xy.x + w + g, t: xy.y - h / 2, b: xy.y + h / 2 };
    case "w": return { l: xy.x - w - g, r: xy.x - g, t: xy.y - h / 2, b: xy.y + h / 2 };
    default: return { l: xy.x - w / 2, r: xy.x + w / 2, t: xy.y - h / 2, b: xy.y + h / 2 };
  }
}

/**
 * 이름표를 달 핀들과 그 자리. 고른 것(selected)과 건수 많은 것이 먼저 자리를 잡는다.
 * 시·도 핀(멀리서)은 가운데가 막히면 위·아래·오른쪽·왼쪽으로 비켜 본다 — 서울·인천·
 * 경기처럼 붙어 있는 곳도 이름이 보이게. 시·군·구 핀은 좌표를 가리켜야 하므로 비키지
 * 않고, 자리가 없으면 동그라미가 된다. 화면 밖 핀은 건너뛴다 — 지도를 움직이면 다시 고른다.
 */
export function pickLabels(pins: Pin[], project: (p: Pin) => XY | null, size: { w: number; h: number },
                           tier: Tier, selected: string | null): Map<string, Pos> {
  const order = [...pins].sort((a, b) => (a.key === selected ? -1 : b.key === selected ? 1 : b.n - a.n));
  const taken: Box[] = [];
  const out = new Map<string, Pos>();
  const pad = 4;
  const hit = (box: Box) => taken.some((t) => !(box.r + pad < t.l || box.l - pad > t.r || box.b + pad < t.t || box.t - pad > t.b));
  for (const p of order) {
    const xy = project(p);
    if (!xy) continue;
    if (xy.x < -60 || xy.y < -40 || xy.x > size.w + 60 || xy.y > size.h + 40) continue;
    const tries: Pos[] = tier === "far" || p.level === "sido" ? ["c", "e", "w", "n", "s"] : ["tip"];
    for (const pos of tries) {
      const box = labelBox(p, xy, pos);
      // 비켜 놓은 이름표가 화면 밖으로 나가면 안 된다(부산이 오른쪽 끝에서 잘렸다).
      if (pos !== "c" && pos !== "tip" && (box.l < 2 || box.t < 2 || box.r > size.w - 2 || box.b > size.h - 2)) continue;
      if (hit(box)) continue;
      taken.push(box);
      out.set(p.key, pos);
      break;
    }
  }
  return out;
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export const itemHref = (it: MapItem) => (it.kind === "job" ? `/jobs/${encodeURIComponent(it.id)}` : `/p/${encodeURIComponent(it.id)}`);
export const itemWhen = (it: MapItem) => (it.always ? "상시" : it.end ? `~${it.end.slice(5).replace("-", ".")}` : "");

export function toPin(p: MapPointLite, kind: Kind, km: number | null): Pin {
  return { key: p.key, lat: p.lat, lng: p.lng, label: p.approx ? `${p.label} 전역` : p.label,
           short: p.sigungu ?? `${p.label} 전역`, n: p.n, nW: p.nW, nB: p.nB,
           approx: p.approx, kind, level: "sgg", sido: p.sido, sigungu: p.sigungu, more: p.more, km };
}

/** 시·도마다 하나로 묶는다(멀리서 볼 때). */
export function sidoPins(pins: Pin[]): Pin[] {
  const m = new Map<string, Pin>();
  for (const p of pins) {
    const pt = SIDO_POINT[p.sido];
    if (!pt) continue;
    const cur = m.get(p.sido) ?? {
      key: `sido|${p.sido}`, lat: pt[0], lng: pt[1], label: SIDO_SHORT[p.sido] ?? p.sido, short: SIDO_SHORT[p.sido] ?? p.sido, n: 0, nW: 0, nB: 0,
      approx: false, kind: p.kind, level: "sido", sido: p.sido, sigungu: null, more: `/area/${encodeURIComponent(p.sido)}`, km: null,
    };
    cur.n += p.n; cur.nW += p.nW; cur.nB += p.nB;
    m.set(p.sido, cur);
  }
  return [...m.values()];
}

const fmtN = (n: number) => n.toLocaleString("ko-KR");

/**
 * 핀 HTML. CSS 가 자리를 잡는다 — 이름표 핀은 아래쪽 뾰족한 끝이 좌표, 시·도 핀과
 * 동그라미는 가운데가 좌표.
 */
export function pinHtml(p: Pin, tier: Tier, pos: Pos | undefined, selected = false): string {
  const labeled = pos !== undefined;
  const heat = p.n >= 50 ? "pm-t1" : p.n >= 20 ? "pm-t2" : "pm-t3";
  const cls = ["pm-pin", tier === "far" || p.level === "sido" ? "pm-far" : "pm-near", labeled ? `pm-at-${pos}` : `pm-dot ${heat}`,
               p.kind === "jobs" ? "pm-jobs" : "", p.approx ? "pm-approx" : "", selected ? "pm-sel" : ""].filter(Boolean).join(" ");
  const title = `${esc(p.label)}${p.n > 0 ? ` ${fmtN(p.n)}건` : ""}`;
  if (!labeled) return `<div class="${cls}" title="${title}"><i>${p.n > 0 ? fmtN(p.n) : ""}</i></div>`;
  // 건수 0 은 상세 쪽 작은 지도(핀 하나, 건수 없음).
  return `<div class="${cls}" title="${title}"><b>${esc(p.short)}</b>${p.n > 0 ? `<i>${fmtN(p.n)}</i>` : ""}</div>`;
}

/** 카드가 핀을 가리지 않게 핀 위로 띄우는 거리(px). */
export const cardLift = (p: Pin, tier: Tier, labeled: boolean) =>
  tier === "far" || p.level === "sido" || !labeled ? 18 : 40;

/** 점 하나를 눌렀을 때의 카드. items 가 null 이면 아직 받는 중. */
export function cardHtml(p: Pin, items: MapItem[] | null, opts: { close?: boolean } = {}): string {
  const list = items === null
    ? '<li class="pm-wait">불러오는 중…</li>'
    : items.length === 0 ? '<li class="pm-wait">요약을 못 받았습니다. 모두 보기로 가 주세요.</li>'
    : items.slice(0, 4).map((it) => `<li><a href="${itemHref(it)}">${esc(it.t)}</a><span>${esc(itemWhen(it))}</span></li>`).join("") +
      (p.n > 4 ? `<li class="pm-wait">외 ${fmtN(p.n - 4)}건 — 아래 단추로 전부 보기</li>` : "");
  const links = mapLinks(`${p.sigungu ?? p.sido}청`);
  const counts = p.kind === "jobs" ? `채용 ${fmtN(p.n)}건 접수 중` : `복지 ${fmtN(p.nW)} · 기업 ${fmtN(p.nB)} 접수 중`;
  const dist = p.km !== null
    ? `내 위치 기준 <b>${fmtKm(p.km)}</b> (직선거리)`
    : p.approx ? "시·도 가운데 기준" : "시·군·구 가운데 기준";
  return `<div class="pm-card">` +
    (opts.close ? '<button type="button" class="pm-close" data-close aria-label="닫기">×</button>' : "") +
    `<b class="pm-title">${esc(p.label)}</b>` +
    `<div class="pm-dist">${dist}${p.approx ? ' <span class="pm-approx-tag">시·군·구 미표기</span>' : ""}</div>` +
    `<div class="pm-meta">${counts}</div>` +
    `<ul class="pm-items">${list}</ul>` +
    `<div class="pm-nav"><a href="${links.naver}" target="_blank" rel="noopener">네이버지도로 길찾기</a><a href="${links.kakao}" target="_blank" rel="noopener">카카오맵으로 길찾기</a></div>` +
    `<div class="pm-btns"><a class="pm-btn pm-btn-primary" href="${p.more}">이 지역 ${fmtN(p.n)}건 모두 보기 →</a></div>` +
    `</div>`;
}

/** 카드가 핀 위에 뜨도록 하는 좌표 보정(미터). 반경 원을 화면에 맞출 때도 쓴다. */
export function boundsAround(lat: number, lng: number, km: number) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180));
  return { sw: [lat - dLat, lng - dLng] as [number, number], ne: [lat + dLat, lng + dLng] as [number, number] };
}
