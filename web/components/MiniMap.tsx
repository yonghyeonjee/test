"use client";

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fmtKm, haversineKm, mapLinks, type LatLng } from "@/lib/geo";
import { track } from "./Gtm";

const GEO_KEY = "jw.geo.v1";
const TILE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * 상세 쪽에 붙는 작은 지도. 점 하나와 "내 위치에서 몇 km", 길찾기, 주변 더 보기.
 *
 * 좌표는 시·군·구 가운데다. 그래서 길찾기는 이름(예: "시흥시청", 기관명)으로
 * 지도 앱에 넘긴다 — 구역 가운데 좌표로 길을 찾으면 엉뚱한 곳에 데려다 준다.
 */
export default function MiniMap({
  lat, lng, label, approx, query, kind,
}: {
  lat: number; lng: number; label: string; approx: boolean;
  /** 지도 앱에서 찾을 이름. */
  query: string;
  kind: "programs" | "jobs";
}) {
  const el = useRef<HTMLDivElement>(null);
  const [km, setKm] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    let map: import("leaflet").Map | null = null;
    (async () => {
      const mod = await import("leaflet");
      const L = ((mod as unknown as { default?: typeof import("leaflet") }).default ?? mod) as typeof import("leaflet");
      if (dead || !el.current) return;
      map = L.map(el.current, {
        center: [lat, lng], zoom: approx ? 8 : 11, zoomControl: false, scrollWheelZoom: false,
        dragging: false, touchZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false,
      });
      L.tileLayer(TILE, { maxZoom: 18, attribution: ATTR }).addTo(map);
      if (approx) L.circle([lat, lng], { radius: 15000, color: "#5A4BE0", weight: 1, fillColor: "#5A4BE0", fillOpacity: 0.08, dashArray: "4 4" }).addTo(map);
      L.circleMarker([lat, lng], { radius: 9, color: "#fff", weight: 2, fillColor: kind === "jobs" ? "#0F766E" : "#5A4BE0", fillOpacity: 0.9 }).addTo(map);
    })();
    return () => { dead = true; map?.remove(); };
  }, [lat, lng, approx, kind]);

  // 정책지도에서 켜 둔 내 위치가 있으면 바로 거리를 적는다.
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(GEO_KEY) ?? "null") as { pt?: LatLng } | null;
      if (s?.pt && s.pt.length === 2) setKm(haversineKm(s.pt, [lat, lng]));
    } catch { /* */ }
  }, [lat, lng]);

  const locate = () => {
    if (!("geolocation" in navigator)) { setErr("이 브라우저는 위치를 지원하지 않습니다."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt: LatLng = [+pos.coords.latitude.toFixed(4), +pos.coords.longitude.toFixed(4)];
        setKm(haversineKm(pt, [lat, lng])); setErr(null);
        try { localStorage.setItem(GEO_KEY, JSON.stringify({ pt, label: "내 위치", at: Date.now() })); } catch { /* */ }
        track("map_locate", { ok: true, where: "mini" });
      },
      (e) => { setErr(e.code === 1 ? "위치 권한이 꺼져 있습니다." : "위치를 읽지 못했습니다."); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };
  const links = mapLinks(query);

  return (
    <div className="card overflow-hidden">
      <div ref={el} className="h-44 w-full bg-ground" aria-hidden />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-[13px]">
        <b className="text-[14px]">{label}</b>
        {approx && <span className="text-faint">시·도 가운데 기준</span>}
        {km !== null ? (
          <span className="num text-ink2">내 위치에서 <b>{fmtKm(km)}</b> <span className="text-faint">(직선)</span></span>
        ) : (
          <button type="button" onClick={locate} className="font-semibold text-brand underline underline-offset-4">내 위치에서 거리 보기</button>
        )}
        {err && <span className="text-alert">{err}</span>}
        <span className="ml-auto flex flex-wrap gap-1.5">
          <a href={links.kakao} target="_blank" rel="noopener noreferrer" className="chip !py-0.5 !text-[12px]">카카오맵</a>
          <a href={links.naver} target="_blank" rel="noopener noreferrer" className="chip !py-0.5 !text-[12px]">네이버지도</a>
          <Link href={`/map?kind=${kind}&lat=${lat}&lng=${lng}`} className="chip !py-0.5 !text-[12px]">주변 더 보기</Link>
        </span>
      </div>
    </div>
  );
}
