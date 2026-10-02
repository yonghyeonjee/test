"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SIDO_SHORT } from "@/lib/geo";
import { SIDO_POINT } from "@/lib/geoData";
import type { Pin } from "./map/pins";

// 지도 엔진(카카오·네이버·Leaflet)은 보일 때 받는다. 첫 화면 JS 에 얹지 않는다.
const MapCanvas = dynamic(() => import("./map/MapCanvas"), { ssr: false });

const GEO_KEY = "jw.geo.v1";
const noop = () => {};
const none = async () => [];

/**
 * 첫 화면의 정책지도 미리보기. 시·도마다 복지 지원 사업 수(첫 화면 "우리 동네 지원금"과 같은 수)를 핀으로 놓는다.
 *
 *  - 휴대폰은 본문(롤링 띠 아래), 넓은 화면은 오른쪽 기둥 맨 위에 둔다.
 *  - 화면에 들어올 때 지도를 불러온다. 지도는 움직이지 않고, 누르면 정책지도로 간다.
 *  - 정책지도에서 켜 둔 내 위치가 있으면 단추가 "○○ 주변 보기"가 된다(정책지도가 그 자리로 열린다).
 */
export default function HomeMap({ areas, total, className = "" }: {
  areas: { sido: string; n: number }[];
  total: number;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [mine, setMine] = useState<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setShow(true); return; }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { setShow(true); io.disconnect(); }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(GEO_KEY) ?? "null") as { pt?: unknown; label?: string } | null;
      // "경기 가운데"(시·도만 고른 것)는 "경기"로, 상세 쪽에서 넘어온 "고른 자리"는 "내 위치"로.
      if (s?.pt) setMine(s.label && s.label !== "고른 자리" ? s.label.replace(/ 가운데$/, "") : "내 위치");
    } catch { /* 저장소가 막힌 브라우저 */ }
  }, []);

  // 시·도 가운데마다 핀 하나. 지도가 전국을 담으면(멀리서) 엔진이 시·도 핀으로 그린다.
  const pins = useMemo<Pin[]>(() => areas.filter((a) => a.n > 0 && SIDO_POINT[a.sido]).map((a) => ({
    key: a.sido, lat: SIDO_POINT[a.sido][0], lng: SIDO_POINT[a.sido][1], label: SIDO_SHORT[a.sido] ?? a.sido,
    short: SIDO_SHORT[a.sido] ?? a.sido, n: a.n, nW: a.n, nB: 0, approx: true, kind: "programs", level: "sgg",
    sido: a.sido, sigungu: null, more: "/map", km: null,
  })), [areas]);

  return (
    <section aria-label="정책지도 미리보기" className={`card overflow-hidden ${className}`}>
      <div className="flex items-baseline gap-2 px-4 pb-2.5 pt-3.5">
        <h2 className="text-[15px] font-extrabold tracking-[-.02em]">정책지도</h2>
        <span className="num min-w-0 flex-1 truncate text-[12px] text-faint">시·도별 복지 지원 {total.toLocaleString("ko-KR")}건</span>
        <Link href="/map" className="-my-1.5 shrink-0 py-1.5 text-[12.5px] font-semibold text-muted hover:text-ink">전체 지도</Link>
      </div>
      <div ref={box} className="relative h-[210px] bg-[#E9EEF2] lg:h-[280px]">
        {show && (
          <MapCanvas pins={pins} kind="programs" me={null} meLabel="" radius={0} selected={null}
                     onSelect={noop} loadItems={none} interactive={false} overview className="pm-ov h-full w-full" />
        )}
        {/* 지도 전체가 정책지도로 가는 단추. 핀을 눌러도 같은 곳으로 간다. */}
        <Link href="/map" aria-label="정책지도 열기" className="absolute inset-0 z-[1000]" />
      </div>
      <div className="px-4 py-3">
        <Link href="/map" className="btn btn-primary w-full !py-2.5 text-[14px]">
          {mine ? `${mine} 주변 보기` : "내 주변 지원금 지도로 보기"}
        </Link>
        <p className="mt-2 hidden text-center text-[12px] text-faint lg:block">가까이 확대하면 읍·면·동 행정복지센터까지 보입니다</p>
      </div>
    </section>
  );
}
