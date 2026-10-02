import { SIDO_POINT } from "@/lib/geoData";
import { SIDO_SHORT, fmtKm, mapLinks } from "@/lib/geo";
import type { MapItem, MapPointLite } from "@/lib/mapData";

/**
 * 지도 엔진(Leaflet·카카오·네이버)이 같이 쓰는 핀과 카드 — HTML 글자로 만든다.
 *
 * 세 단계다.
 *  - 멀리서(전국): 시·도마다 핀 하나.
 *  - 가까이: 시·군·구마다 핀 하나(공고의 자리).
 *  - 더 가까이(동네): 시·군·구 핀에 더해 읍·면·동마다 행정복지센터(없으면 동 가운데) 핀과
 *    시청·구청. 공고에는 주소가 없어 공고를 동에 꽂지 않는다 — 동 이름이 분명히 적힌
 *    공고만 그 동에 붙는다(건수). 동 핀은 "찾아가는 곳"이다.
 * 어느 단계든 이름표는 화면에서 서로 겹치지 않는 것만 단다(pickLabels) — 건수 많은
 * 곳부터 자리를 잡고, 자리가 없는 곳은 작은 동그라미가 된다. 지도를 움직이면 다시 고른다.
 */
export type Kind = "programs" | "jobs";
export type Tier = "far" | "near" | "dong";

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
  level: "sido" | "sgg" | "dong";
  sido: string;
  sigungu: string | null;
  more: string;
  km: number | null;
  /** 동 핀: 행정복지센터 이름(없으면 null — 동 가운데에 놓인 핀). 시청·구청 핀이면 그 이름. */
  hall?: string | null;
  /** 동 핀: 읍·면·동 이름, 구가 있는 시의 구 이름. */
  dong?: string;
  gu?: string;
  /** 시청·구청 핀. */
  office?: boolean;
  /** 동 핀이 속한 시·군·구의 공고 수(카드의 "○○시 공고 N건 보기"). */
  sggN?: number;
};

/** Leaflet·네이버 zoom → 단계. 8 이하는 시·도 묶음, 12 이상은 동네(읍·면·동). */
export const DONG_ZOOM = 12;
export const tierOfZoom = (z: number): Tier => (z <= 8 ? "far" : z < DONG_ZOOM ? "near" : "dong");
/** 카카오맵 level(작을수록 가까움, 대략 zoom ≈ 19 − level) → 단계. */
export const tierOfLevel = (lv: number): Tier => (lv >= 11 ? "far" : lv >= 8 ? "near" : "dong");

/** 이 단계에서 그릴 핀. 동네 단계에서는 시·군·구 핀 위에 동 핀(extra)을 더한다. */
export function visiblePins(pins: Pin[], extra: Pin[], tier: Tier): Pin[] {
  if (tier === "far" && pins.length > 1) return sidoPins(pins);
  if (tier === "dong") return [...pins, ...extra];
  return pins;
}

/** 화면에 보이는 범위. 엔진이 움직임이 멎을 때마다 알린다. */
export type View = { s: number; w: number; n: number; e: number; zoom: number };

export type XY = { x: number; y: number };
/** 이름표 자리. tip: 아래쪽 뾰족한 끝이 좌표(시·군·구). c/n/s/e/w: 가운데·위·아래·오른쪽·왼쪽(시·도). */
export type Pos = "tip" | "c" | "n" | "s" | "e" | "w";
type Box = { l: number; r: number; t: number; b: number };

/** 이름표 상자(px). 글꼴 12.5px 기준 한글 한 자 ≈ 12.5px. */
function labelBox(p: Pin, xy: XY, pos: Pos): Box {
  const w = 24 + p.short.length * (p.level === "dong" ? 12.4 : 13.4) + (p.level === "dong" ? 14 : 0)
    + (p.n > 0 ? 12 + String(p.n).length * 7.8 : 0);
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
  const at = new Map<string, XY | null>();
  for (const p of pins) at.set(p.key, project(p));
  // 동 핀은 화면 가운데(고른 동·내 위치)에 가까운 것부터 — 촘촘한 도시에서도 고른 동 이름이 먼저 선다.
  const cx = size.w / 2, cy = size.h / 2;
  const far = (p: Pin) => { const xy = at.get(p.key); return xy ? (xy.x - cx) ** 2 + (xy.y - cy) ** 2 : Infinity; };
  // 화면 가운데에 선 동(고른 동·내 위치의 동)은 시·군·구 이름표보다도 먼저 — 시·군·구 이름표가 그 자리를 덮었다.
  let mid: string | null = null, midD = 60 * 60;
  for (const p of pins) if (p.level === "dong" && far(p) < midD) { mid = p.key; midD = far(p); }
  const rank = (p: Pin) => (p.key === mid ? -1 : p.level === "dong" ? (p.n > 0 ? 1 : 2) : 0);
  const order = [...pins].sort((a, b) =>
    a.key === selected ? -1 : b.key === selected ? 1 : rank(a) - rank(b) || (rank(a) === 2 ? far(a) - far(b) : b.n - a.n));
  const taken: Box[] = [];
  const out = new Map<string, Pos>();
  const pad = 4;
  const hit = (box: Box) => taken.some((t) => !(box.r + pad < t.l || box.l - pad > t.r || box.b + pad < t.t || box.t - pad > t.b));
  for (const p of order) {
    const xy = at.get(p.key);
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

/**
 * 실제로 그릴 핀. 동네 단계의 동·센터 핀은 이름표가 선 것(과 동 이름이 적힌 공고가 있는 것, 고른 것)만
 * 그린다 — 서울처럼 촘촘한 곳에서 이름 없는 점 수백 개가 화면을 덮었다. 확대하면 더 선다.
 */
export const drawnPins = (list: Pin[], show: Map<string, Pos>, selected: string | null) =>
  list.filter((p) => p.level !== "dong" || show.has(p.key) || p.n > 0 || p.key === selected);

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
  if (p.level === "dong") {
    // 동네 단계의 동·센터·청사 핀. 이름표 자리가 없으면 작은 회색 점.
    const cls = ["pm-pin", "pm-dong", p.office ? "pm-office" : "", p.n > 0 ? "pm-dong-has" : "",
                 labeled ? "pm-at-tip" : "pm-dongdot", selected ? "pm-sel" : ""].filter(Boolean).join(" ");
    const title = esc(p.hall ?? p.label);
    if (!labeled) return `<div class="${cls}" title="${title}"></div>`;
    return `<div class="${cls}" title="${title}"><s aria-hidden="true"></s><b>${esc(p.short)}</b>${p.n > 0 ? `<i>${fmtN(p.n)}</i>` : ""}</div>`;
  }
  const heat = p.n >= 50 ? "pm-t1" : p.n >= 20 ? "pm-t2" : "pm-t3";
  const cls = ["pm-pin", tier === "far" || p.level === "sido" ? "pm-far" : "pm-near", labeled ? `pm-at-${pos}` : `pm-dot ${heat}`,
               p.kind === "jobs" ? "pm-jobs" : "", p.approx ? "pm-approx" : "", selected ? "pm-sel" : ""].filter(Boolean).join(" ");
  const title = `${esc(p.label)}${p.n > 0 ? ` ${fmtN(p.n)}건` : ""}`;
  if (!labeled) return `<div class="${cls}" title="${title}"><i>${p.n > 0 ? fmtN(p.n) : ""}</i></div>`;
  // 건수 0 은 상세 쪽 작은 지도(핀 하나, 건수 없음). 동네 단계에서는 시·군·구 전체임을 밝힌다.
  const name = tier === "dong" && p.level === "sgg" && p.sigungu ? `${p.short} 전체` : p.short;
  return `<div class="${cls}" title="${title}"><b>${esc(name)}</b>${p.n > 0 ? `<i>${fmtN(p.n)}</i>` : ""}</div>`;
}

/** 카드가 핀을 가리지 않게 핀 위로 띄우는 거리(px). */
export const cardLift = (p: Pin, tier: Tier, labeled: boolean) =>
  tier === "far" || p.level === "sido" || !labeled ? 18 : p.level === "dong" ? 34 : 40;

/**
 * 동·센터·청사 핀의 카드. 공고 목록이 아니라 "찾아가는 곳" 카드다 — 이름, 어느 동인지,
 * 기준(내 위치·고른 동)에서 거리, 길찾기, 그리고 그 시·군·구 공고로 가는 단추. 동 이름이 분명히 적힌
 * 공고가 있으면 그것만 위에 보인다.
 */
function dongCardHtml(p: Pin, items: MapItem[] | null, opts: { close?: boolean }): string {
  const sgg = p.sigungu ?? "";
  const where = [SIDO_SHORT[p.sido] ?? p.sido, sgg, p.gu, p.office ? "" : p.dong].filter(Boolean).join(" ");
  const title = p.hall ?? (p.dong ? `${p.dong}` : p.label);
  const q = `${sgg} ${p.hall ?? p.dong ?? ""}`.trim();
  const links = mapLinks(q);
  const has = items && items.length > 0;
  const list = has
    ? `<div class="pm-meta">이 동 이름이 적힌 공고 ${fmtN(items!.length)}건</div><ul class="pm-items">` +
      items!.slice(0, 4).map((it) => `<li><a href="${itemHref(it)}">${esc(it.t)}</a><span>${esc(itemWhen(it))}</span></li>`).join("") + "</ul>"
    : items === null && p.n > 0 ? '<ul class="pm-items"><li class="pm-wait">불러오는 중…</li></ul>' : "";
  const note = p.office
    ? "시·군·구 사업의 담당 부서가 있는 청사입니다."
    : p.hall
      ? "복지 신청·상담은 주소지 행정복지센터에서 하는 경우가 많습니다."
      : "행정복지센터 위치 자료가 없어 동 경계의 가운데에 놓았습니다. 찾아가기 전에 지도 앱에서 확인하세요.";
  // 거리는 "기준"(내 위치나 고른 동)에서 잰다. 기준이 바로 그 센터면(고른 동) 적지 않는다.
  const dist = p.km !== null && p.km >= 0.05 ? `<div class="pm-dist">기준에서 <b>${fmtKm(p.km)}</b> (직선거리)</div>` : "";
  const btn = sgg && p.sggN
    ? `<div class="pm-btns"><a class="pm-btn pm-btn-primary" href="${p.more}">${esc(sgg)} ${p.kind === "jobs" ? "채용" : "공고"} ${fmtN(p.sggN)}건 보기 →</a></div>`
    : "";
  return `<div class="pm-card pm-dcard">` +
    (opts.close ? '<button type="button" class="pm-close" data-close aria-label="닫기">×</button>' : "") +
    `<b class="pm-title">${esc(title)}</b>` +
    `<div class="pm-meta">${esc(where)}</div>` + dist + list +
    `<p class="pm-note">${note}</p>` +
    `<div class="pm-nav"><a href="${links.naver}" target="_blank" rel="noopener">네이버지도로 길찾기</a><a href="${links.kakao}" target="_blank" rel="noopener">카카오맵으로 길찾기</a></div>` +
    btn + `</div>`;
}

/** 점 하나를 눌렀을 때의 카드. items 가 null 이면 아직 받는 중. */
export function cardHtml(p: Pin, items: MapItem[] | null, opts: { close?: boolean } = {}): string {
  if (p.level === "dong") return dongCardHtml(p, items, opts);
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
