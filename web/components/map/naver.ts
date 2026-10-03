/**
 * 네이버 지도 JavaScript API v3(Web Dynamic Map)를 쓰기 위한 최소 틀.
 *
 * 네이버 클라우드 플랫폼 콘솔 > Maps > Application 등록에서 Web Dynamic Map 을
 * 켜고, Web 서비스 URL 에 사이트 주소를 넣은 뒤 받은 Client ID(키 ID)를
 * NEXT_PUBLIC_NAVER_MAP_KEY 로 넣는다. 등록한 주소에서만 먹는 키라 공개돼도 된다.
 * 대표 계정은 Web Dynamic Map 이 월 1,000만 건까지 무료(2026년 기준, 지도를 처음
 * 띄울 때만 1건). 카카오 키가 있으면 카카오가 먼저다(components/map/MapCanvas).
 */
export type NLatLng = { lat(): number; lng(): number };
export type NPoint = { x: number; y: number };
export type NMap = {
  getProjection(): { fromCoordToOffset(c: NLatLng): NPoint };
  getZoom(): number;
  setZoom(z: number, effect?: boolean): void;
  setCenter(c: NLatLng): void;
  getCenter(): NLatLng;
  panTo(c: NLatLng): void;
  fitBounds(b: unknown, margin?: { top?: number; right?: number; bottom?: number; left?: number }): void;
  getSize(): { width: number; height: number };
  getBounds(): { getSW(): NLatLng; getNE(): NLatLng };
  setOptions(o: { draggable?: boolean }): void;
};
export type NMarker = { setMap(m: NMap | null): void };
export type NCircle = { setMap(m: NMap | null): void };

export type NaverMaps = {
  LatLng: new (lat: number, lng: number) => NLatLng;
  LatLngBounds: new (sw: NLatLng, ne: NLatLng) => unknown;
  Point: new (x: number, y: number) => NPoint;
  Map: new (el: HTMLElement, opts: {
    center: NLatLng; zoom: number; minZoom?: number; zoomControl?: boolean; zoomControlOptions?: { position: unknown };
    draggable?: boolean; scrollWheel?: boolean; pinchZoom?: boolean; disableDoubleClickZoom?: boolean; keyboardShortcuts?: boolean;
    mapDataControl?: boolean; scaleControl?: boolean; logoControl?: boolean;
  }) => NMap;
  Marker: new (opts: {
    position: NLatLng; map?: NMap; zIndex?: number; clickable?: boolean;
    icon: { content: string | HTMLElement; anchor?: NPoint };
  }) => NMarker;
  Circle: new (opts: {
    map?: NMap; center: NLatLng; radius: number; strokeColor?: string; strokeOpacity?: number; strokeWeight?: number;
    strokeStyle?: string; fillColor?: string; fillOpacity?: number; clickable?: boolean;
  }) => NCircle;
  Position: { RIGHT_CENTER: unknown; TOP_RIGHT: unknown };
  Event: { addListener(target: unknown, type: string, cb: () => void): unknown };
};

declare global {
  interface Window { naver?: { maps: NaverMaps } }
}

export const NAVER_KEY = process.env.NEXT_PUBLIC_NAVER_MAP_KEY ?? "";

let loading: Promise<NaverMaps> | null = null;

export function loadNaver(key: string): Promise<NaverMaps> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.naver?.maps?.Map) return Promise.resolve(window.naver.maps);
  if (!loading) {
    loading = new Promise<NaverMaps>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}`;
      s.async = true;
      s.onload = () => {
        const n = window.naver?.maps;
        if (n?.Map) resolve(n); else reject(new Error("naver.maps 없음 — 키나 Web 서비스 URL 을 확인해 주세요."));
      };
      s.onerror = () => { loading = null; reject(new Error("네이버 지도 스크립트를 못 불러왔습니다.")); };
      document.head.appendChild(s);
    });
  }
  return loading;
}
