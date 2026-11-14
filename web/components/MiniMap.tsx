"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtKm, haversineKm, mapLinks, type LatLng } from "@/lib/geo";
import MapCanvas from "./map/MapCanvas";
import type { Pin } from "./map/pins";
import { track } from "./Gtm";

const GEO_KEY = "jw.geo.v1";

/**
 * 상세 쪽에 붙는 작은 지도. 핀 하나와 "내 위치에서 몇 km", 길찾기, 주변 더 보기.
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
  const [km, setKm] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // 지도는 화면에 들어올 때 그린다(2026-10-21). 상세 쪽마다 지도 SDK 와 타일 500KB 를 바로 받던 것을 미룬다.
  // IntersectionObserver 가 없는 옛 브라우저는 바로 그린다.
  const box = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") { setShow(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setShow(true); io.disconnect(); } },
                                        { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const pins = useMemo<Pin[]>(() => [{
    key: "here", lat, lng, label, short: label, n: 0, nW: 0, nB: 0, approx, kind, level: "sgg", sido: "", sigungu: null, more: "", km: null,
  }], [lat, lng, label, approx, kind]);

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
  const more = `/map?kind=${kind}&lat=${lat}&lng=${lng}`;

  return (
    <div className="card overflow-hidden" ref={box}>
      {/* 지도는 미리보기 그림으로만 둔다(2026-11-15). 조작을 꺼도 지도 SDK 가 터치를 가로채
          휴대폰에서 지도 위에 손가락이 닿으면 쪽 스크롤이 멈췄다. 홈 지도(HomeMap)처럼 지도 전체를
          덮는 링크를 올려 터치는 쪽 스크롤로 가고, 누르면 정책지도에서 크게 본다. */}
      <div className="relative isolate h-44 w-full bg-ground">
        {show && (
          <MapCanvas pins={pins} kind={kind} me={null} meLabel="" radius={0} selected={null} onSelect={() => {}}
                     loadItems={async () => []} interactive={false} className="h-full w-full" />
        )}
        <Link href={more} aria-label={`${label} 주변 지도 크게 보기`} className="absolute inset-0 z-[1000]"
              onClick={() => track("map_open", { where: "mini" })}>
          <span className="absolute bottom-2 right-2 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-semibold text-ink2 shadow-sm">
            지도 크게 보기
          </span>
        </Link>
      </div>
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
          <Link href={more} className="chip !py-0.5 !text-[12px]">주변 더 보기</Link>
        </span>
      </div>
    </div>
  );
}
