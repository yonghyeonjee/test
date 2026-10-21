"use client";

import { Suspense, forwardRef, lazy, useState } from "react";
import { KAKAO_KEY } from "./kakao";
import type { EngineProps, Handle } from "./LeafletEngine";
import { NAVER_KEY } from "./naver";

// 엔진 셋을 따로 받는다(2026-10-21). 전에는 셋 다 상세 쪽 묶음에 들어가 Leaflet 까지 매 상세 쪽이 받았다.
// next/dynamic 은 ref 를 안 넘기므로(함수 컴포넌트로 감싼다) React.lazy 를 쓴다 — forwardRef 로 그대로 간다.
const KakaoEngine = lazy(() => import("./KakaoEngine"));
const NaverEngine = lazy(() => import("./NaverEngine"));
const LeafletEngine = lazy(() => import("./LeafletEngine"));

/**
 * 지도 한 장. 넣어 둔 키에 따라 고른다.
 *  1. NEXT_PUBLIC_KAKAO_MAP_KEY → 카카오맵 (시흥 돌봄지도와 같은 기술)
 *  2. NEXT_PUBLIC_NAVER_MAP_KEY → 네이버 지도
 *  3. 없으면 Leaflet — 바탕은 브이월드(NEXT_PUBLIC_VWORLD_KEY) 또는 OpenStreetMap
 * 핀·카드·내 위치는 세 쪽이 같은 HTML·CSS 를 쓴다(./pins.ts).
 * 카카오맵이 뜨지 않으면(도메인 미등록, 사용 설정 꺼짐, 느린 응답) 그 자리에서 Leaflet 으로 바꾼다.
 */
let kakaoFailed = false;

const MapCanvas = forwardRef<Handle, EngineProps>(function MapCanvas(props, ref) {
  const [failed, setFailed] = useState(kakaoFailed);
  const engine = KAKAO_KEY && !failed
    ? <KakaoEngine ref={ref} {...props} onFail={() => { kakaoFailed = true; setFailed(true); }} />
    : NAVER_KEY ? <NaverEngine ref={ref} {...props} /> : <LeafletEngine ref={ref} {...props} />;
  // 받는 동안 지도 자리는 같은 크기의 빈 칸 — 자리가 흔들리지 않게.
  return <Suspense fallback={<div className={props.className} />}>{engine}</Suspense>;
});

export default MapCanvas;
export type { EngineProps, Handle };
