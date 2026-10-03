"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SIDO_POINT } from "@/lib/geoData";
import { SIDO_SHORT, fmtKm, haversineKm, locate, mapLinks, sggChoices, type LatLng } from "@/lib/geo";
import type { ListItem, MapItem } from "@/lib/mapData";
import { fromRows, moreOf, type MapDataLite } from "@/lib/mapShape";
import MapCanvas, { type Handle } from "./map/MapCanvas";
import { DONG_ZOOM, itemHref, toPin, type Kind, type Pin, type View } from "./map/pins";
import { track } from "./Gtm";

/** 반경(km). 3·5km 는 동네 단계 — 지도가 읍·면·동 행정복지센터까지 보이게 가까워진다. 0 은 전체. */
const RADII = [3, 5, 10, 30, 100, 0];
/** /api/map/dongs 한 줄: [열쇠, 시·도, 시·군·구, 구, 동, 위도, 경도, 센터 이름, 청사(1), 동 이름이 적힌 공고 수] */
type DongRow = [string, string, string, string, string, number, number, string, 0 | 1, number];
/** /api/map/where 응답 */
type Where = {
  dong: { sido: string; sgg: string; gu: string; dong: string; label: string; km: number } | null;
  hall: { name: string; sido: string; sgg: string; lat: number; lng: number; km: number } | null;
};
export const GEO_KEY = "jw.geo.v1";
const PAGE = 30;
const itemKey = (kind: Kind, key: string) => `${kind}|${key}`;
type Status = "all" | "soon" | "always";
type Sort = "near" | "end";

/** 한국 시각 오늘. 카드의 D-day 가 서버(한국 시각)와 맞아야 한다. */
const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const dot = (s: string | null) => (s ? s.slice(2).replaceAll("-", ".") : "");

/** 카드 머리의 상태 배지. 마감 임박은 빨강, 접수 중은 초록, 상시는 파랑, 예정은 회색. */
function statusOf(it: MapItem, today: string): { label: string; cls: string } {
  if (it.always || !it.end) return { label: "상시", cls: "pm-st-always" };
  if (it.start && it.start > today) return { label: `${dot(it.start)} 시작`, cls: "pm-st-soon" };
  const d = dayDiff(today, it.end);
  if (d < 0) return { label: "마감", cls: "pm-st-closed" };
  if (d === 0) return { label: "오늘 마감", cls: "pm-st-urgent" };
  if (d <= 3) return { label: `D-${d}`, cls: "pm-st-urgent" };
  if (d <= 7) return { label: `D-${d}`, cls: "pm-st-warn" };
  return { label: "접수 중", cls: "pm-st-open" };
}

const KIND_LABEL: Record<MapItem["kind"], string> = { welfare: "복지", business: "기업", job: "채용" };

/**
 * 정책지도 — kjebi "Smart 기업 입찰 지도"처럼 왼쪽은 공고 카드, 오른쪽은 지도.
 *
 *  - 카드: 핀 아이콘 · 제목 · 상태 배지(마감 임박 D-n / 접수 중 / 상시 / 시작 예정) · 기관 ·
 *    지역(내 위치에서 몇 km) · 접수 기간. 제목은 상세로, 카드의 나머지를 누르면 지도에서 그 자리.
 *  - 위: 지원사업/채용, 내 위치로 보기·지역 고르기, 반경. 카드 위: 상태(전체·7일 안 마감·상시)와
 *    정렬(가까운 순·마감 임박 순).
 *  - 지도의 핀을 누르면 그 자리 카드만 남는다("시흥시만 ×" 로 풀기).
 *  - 공고에는 주소가 없어 핀은 시·군·구마다 하나다(가운데 좌표). 그래서 카드는 공고마다,
 *    핀은 자리마다다. 카드 목록은 /api/map/list 에서 쪽마다 받는다.
 *
 * 지도는 components/map/MapCanvas — 카카오맵 키가 있으면 카카오맵(kjebi 와 같은 기술),
 * 없으면 네이버·Leaflet.
 */
export default function PolicyMap({ data, initial }: { data: MapDataLite; initial?: { total: number; items: ListItem[] } }) {
  const [kind, setKind] = useState<Kind>("programs");
  const [me, setMe] = useState<LatLng | null>(null);
  const [meLabel, setMeLabel] = useState("");
  const [radius, setRadius] = useState(5);
  const [sel, setSel] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<Sort>("near");
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<{ total: number; items: ListItem[] }>(initial ?? { total: 0, items: [] });
  const [loading, setLoading] = useState(false);
  const [today, setToday] = useState("");
  const [items, setItems] = useState<Record<string, MapItem[]>>({});
  // 동네 단계: 보이는 범위(엔진이 알림)와 그 안의 읍·면·동 행정복지센터·청사.
  const [view, setView] = useState<View | null>(null);
  const [dongRows, setDongRows] = useState<DongRow[]>([]);
  const lastBox = useRef("");
  // 내 위치가 어느 동 근처인지, 가장 가까운 행정복지센터, 내 시·군·구(목록 맨 앞).
  const [where, setWhere] = useState<Where | null>(null);
  const [home, setHome] = useState<string | null>(null);
  // 지역 고르기 세 칸(시·도 → 시·군·구 → 읍·면·동).
  const [pickSidoV, setPickSidoV] = useState("");
  const [pickSggV, setPickSggV] = useState("");
  const [dongOpts, setDongOpts] = useState<DongRow[] | null>(null);
  const sggOpts = useMemo(() => (pickSidoV ? sggChoices(pickSidoV) : []), [pickSidoV]);
  const canvas = useRef<Handle>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const listBox = useRef<HTMLOListElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const kindRef = useRef(kind);
  kindRef.current = kind;
  const reqId = useRef(0);

  useEffect(() => setToday(kstToday()), []);

  /** 핀 하나의 요약(지도 카드에 쓰는 것). 한 번 받으면 둔다. */
  const dongNRef = useRef<Map<string, number>>(new Map());
  const loadItems = useCallback(async (k: Kind, key: string): Promise<MapItem[]> => {
    if ((key.startsWith("dong|") || key.startsWith("office|")) && !dongNRef.current.get(key)) return [];
    const ik = itemKey(k, key);
    const have = itemsRef.current[ik];
    if (have) return have;
    try {
      const r = await fetch(`/api/map/items?kind=${k}&key=${encodeURIComponent(key)}`);
      const j = (await r.json()) as { items: MapItem[] };
      const got = Array.isArray(j.items) ? j.items : [];
      setItems((cur) => ({ ...cur, [ik]: got }));
      return got;
    } catch {
      return [];
    }
  }, []);

  // 처음 자리: 주소의 kind/lat/lng(상세 쪽 "주변 더 보기") → 저장해 둔 내 위치.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("kind") === "jobs") setKind("jobs");
    const lat = Number(sp.get("lat")), lng = Number(sp.get("lng"));
    if (lat && lng && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) { setMe([lat, lng]); setMeLabel("고른 자리"); return; }
    try {
      const s = JSON.parse(localStorage.getItem(GEO_KEY) ?? "null") as { pt?: LatLng; label?: string; home?: string } | null;
      if (s?.pt && s.pt.length === 2) {
        setMe(s.pt); setMeLabel(s.label ?? "내 위치");
        if (s.home) setHome(s.home);
        void learnWhere(s.pt, !s.home);
      }
    } catch { /* 저장소가 막힌 브라우저 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const programs = useMemo(() => fromRows("programs", data.p), [data.p]);
  const jobs = useMemo(() => fromRows("jobs", data.j), [data.j]);
  const points = kind === "jobs" ? jobs : programs;
  const rows = useMemo(() => {
    const withD = points.map((p) => ({ p, km: me ? haversineKm(me, [p.lat, p.lng]) : null }));
    const inR = me && radius > 0 ? withD.filter((x) => (x.km ?? 0) <= radius) : withD;
    return inR.sort((a, b) => (me ? (a.km ?? 0) - (b.km ?? 0) : b.p.n - a.p.n));
  }, [points, me, radius]);
  const kmOf = useMemo(() => new Map(rows.map((x) => [x.p.key, x.km])), [rows]);
  const pins = useMemo(() => {
    const out = rows.map(({ p, km }) => toPin(p, kind, km));
    // 반경을 작게(3km) 잡으면 내 시·군·구 핀(구역 가운데)이 반경 밖일 수 있다. 내 시·군·구는 늘 보인다.
    const hp = home ? points.find((p) => p.key === home) : undefined;
    if (hp && !out.some((x) => x.key === hp.key)) out.push(toPin(hp, kind, me ? haversineKm(me, [hp.lat, hp.lng]) : null));
    return out;
  }, [rows, kind, home, points, me]);
  const byKey = useMemo(() => new Map(points.map((p) => [p.key, p])), [points]);
  /** 동네 단계 핀: 읍·면·동 행정복지센터(없으면 동 가운데)와 시청·구청. */
  const dongPins = useMemo<Pin[]>(() => dongRows.map(([key, sido, sgg, gu, dong, lat, lng, hall, office, n]) => {
    const sp = byKey.get(`${sido}|${sgg}`);
    return {
      key, lat, lng, label: [SIDO_SHORT[sido] ?? sido, sgg, gu, dong].filter(Boolean).join(" "),
      short: office ? hall : dong, n, nW: 0, nB: 0, approx: false, kind, level: "dong", sido, sigungu: sgg,
      more: sp?.more ?? moreOf(kind, sido, sgg), km: me ? haversineKm(me, [lat, lng]) : null,
      hall: hall || null, dong, gu, office: office === 1, sggN: sp?.n ?? 0,
    };
  }), [dongRows, byKey, kind, me]);
  const dongN = useMemo(() => new Map(dongRows.map((r) => [r[0], r[9]])), [dongRows]);
  // 받아 둔 범위는 화면보다 조금 넓다. 세는 것은 화면 안의 센터만.
  const hallsInView = view && view.zoom >= DONG_ZOOM
    ? dongPins.filter((d) => !d.office && d.lat >= view.s && d.lat <= view.n && d.lng >= view.w && d.lng <= view.e).length
    : 0;

  // 가까이 확대하면(동네 단계) 보이는 범위의 행정복지센터를 받는다. 범위를 0.05도 격자로
  // 넓혀 반올림해, 조금 움직일 때마다 다시 받지 않는다.
  const onView = useCallback((v: View) => setView(v), []);
  useEffect(() => {
    if (!view || view.zoom < DONG_ZOOM) return;
    const g = 0.05;
    const box = [Math.floor(view.s / g) * g, Math.floor(view.w / g) * g, Math.ceil(view.n / g) * g, Math.ceil(view.e / g) * g]
      .map((x) => x.toFixed(2)).join(",");
    const want = `${kind}|${box}`;
    if (want === lastBox.current) return;
    const t = setTimeout(async () => {
      lastBox.current = want;
      try {
        const r = await fetch(`/api/map/dongs?kind=${kind}&bbox=${box}`);
        const j = (await r.json()) as { rows?: DongRow[] };
        if (lastBox.current === want) setDongRows(Array.isArray(j.rows) ? j.rows : []);
      } catch { /* 못 받으면 시·군·구 핀만 */ }
    }, 250);
    return () => clearTimeout(t);
  }, [view, kind]);
  const allN = (k: Kind) => (k === "jobs" ? data.j : data.p).reduce((a, r) => a + r[4], 0);
  const regionPoint = region ? points.find((p) => p.key === region) : undefined;
  const regionLabel = regionPoint?.label ?? "";
  const sortEff: Sort = me ? sort : "end";
  dongNRef.current = dongN;

  /** 카드 목록 받기. 자리(가까운 순)·상태·정렬이 바뀌면 처음부터, "더 보기"는 이어서. */
  const fetchList = useCallback(async (offset: number) => {
    const id = ++reqId.current;
    setLoading(true);
    const qs = new URLSearchParams({ kind, status, sort: sortEff, offset: String(offset), limit: String(PAGE) });
    if (region) qs.set("region", region);
    else if (me) {
      // 좌표는 소수 셋째 자리(약 100m)로 줄여 보낸다.
      qs.set("lat", me[0].toFixed(3)); qs.set("lng", me[1].toFixed(3)); qs.set("r", String(radius));
      if (home) qs.set("home", home);
    }
    try {
      const r = await fetch(`/api/map/list?${qs}`);
      const j = (await r.json()) as { total: number; items: ListItem[] };
      if (id !== reqId.current) return;
      setList((cur) => (offset ? { total: j.total, items: [...cur.items, ...j.items] } : j));
    } catch {
      if (id === reqId.current && !offset) setList({ total: 0, items: [] });
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [kind, status, sortEff, region, me, radius, home]);

  // 첫 그림은 서버가 넣어 준 전국 마감 임박 순(initial). 조건이 바뀌면 다시 받는다.
  const first = useRef(true);
  useEffect(() => {
    const untouched = !me && kind === "programs" && status === "all" && !region;
    if (first.current && initial && untouched) { first.current = false; return; }
    first.current = false;
    void fetchList(0);
    listBox.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, status, sortEff, region, me, radius, home]);

  const remember = (pt: LatLng, label: string, homeKey: string | null = null) => {
    try { localStorage.setItem(GEO_KEY, JSON.stringify({ pt, label, home: homeKey ?? undefined, at: Date.now() })); } catch { /* 저장 못 해도 화면은 된다 */ }
  };
  /** 좁은 화면에서는 지도가 도구줄 아래로 반쯤 가려져 있다. 고르기가 끝나면 지도를 화면 가운데로. */
  const showMap = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) mapBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  /** 이 자리가 어느 동 근처인지, 가장 가까운 행정복지센터는 어디인지. setHomeToo 면 내 시·군·구도 정한다. */
  async function learnWhere(pt: LatLng, setHomeToo = true) {
    try {
      const r = await fetch(`/api/map/where?lat=${pt[0].toFixed(3)}&lng=${pt[1].toFixed(3)}`);
      const j = (await r.json()) as Where;
      setWhere(j);
      if (setHomeToo && j.dong) setHome(`${j.dong.sido}|${j.dong.sgg}`);
    } catch { setWhere(null); }
  }
  const locateMe = () => {
    if (!("geolocation" in navigator)) { setGeoErr("이 브라우저는 위치를 지원하지 않습니다. 옆에서 지역을 골라 주세요."); return; }
    setBusy(true); setGeoErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt: LatLng = [+pos.coords.latitude.toFixed(4), +pos.coords.longitude.toFixed(4)];
        // 휴대폰 지도는 좁아 5km 원을 담으면 시·군·구 단계에 머문다. 3km 면 바로 읍·면·동까지 보인다.
        const r = window.matchMedia("(max-width: 639px)").matches ? 3 : 5;
        setMe(pt); setMeLabel("내 위치"); setBusy(false); setRegion(null); setSort("near"); setRadius(r);
        setHome(null); remember(pt, "내 위치"); void learnWhere(pt);
        showMap();
        track("map_locate", { ok: true });
      },
      (err) => {
        setBusy(false);
        setGeoErr(err.code === 1 ? "위치 권한이 꺼져 있습니다. 옆에서 지역을 골라도 됩니다." : "위치를 읽지 못했습니다. 옆에서 지역을 골라 주세요.");
        track("map_locate", { ok: false, code: err.code });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };
  /** 고른 자리로 옮긴다. 반경은 넓은 곳일수록 크게 — 읍·면·동이면 3km 라 지도가 동네 단계까지 가까워진다. */
  const goTo = (pt: LatLng, label: string, r: number, homeKey: string | null, how: string) => {
    setMe(pt); setMeLabel(label); setGeoErr(null); setRegion(null); setSort("near"); setRadius(r);
    setHome(homeKey); setWhere(null); remember(pt, label, homeKey);
    track("map_locate", { ok: true, how });
  };
  const pickSido = (s: string) => {
    setPickSidoV(s); setPickSggV(""); setDongOpts(null);
    const pt = SIDO_POINT[s];
    if (pt) goTo(pt, `${SIDO_SHORT[s]} 가운데`, 30, null, "sido");
  };
  const pickSgg = async (g: string) => {
    setPickSggV(g); setDongOpts(null);
    const at = locate(pickSidoV, g);
    if (!at || at.approx) return;
    goTo([at.lat, at.lng], `${SIDO_SHORT[pickSidoV]} ${g}`, 10, `${pickSidoV}|${g}`, "sgg");
    try {
      const r = await fetch(`/api/map/dongs?sido=${encodeURIComponent(pickSidoV)}&sgg=${encodeURIComponent(g)}`);
      const j = (await r.json()) as { rows?: DongRow[] };
      setDongOpts(Array.isArray(j.rows) ? j.rows.filter((x) => x[8] !== 1) : []);
    } catch { setDongOpts([]); }
  };
  const pickDong = (key: string) => {
    const d = dongOpts?.find((x) => x[0] === key);
    if (!d) return;
    const [, sido, sgg, gu, dong, lat, lng] = d;
    goTo([lat, lng], `${sgg}${gu ? " " + gu : ""} ${dong}`, 3, `${sido}|${sgg}`, "dong");
    showMap();
  };
  const clearMe = () => {
    setMe(null); setMeLabel(""); setRegion(null); setWhere(null); setHome(null);
    setPickSidoV(""); setPickSggV(""); setDongOpts(null);
    try { localStorage.removeItem(GEO_KEY); } catch { /* */ }
  };
  /** 카드 → 지도에서 그 자리. (지도가 곧 onSelect 를 부르는데, 카드에서 온 것이면 목록을 거르지 않는다.) */
  const fromCardAt = useRef(0);
  const focus = (key: string) => {
    setSel(key);
    fromCardAt.current = Date.now();
    canvas.current?.focus(key);
    showMap();
    track("map_point", { kind, from: "card" });
  };
  /** 지도의 핀 → 그 자리 카드만. */
  const onSelect = useCallback((key: string | null) => {
    setSel(key);
    if (!key || Date.now() - fromCardAt.current < 1500) return;
    // 동·청사 핀: 왼쪽 목록은 그 시·군·구의 공고로(동에는 공고를 꽂지 않는다).
    if (key.startsWith("dong|") || key.startsWith("office|")) {
      const [, sido, sgg] = key.split("|");
      setRegion(`${sido}|${sgg}`);
    } else setRegion(key);
    track("map_point", { kind: kindRef.current, from: key.startsWith("dong|") || key.startsWith("office|") ? "dong" : "pin" });
  }, []);

  return (
    <div>
      <div className="card mt-6 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="갈래" className="flex rounded-pill bg-ground p-1">
            {(["programs", "jobs"] as Kind[]).map((k) => (
              <button key={k} role="tab" type="button" aria-selected={kind === k}
                      onClick={() => { setKind(k); setSel(null); setRegion(null); }}
                      className={`rounded-pill px-3.5 py-1.5 text-[13.5px] font-bold transition-colors ${
                        kind === k ? "bg-brand text-white" : "text-muted hover:text-brand"}`}>
                {k === "programs" ? "지원사업" : "채용"} <span className="num ml-0.5 opacity-80">{allN(k).toLocaleString("ko-KR")}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={locateMe} disabled={busy} className="btn btn-primary px-3.5 py-1.5 text-[13.5px]">
            <svg viewBox="0 0 20 20" className="mr-1 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="10" cy="10" r="4" /><path d="M10 2v3M10 15v3M2 10h3M15 10h3" />
            </svg>
            {busy ? "위치 읽는 중…" : "내 위치로 보기"}
          </button>
          {/* 지역 고르기: 시·도 → 시·군·구 → 읍·면·동. 고를수록 지도가 가까워진다. */}
          {/* 휴대폰은 세 칸 한 줄. 아직 시·도를 안 골랐으면 한 칸뿐이라 넓게 — 좁으면 "지역 고르기"가 잘렸다. */}
          <div className={`grid w-full gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center ${pickSidoV ? "grid-cols-3" : "grid-cols-1"}`}
               role="group" aria-label="지역 고르기">
            <select value={pickSidoV} onChange={(e) => e.target.value && pickSido(e.target.value)} aria-label="시·도"
                    className="h-9 min-w-0 rounded-pill border border-line bg-surface px-3 text-[13.5px] text-ink2 outline-none focus:border-brand">
              <option value="">지역 고르기</option>
              {Object.keys(SIDO_POINT).map((s) => <option key={s} value={s}>{SIDO_SHORT[s]}</option>)}
            </select>
            {pickSidoV && sggOpts.length > 0 && (
              <select value={pickSggV} onChange={(e) => e.target.value && void pickSgg(e.target.value)} aria-label="시·군·구"
                      className="h-9 min-w-0 rounded-pill border border-line bg-surface px-3 text-[13.5px] text-ink2 outline-none focus:border-brand">
                <option value="">시·군·구</option>
                {sggOpts.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
            {pickSggV && dongOpts && dongOpts.length > 0 && (
              <select value="" onChange={(e) => e.target.value && pickDong(e.target.value)} aria-label="읍·면·동"
                      className="h-9 min-w-0 rounded-pill border border-line bg-surface px-3 text-[13.5px] text-ink2 outline-none focus:border-brand">
                <option value="">읍·면·동</option>
                {dongOpts.map((d) => <option key={d[0]} value={d[0]}>{d[3] ? `${d[3]} ${d[4]}` : d[4]}</option>)}
              </select>
            )}
          </div>
        </div>
        {me && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
            <span className="text-muted"><b className="text-ink2">{meLabel}</b> 기준</span>
            <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden" role="group" aria-label="반경">
              {RADII.map((r) => (
                <button key={r} type="button" onClick={() => { setRadius(r); setRegion(null); }} aria-pressed={radius === r}
                        className={`chip shrink-0 !py-1 !text-[12.5px] ${radius === r ? "chip-on" : ""}`}>
                  {r ? `${r}km` : "전체"}
                </button>
              ))}
            </div>
            {rows.length > 0 && <span className="num text-muted">시·군·구 {rows.length}곳</span>}
            {hallsInView > 0 && <span className="num text-muted">보이는 행정복지센터 {hallsInView}곳</span>}
            <button type="button" onClick={clearMe} className="text-muted underline underline-offset-4 hover:text-brand">위치 지우기</button>
          </div>
        )}
        {me && where && ((where.dong && meLabel === "내 위치") || (where.hall && where.hall.km >= 0.05)) && (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            {where.dong && meLabel === "내 위치" && <span><b className="text-ink2">{where.dong.label}</b> 근처</span>}
            {where.hall && where.hall.km >= 0.05 && (
              <span>
                가까운 행정복지센터 <b className="text-ink2">{where.hall.name}</b>{" "}
                <span className="num text-brand">{fmtKm(where.hall.km)}</span>
                <a href={mapLinks(`${where.hall.sgg} ${where.hall.name}`).kakao} target="_blank" rel="noopener noreferrer"
                   className="ml-2 font-semibold text-ink2 underline underline-offset-4 hover:text-brand">길찾기</a>
              </span>
            )}
          </p>
        )}
        {geoErr && <p className="mt-2 text-[13px] text-alert">{geoErr}</p>}
      </div>

      {/* 넓은 화면: 왼쪽 카드 목록(지도와 같은 높이, 안에서 스크롤) + 오른쪽 지도.
          좁은 화면: 지도 → 카드 목록. */}
      <div className="mt-3 lg:grid lg:grid-cols-[minmax(330px,390px)_1fr] lg:gap-4">
        <div className="lg:order-2">
          <div ref={mapBox} className="isolate overflow-hidden rounded-card border border-line bg-ground">
            <MapCanvas ref={canvas} pins={pins} kind={kind} me={me} meLabel={meLabel} radius={radius}
                       selected={sel} onSelect={onSelect} loadItems={loadItems} extra={dongPins} onView={onView}
                       className="h-[52vh] max-h-[520px] min-h-[320px] w-full lg:h-[680px] lg:max-h-none" />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
            <span><i className="pm-legend pm-legend-p" /> 지원사업 자리</span>
            <span><i className="pm-legend pm-legend-j" /> 채용 자리</span>
            <span className="flex items-center gap-1"><i className="pm-legend pm-legend-t1" /><i className="pm-legend pm-legend-t2" /><i className="pm-legend pm-legend-t3" /> 건수 많음·보통·적음</span>
            <span><i className="pm-legend pm-legend-d" /> 읍·면·동 행정복지센터·청사(가까이 확대)</span>
            <span>멀리서는 시·도, 가까이는 시·군·구, 더 가까이는 읍·면·동. 거리는 직선거리.</span>
            <span>동·센터 위치 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">OpenStreetMap</a> 기여자</span>
          </p>
        </div>

        <section aria-label="공고 카드" className="mt-5 lg:order-1 lg:mt-0 lg:flex lg:h-[680px] lg:flex-col lg:overflow-hidden lg:rounded-card lg:border lg:border-line lg:bg-surface">
          <div className="pb-2 lg:border-b lg:border-line lg:px-4 lg:pb-3 lg:pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[1.0625rem] font-bold">
                총 <span className="num text-brand">{list.total.toLocaleString("ko-KR")}</span>건
              </h2>
              <select value={sortEff} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬" disabled={!me}
                      className="h-8 rounded-pill border border-line bg-surface px-2.5 text-[12.5px] text-ink2 outline-none focus:border-brand disabled:opacity-60">
                <option value="near">가까운 순</option>
                <option value="end">마감 임박 순</option>
              </select>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="상태">
              {([["all", "전체"], ["soon", "7일 안 마감"], ["always", "상시"]] as [Status, string][]).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={status === v} onClick={() => setStatus(v)}
                        className={`pm-filter ${status === v ? `pm-filter-on pm-filter-${v}` : ""}`}>{l}</button>
              ))}
              {region && (
                <button type="button" onClick={() => { setRegion(null); setSel(null); }}
                        className="pm-filter pm-filter-on pm-filter-region" aria-label={`${regionLabel} 거르기 풀기`}>
                  {regionLabel}만 <span aria-hidden>×</span>
                </button>
              )}
            </div>
            {!me && <p className="mt-1.5 text-[12px] text-faint">전국 마감 임박 순입니다. 내 위치를 켜면 가까운 순으로 바뀝니다.</p>}
          </div>

          {list.items.length === 0 ? (
            <div className="card p-8 text-center text-[14px] text-muted lg:m-3">
              {loading ? "불러오는 중…" : me && radius ? "이 반경 안에는 없습니다. 반경을 넓히거나 상태를 '전체'로 바꿔 보세요." : "조건에 맞는 공고가 없습니다."}
            </div>
          ) : (
            <ol ref={listBox} className={`grid gap-2 lg:flex-1 lg:content-start lg:overflow-y-auto lg:p-3 ${loading ? "opacity-60" : ""}`}>
              {list.items.map((it) => {
                const st = statusOf(it, today || kstToday());
                const km = kmOf.get(it.key);
                return (
                  <li key={`${it.key}|${it.id}`}>
                    <div role="button" tabIndex={0} onClick={() => focus(it.key)}
                         onKeyDown={(e) => { if (e.key === "Enter") focus(it.key); }}
                         className={`pm-lcard ${sel === it.key ? "pm-lcard-on" : ""}`}>
                      <div className="flex items-start gap-2">
                        <svg viewBox="0 0 24 24" className={`mt-0.5 h-5 w-5 shrink-0 ${it.kind === "job" ? "text-[#0F766E]" : "text-[#E0242B]"}`} aria-hidden>
                          <path fill="currentColor" d="M12 2C7.6 2 4 5.5 4 9.9 4 15.6 12 22 12 22s8-6.4 8-12.1C20 5.5 16.4 2 12 2z" />
                          <circle cx="12" cy="9.8" r="3.1" fill="#fff" />
                        </svg>
                        <Link href={itemHref(it)} onClick={(e) => e.stopPropagation()}
                              className="min-w-0 flex-1 text-[14.5px] font-bold leading-snug text-ink hover:text-brand">
                          <span className="line-clamp-2">{it.t}</span>
                        </Link>
                        <span className={`pm-st ${st.cls}`}>{st.label}</span>
                      </div>
                      <dl className="pm-ldl">
                        <div><dt>{it.kind === "job" ? "기관" : "담당"}</dt><dd>{it.org ?? "—"}</dd></div>
                        <div><dt>지역</dt><dd>{it.label}{km != null && <b className="ml-1.5 text-brand">{fmtKm(km)}</b>}</dd></div>
                        <div><dt>{it.always || !it.end ? "접수" : "기간"}</dt>
                          <dd className="num">{it.always || !it.end ? "상시 접수" : `${it.start ? dot(it.start) : ""} ~ ${dot(it.end)}`}
                            <span className="ml-1.5 text-faint">{KIND_LABEL[it.kind]}</span></dd></div>
                      </dl>
                    </div>
                  </li>
                );
              })}
              {list.items.length < list.total && (
                <li>
                  <button type="button" disabled={loading} onClick={() => void fetchList(list.items.length)} className="btn btn-ghost w-full">
                    {loading ? "불러오는 중…" : <>더 보기 <span className="num ml-1 text-muted">{(list.total - list.items.length).toLocaleString("ko-KR")}건</span></>}
                  </button>
                </li>
              )}
            </ol>
          )}
          {regionPoint && (
            <div className="mt-2 px-1 text-[12.5px] lg:mt-0 lg:border-t lg:border-line lg:px-4 lg:py-2">
              <Link href={regionPoint.more} className="font-semibold text-brand">{regionLabel} 공고 모두 보기 →</Link>
              <a href={mapLinks(`${regionPoint.sigungu ?? regionLabel}청`).kakao} target="_blank" rel="noopener noreferrer"
                 className="ml-3 text-muted hover:text-brand">카카오맵 길찾기</a>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
