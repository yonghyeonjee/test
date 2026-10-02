"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SIDO_POINT } from "@/lib/geoData";
import { SIDO_SHORT, fmtKm, haversineKm, mapLinks, type LatLng } from "@/lib/geo";
import type { MapDataLite, MapItem } from "@/lib/mapData";
import MapCanvas, { type Handle } from "./map/MapCanvas";
import { itemHref, itemWhen, toPin, type Kind } from "./map/pins";
import { track } from "./Gtm";

const RADII = [10, 30, 50, 100, 0];
export const GEO_KEY = "jw.geo.v1";
const itemKey = (kind: Kind, key: string) => `${kind}|${key}`;

/**
 * 정책지도.
 *
 * 시·군·구마다 핀 하나(접수 중인 지원사업 / 채용). 멀리서는 시·도 묶음, 가까이
 * 가면 이름과 건수가 적힌 핀. 핀을 누르면 카드(요약·거리·길찾기·상세보기).
 * "내 위치로 보기"를 누르면 가까운 순으로 늘어놓고 반경으로 거른다. 위치 권한이
 * 없으면 시·도를 골라도 된다.
 *
 * 쪽에는 핀(이름·좌표·건수)만 싣고, 요약(제목 몇 건)은 핀을 누르거나 목록을 펼칠
 * 때 /api/map/items 에서 받는다 — 전부 실으면 HTML 이 400KB 를 넘는다.
 * 목록은 서버에서 그려진다(검색엔진·느린 회선). 주소의 ?kind= ?lat= ?lng= 는
 * 붙은 뒤에 읽는다 — useSearchParams 를 쓰면 정적 쪽이 클라이언트 렌더로 바뀐다.
 *
 * 지도 자체는 components/map/MapCanvas — 카카오맵 키가 있으면 카카오맵, 없으면 Leaflet.
 */
export default function PolicyMap({ data, initialKind = "programs" }: { data: MapDataLite; initialKind?: Kind }) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [me, setMe] = useState<LatLng | null>(null);
  const [meLabel, setMeLabel] = useState("");
  const [radius, setRadius] = useState(30);
  const [sel, setSel] = useState<string | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(20);
  const [items, setItems] = useState<Record<string, MapItem[]>>({});
  const canvas = useRef<Handle>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  /** 핀 하나의 요약을 받는다. 한 번 받으면 둔다. */
  const loadItems = useCallback(async (k: Kind, key: string): Promise<MapItem[]> => {
    const ik = itemKey(k, key);
    const have = itemsRef.current[ik];
    if (have) return have;
    try {
      const r = await fetch(`/api/map/items?kind=${k}&key=${encodeURIComponent(key)}`);
      const j = (await r.json()) as { items: MapItem[] };
      const list = Array.isArray(j.items) ? j.items : [];
      setItems((cur) => ({ ...cur, [ik]: list }));
      return list;
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
      const s = JSON.parse(localStorage.getItem(GEO_KEY) ?? "null") as { pt?: LatLng; label?: string } | null;
      if (s?.pt && s.pt.length === 2) { setMe(s.pt); setMeLabel(s.label ?? "내 위치"); }
    } catch { /* 저장소가 막힌 브라우저 */ }
  }, []);

  const points = data[kind];
  const rows = useMemo(() => {
    const withD = points.map((p) => ({ p, km: me ? haversineKm(me, [p.lat, p.lng]) : null }));
    const inR = me && radius > 0 ? withD.filter((x) => (x.km ?? 0) <= radius) : withD;
    return inR.sort((a, b) => (me ? (a.km ?? 0) - (b.km ?? 0) : b.p.n - a.p.n));
  }, [points, me, radius]);
  const pins = useMemo(() => rows.map(({ p, km }) => toPin(p, kind, km)), [rows, kind]);
  const totalN = useMemo(() => rows.reduce((a, x) => a + x.p.n, 0), [rows]);
  const allN = (k: Kind) => data[k].reduce((a, p) => a + p.n, 0);

  const remember = (pt: LatLng, label: string) => {
    try { localStorage.setItem(GEO_KEY, JSON.stringify({ pt, label, at: Date.now() })); } catch { /* 저장 못 해도 화면은 된다 */ }
  };
  const locateMe = () => {
    if (!("geolocation" in navigator)) { setGeoErr("이 브라우저는 위치를 지원하지 않습니다. 아래에서 지역을 골라 주세요."); return; }
    setBusy(true); setGeoErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt: LatLng = [+pos.coords.latitude.toFixed(4), +pos.coords.longitude.toFixed(4)];
        setMe(pt); setMeLabel("내 위치"); setBusy(false); remember(pt, "내 위치");
        track("map_locate", { ok: true });
      },
      (err) => {
        setBusy(false);
        setGeoErr(err.code === 1 ? "위치 권한이 꺼져 있습니다. 아래에서 지역을 골라도 됩니다." : "위치를 읽지 못했습니다. 아래에서 지역을 골라 주세요.");
        track("map_locate", { ok: false, code: err.code });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };
  const pickSido = (s: string) => {
    const pt = SIDO_POINT[s];
    if (!pt) return;
    const label = `${SIDO_SHORT[s]} 가운데`;
    setMe(pt); setMeLabel(label); setGeoErr(null); remember(pt, label);
    track("map_locate", { ok: true, how: "sido" });
  };
  const clearMe = () => { setMe(null); setMeLabel(""); try { localStorage.removeItem(GEO_KEY); } catch { /* */ } };
  const focus = (key: string) => {
    setSel(key);
    canvas.current?.focus(key);
    mapBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    track("map_point", { kind, from: "list" });
  };
  const onSelect = useCallback((key: string | null) => { setSel(key); if (key) track("map_point", { kind: kindRef.current, from: "pin" }); }, []);
  const kindRef = useRef(kind);
  kindRef.current = kind;

  return (
    <div>
      <div className="card mt-6 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="갈래" className="flex rounded-pill bg-ground p-1">
            {(["programs", "jobs"] as Kind[]).map((k) => (
              <button key={k} role="tab" type="button" aria-selected={kind === k}
                      onClick={() => { setKind(k); setSel(null); setShown(20); }}
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
          <select value="" onChange={(e) => e.target.value && pickSido(e.target.value)} aria-label="지역 고르기"
                  className="h-9 rounded-pill border border-line bg-surface px-3 text-[13.5px] text-ink2 outline-none focus:border-brand">
            <option value="">또는 지역 고르기</option>
            {Object.keys(SIDO_POINT).map((s) => <option key={s} value={s}>{SIDO_SHORT[s]}</option>)}
          </select>
        </div>
        {me && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
            <span className="text-muted"><b className="text-ink2">{meLabel}</b> 기준</span>
            <div className="flex flex-wrap gap-1" role="group" aria-label="반경">
              {RADII.map((r) => (
                <button key={r} type="button" onClick={() => { setRadius(r); setShown(20); }} aria-pressed={radius === r}
                        className={`chip !py-1 !text-[12.5px] ${radius === r ? "chip-on" : ""}`}>
                  {r ? `${r}km` : "전체"}
                </button>
              ))}
            </div>
            <span className="num text-muted">{rows.length}곳 · {totalN.toLocaleString("ko-KR")}건</span>
            <button type="button" onClick={clearMe} className="text-muted underline underline-offset-4 hover:text-brand">위치 지우기</button>
          </div>
        )}
        {geoErr && <p className="mt-2 text-[13px] text-alert">{geoErr}</p>}
        <p className="mt-2 text-[12.5px] leading-relaxed text-faint">
          점은 시·군·구마다 하나, 크기는 지금 접수 중인 건수입니다. 거리는 시·군·구 가운데 기준 직선거리라
          청사까지의 길 거리와 다릅니다. 흐린 점은 시·군·구를 몰라 시·도 가운데에 둔 것.
        </p>
      </div>

      <div ref={mapBox} className="mt-3 overflow-hidden rounded-card border border-line bg-ground">
        <MapCanvas ref={canvas} pins={pins} kind={kind} me={me} meLabel={meLabel} radius={radius}
                   selected={sel} onSelect={onSelect} loadItems={loadItems}
                   className="h-[62vh] min-h-[380px] w-full" />
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
        <span><i className="pm-legend pm-legend-p" /> 지원사업</span>
        <span><i className="pm-legend pm-legend-j" /> 채용</span>
        <span><i className="pm-legend pm-legend-a" /> 시·군·구 미표기(시·도 가운데)</span>
        <span>멀리서는 시·도 묶음, 가까이 가면 시·군·구 핀. 핀을 누르면 요약 카드.</span>
      </p>

      <div className="mb-3 mt-6 flex items-baseline justify-between">
        <h2 className="text-[1.0625rem] font-bold">
          {me ? `${meLabel}에서 가까운 순` : kind === "jobs" ? "채용이 많은 곳부터" : "지원사업이 많은 곳부터"}
        </h2>
        <span className="num text-sm text-muted">{rows.length}곳 · {totalN.toLocaleString("ko-KR")}건</span>
      </div>
      {rows.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          {me ? "이 반경 안에는 없습니다. 반경을 넓혀 보세요." : "아직 지도에 올릴 공고를 받아오지 못했습니다."}
        </div>
      ) : (
        <ol className="grid gap-2.5">
          {rows.slice(0, shown).map(({ p, km }) => {
            const links = mapLinks(`${p.sigungu ?? p.sido}청`);
            const list = items[itemKey(kind, p.key)];
            return (
              <li key={p.key} className={`card transition-colors ${sel === p.key ? "border-brand" : ""}`}>
                {/* 누르면 요약(제목 몇 건)이 펼쳐진다. 펼칠 때 받아 온다. */}
                <details className="group" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) void loadItems(kind, p.key); }}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                    <span className="text-[15px] font-bold group-open:text-brand">
                      {p.label}
                      {p.approx && <span className="ml-1.5 text-[12px] font-normal text-faint">시·도 가운데</span>}
                    </span>
                    <span className="num text-[12.5px] text-muted">
                      {km !== null && <b className="mr-2 text-ink2">{fmtKm(km)}</b>}
                      {kind === "jobs" ? `채용 ${p.n}` : `복지 ${p.nW} · 기업 ${p.nB}`}
                      <span className="ml-2 text-faint" aria-hidden>▾</span>
                    </span>
                  </summary>
                  <div className="border-t border-line px-4 pb-4 pt-3">
                    {list === undefined ? (
                      <p className="text-[13px] text-faint">불러오는 중…</p>
                    ) : list.length === 0 ? (
                      <p className="text-[13px] text-faint">요약을 못 받았습니다. 모두 보기로 가 주세요.</p>
                    ) : (
                      <ul className="grid gap-1 text-[13.5px]">
                        {list.slice(0, 5).map((it) => (
                          <li key={it.id} className="flex justify-between gap-3">
                            <Link href={itemHref(it)} className="min-w-0 truncate hover:text-brand">{it.t}</Link>
                            <span className="num shrink-0 text-[12px] text-faint">{itemWhen(it)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
                      <Link href={p.more} className="font-semibold text-brand">{p.n}건 모두 보기 →</Link>
                      <button type="button" onClick={() => focus(p.key)} className="text-muted hover:text-brand">지도에서 보기</button>
                      <a href={links.kakao} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-brand">카카오맵 길찾기</a>
                      <a href={links.naver} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-brand">네이버지도</a>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      )}
      {rows.length > shown && (
        <button type="button" onClick={() => setShown((s) => s + 20)} className="btn btn-ghost mt-4 w-full">
          더 보기 <span className="num ml-1 text-muted">{rows.length - shown}곳</span>
        </button>
      )}
    </div>
  );
}
