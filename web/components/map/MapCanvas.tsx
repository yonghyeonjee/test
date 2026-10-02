"use client";

import { forwardRef } from "react";
import { KAKAO_KEY } from "./kakao";
import KakaoEngine from "./KakaoEngine";
import LeafletEngine, { type EngineProps, type Handle } from "./LeafletEngine";

/**
 * 지도 한 장. 카카오맵 키(NEXT_PUBLIC_KAKAO_MAP_KEY)가 있으면 카카오맵, 없으면
 * Leaflet(OpenStreetMap·CARTO 타일). 핀·카드·내 위치는 두 쪽이 같은 HTML 을 쓴다.
 */
const MapCanvas = forwardRef<Handle, EngineProps>(function MapCanvas(props, ref) {
  return KAKAO_KEY ? <KakaoEngine ref={ref} {...props} /> : <LeafletEngine ref={ref} {...props} />;
});

export default MapCanvas;
export type { EngineProps, Handle };
