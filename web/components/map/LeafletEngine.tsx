"use client";

import "leaflet/dist/leaflet.css";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";
import type { MapItem } from "@/lib/mapData";
import { KOREA_BOX, OV_K, cardHtml, cardLift, drawnPins, pickLabels, pinHtml, tierOfZoom, visiblePins, type Kind, type Pin, type Pos, type Tier, type View } from "./pins";

type Leaflet = typeof import("leaflet");
const KOREA: LatLng = [36.2, 127.9];

/**
 * 바탕 지도. 국토교통부 브이월드 키(NEXT_PUBLIC_VWORLD_KEY)가 있으면 브이월드 기본도,
 * 없으면 OpenStreetMap. (CARTO 래스터 타일은 2026년 9월부터 키 없이 부르면
 * "API KEY REQUIRED" 워터마크가 찍혀 쓰지 않는다.)
 */
const VWORLD_KEY = process.env.NEXT_PUBLIC_VWORLD_KEY ?? "";
const TILE = VWORLD_KEY
  ? { url: `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Base/{z}/{y}/{x}.png`, attr: '&copy; <a href="https://www.vworld.kr">국토교통부 브이월드</a>', min: 6, max: 19 }
  : { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', min: 0, max: 18 };

export type Handle = { focus(key: string): void };
export type EngineProps = {
  pins: Pin[];
  kind: Kind;
  me: LatLng | null;
  meLabel: string;
  /** km. 0 이면 반경 없음. */
  radius: number;
  selected: string | null;
  onSelect: (key: string | null) => void;
  loadItems: (kind: Kind, key: string) => Promise<MapItem[]>;
  /** false 면 끌기·확대·카드 없이 보기만(상세 쪽 작은 지도). */
  interactive?: boolean;
  className?: string;
  /** 동네 단계(가까이 확대)에서 더 그릴 핀 — 읍·면·동 행정복지센터와 시청·구청. */
  extra?: Pin[];
  /** 움직임이 멎을 때 보이는 범위와 확대 정도(zoom, 카카오는 19 − level 로 맞춘다). */
  onView?: (v: View) => void;
  /** 전국이 한눈에 들어오게 맞춘다(첫 화면의 작은 지도). 내 위치가 없을 때만. */
  overview?: boolean;
};


const loadLeaflet = async (): Promise<Leaflet> => {
  const mod = await import("leaflet");
  return ((mod as unknown as { default?: Leaflet }).default ?? mod) as Leaflet;
};

/**
 * Leaflet 로 그리는 지도. 핀은 HTML(divIcon)이라 카카오·네이버 쪽과 같은 모양이다.
 * 지도를 움직이거나 확대할 때마다 이름표 자리를 다시 고른다(pickLabels).
 */
const LeafletEngine = forwardRef<Handle, EngineProps>(function LeafletEngine(
  { pins, kind, me, meLabel, radius, selected, onSelect, loadItems, interactive = true, className = "", extra, onView, overview }, ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<Leaflet | null>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  const meLayer = useRef<import("leaflet").LayerGroup | null>(null);
  const popup = useRef<import("leaflet").Popup | null>(null);
  const labeled = useRef<Map<string, Pos>>(new Map());
  const [ready, setReady] = useState(false);
  const [tier, setTier] = useState<Tier>("far");
  const [view, setView] = useState(0);
  const latest = useRef({ pins, kind, loadItems, onSelect, tier, extra, onView });
  latest.current = { pins, kind, loadItems, onSelect, tier, extra, onView };

  useEffect(() => {
    let dead = false;
    (async () => {
      const lf = await loadLeaflet();
      if (dead || !el.current || map.current) return;
      L.current = lf;
      const single = latest.current.pins.length === 1 ? latest.current.pins[0] : null;
      const m = lf.map(el.current, {
        center: single ? [single.lat, single.lng] : KOREA,
        zoom: single ? (single.approx ? 8 : 11) : 7,
        // 첫 화면의 작은 지도는 높이가 260px 남짓이라 6 단계로는 전국이 안 들어간다. 반 단계씩 더 물러난다.
        minZoom: Math.max(TILE.min, overview ? 5 : 6),
        zoomSnap: overview ? 0.25 : 1,
        zoomControl: false, scrollWheelZoom: interactive, dragging: interactive, touchZoom: interactive,
        doubleClickZoom: interactive, boxZoom: interactive, keyboard: interactive,
      });
      lf.tileLayer(TILE.url, { maxZoom: TILE.max, attribution: TILE.attr }).addTo(m);
      // 확대 단추는 왼쪽 아래. 왼쪽 위에 두면 카드 제목을 가리고, 오른쪽 아래는 떠 있는 메뉴 자리다.
      if (interactive) lf.control.zoom({ position: "bottomleft" }).addTo(m);
      layer.current = lf.layerGroup().addTo(m);
      meLayer.current = lf.layerGroup().addTo(m);
      const tell = () => {
        const b = m.getBounds();
        latest.current.onView?.({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast(), zoom: m.getZoom() });
      };
      m.on("zoomend", () => setTier(tierOfZoom(m.getZoom())));
      m.on("moveend", () => { setView((v) => v + 1); tell(); });
      m.on("popupclose", () => latest.current.onSelect(null));
      setTier(tierOfZoom(m.getZoom()));
      map.current = m;
      setReady(true);
      tell();
    })();
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, [interactive]);

  const openCard = (p: Pin) => {
    const lf = L.current, m = map.current;
    if (!lf || !m || !interactive) return;
    latest.current.onSelect(p.key);
    const lift = cardLift(p, latest.current.tier, labeled.current.has(p.key));
    const pop = lf.popup({ className: "pm-pop-wrap", maxWidth: 320, minWidth: 240, offset: [0, -lift], autoPanPadding: [16, 16] })
      .setLatLng([p.lat, p.lng]).setContent(cardHtml(p, null)).openOn(m);
    popup.current = pop;
    void latest.current.loadItems(p.kind, p.key).then((items) => {
      if (popup.current === pop && pop.isOpen()) pop.setContent(cardHtml(p, items));
    });
  };

  // 핀 그리기. 단계·갈래·선택·화면이 바뀌면 다시.
  useEffect(() => {
    const lf = L.current, m = map.current, g = layer.current;
    if (!lf || !m || !g) return;
    g.clearLayers();
    const list = visiblePins(pins, extra ?? [], tier);
    const size = m.getSize();
    const show = pickLabels(list, (p) => m.latLngToContainerPoint([p.lat, p.lng]), { w: size.x, h: size.y }, tier, selected, overview ? OV_K : 1);
    labeled.current = show;
    for (const p of drawnPins(list, show, selected, overview)) {
      const pos = show.get(p.key);
      const on = pos !== undefined;
      const mk = lf.marker([p.lat, p.lng], {
        icon: lf.divIcon({ html: pinHtml(p, tier, pos, selected === p.key), className: "pm-wrap", iconSize: [0, 0], iconAnchor: [0, 0] }),
        keyboard: false, riseOnHover: true, zIndexOffset: selected === p.key ? 2000 : on ? 1000 + Math.min(p.n, 999) : Math.min(p.n, 999),
      });
      mk.on("click", () => {
        if (p.level === "sido") { m.setView([p.lat, p.lng], 10); return; }
        openCard(p);
      });
      mk.addTo(g);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, extra, tier, kind, selected, ready, view]);

  // 내 위치와 반경 원.
  useEffect(() => {
    const lf = L.current, m = map.current, g = meLayer.current;
    if (!lf || !m || !g) return;
    g.clearLayers();
    if (!me) {
      if (overview) whenStill(m, () => m.fitBounds(KOREA_BOX, { padding: [6, 6] }));
      else if (pins.length !== 1) whenStill(m, () => m.setView(KOREA, 7));
      return;
    }
    lf.circleMarker(me, { radius: 7, color: "#fff", weight: 2, fillColor: "#D97706", fillOpacity: 1 })
      .bindTooltip(meLabel || "내 위치", { direction: "top", offset: [0, -8] }).addTo(g);
    if (radius > 0) {
      const c = lf.circle(me, { radius: radius * 1000, color: "#D97706", weight: 1, fillColor: "#D97706", fillOpacity: 0.06, dashArray: "4 4" }).addTo(g);
      const b = c.getBounds();
      whenStill(m, () => m.fitBounds(b, { padding: [12, 12] }));
    } else {
      whenStill(m, () => m.setView(me, 9));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, radius, meLabel, ready]);

  useImperativeHandle(ref, () => ({
    focus(key: string) {
      const m = map.current;
      const p = latest.current.pins.find((x) => x.key === key) ?? latest.current.extra?.find((x) => x.key === key);
      if (!m || !p) return;
      whenStill(m, () => m.setView([p.lat, p.lng], Math.max(m.getZoom(), p.level === "dong" ? 14 : 11)));
      // 확대가 끝나 핀이 새로 그려진 뒤 카드를 연다.
      setTimeout(() => openCard(p), 350);
    },
  }));

  // isolate: Leaflet 의 층(z-index 400~1000)이 지도 밖으로 새면 화면 아래 탭 막대(z-40)를 덮었다.
  return <div ref={el} role="application" aria-label="지도" className={`isolate ${className}`} />;
});

/**
 * 확대 움직임이 도는 중에 부른 setView·fitBounds 는 Leaflet 이 그냥 버린다(_tryAnimatedZoom).
 * 시·도 → 시·군·구 → 읍·면·동을 빨리 연달아 고르면 지도가 앞의 확대에 멈춰 동네 단계로 못 간다.
 * 움직이는 중이면 끝난 뒤에 한다. 그사이 여러 번 부르면 마지막 것만.
 */
const pendingView = new WeakMap<object, () => void>();
function whenStill(m: { once(ev: string, f: () => void): unknown }, f: () => void) {
  if (!(m as unknown as { _animatingZoom?: boolean })._animatingZoom) { pendingView.delete(m); f(); return; }
  const waiting = pendingView.has(m);
  pendingView.set(m, f);
  if (!waiting) m.once("zoomend", () => { const g = pendingView.get(m); pendingView.delete(m); g?.(); });
}

export default LeafletEngine;
