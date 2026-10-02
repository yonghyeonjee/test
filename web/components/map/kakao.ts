/**
 * 카카오맵 JavaScript SDK 를 쓰기 위한 최소 틀.
 *
 * 시흥시 돌봄지도(childfirst.siheung.go.kr)가 쓰는 그 지도다. JavaScript 키가
 * 있어야 한다 — 카카오 디벨로퍼스에서 앱을 만들고 플랫폼 > Web 에 사이트 주소를
 * 등록한 뒤, 그 앱의 JavaScript 키를 NEXT_PUBLIC_KAKAO_MAP_KEY 로 넣는다.
 * (JavaScript 키는 등록한 도메인에서만 먹어 공개돼도 된다.) 키가 없으면 지도는
 * Leaflet(OpenStreetMap) 로 그린다.
 */
export type KLatLng = { getLat(): number; getLng(): number };
export type KBounds = { extend(p: KLatLng): void };
export type KPoint = { x: number; y: number };
export type KMap = {
  getProjection(): { containerPointFromCoords(p: KLatLng): KPoint };
  setCenter(p: KLatLng): void;
  getCenter(): KLatLng;
  setLevel(level: number, opts?: { animate?: boolean; anchor?: KLatLng }): void;
  getLevel(): number;
  setBounds(b: KBounds): void;
  panTo(p: KLatLng): void;
  relayout(): void;
  addControl(control: unknown, position: unknown): void;
};
export type KOverlay = { setMap(m: KMap | null): void; setZIndex(z: number): void; getPosition(): KLatLng };
export type KCircle = { setMap(m: KMap | null): void };

export type KakaoMaps = {
  load(cb: () => void): void;
  LatLng: new (lat: number, lng: number) => KLatLng;
  LatLngBounds: new (sw?: KLatLng, ne?: KLatLng) => KBounds;
  Map: new (el: HTMLElement, opts: {
    center: KLatLng; level: number; draggable?: boolean; scrollwheel?: boolean;
    disableDoubleClickZoom?: boolean; disableDoubleClick?: boolean;
  }) => KMap;
  CustomOverlay: new (opts: {
    position: KLatLng; content: string | HTMLElement; xAnchor?: number; yAnchor?: number; zIndex?: number; clickable?: boolean; map?: KMap;
  }) => KOverlay;
  Circle: new (opts: {
    center: KLatLng; radius: number; strokeWeight?: number; strokeColor?: string; strokeOpacity?: number;
    strokeStyle?: string; fillColor?: string; fillOpacity?: number;
  }) => KCircle;
  ZoomControl: new () => unknown;
  ControlPosition: { RIGHT: unknown; TOPRIGHT: unknown; BOTTOMRIGHT: unknown };
  event: { addListener(target: unknown, type: string, cb: () => void): void };
};

declare global {
  interface Window { kakao?: { maps: KakaoMaps } }
}

export const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";

let loading: Promise<KakaoMaps> | null = null;

/** SDK 를 한 번만 끼워 넣고, 준비되면 kakao.maps 를 돌려준다. */
export function loadKakao(key: string): Promise<KakaoMaps> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.kakao?.maps?.Map) return Promise.resolve(window.kakao.maps);
  if (!loading) {
    loading = new Promise<KakaoMaps>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
      s.async = true;
      s.onload = () => {
        const k = window.kakao?.maps;
        if (!k) { reject(new Error("kakao.maps 없음")); return; }
        k.load(() => resolve(k));
      };
      s.onerror = () => { loading = null; reject(new Error("카카오맵 SDK 를 못 불러왔습니다.")); };
      document.head.appendChild(s);
    });
  }
  return loading;
}
