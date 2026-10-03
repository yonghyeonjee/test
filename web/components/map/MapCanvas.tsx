"use client";

import { forwardRef, useState } from "react";
import { KAKAO_KEY } from "./kakao";
import KakaoEngine from "./KakaoEngine";
import LeafletEngine, { type EngineProps, type Handle } from "./LeafletEngine";
import { NAVER_KEY } from "./naver";
import NaverEngine from "./NaverEngine";

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
  if (KAKAO_KEY && !failed) {
    return <KakaoEngine ref={ref} {...props} onFail={() => { kakaoFailed = true; setFailed(true); }} />;
  }
  if (NAVER_KEY) return <NaverEngine ref={ref} {...props} />;
  return <LeafletEngine ref={ref} {...props} />;
});

export default MapCanvas;
export type { EngineProps, Handle };
