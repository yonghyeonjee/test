"use client";

import "leaflet/dist/leaflet.css";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";
import type { MapItem } from "@/lib/mapData";
import { cardHtml, pinHtml, sidoPins, tierOfZoom, type Kind, type Pin, type Tier } from "./pins";

type Leaflet = typeof import("leaflet");
const KOREA: LatLng = [36.2, 127.9];
// 카카오·네이버 지도처럼 차분한 바탕. 도로가 빨갛게 번지는 기본 OSM 타일보다 글자가 잘 보인다.
const TILE = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

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
  /** false 면 끌기·확대·말풍선 없이 보기만(상세 쪽 작은 지도). */
  interactive?: boolean;
  className?: string;
};

const loadLeaflet = async (): Promise<Leaflet> => {
  const mod = await import("leaflet");
  return ((mod as unknown as { default?: Leaflet }).default ?? mod) as Leaflet;
};

/**
 * Leaflet 로 그리는 지도. 핀은 HTML(divIcon)이라 카카오맵 쪽과 같은 모양이다.
 * 멀리서는 시·도 묶음 핀, 중간은 건수 동그라미, 가까이서는 이름 달린 핀.
 */
const LeafletEngine = forwardRef<Handle, EngineProps>(function LeafletEngine(
  { pins, kind, me, meLabel, radius, selected, onSelect, loadItems, interactive = true, className = "" }, ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const L = useRef<Leaflet | null>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  const meLayer = useRef<import("leaflet").LayerGroup | null>(null);
  const markers = useRef(new Map<string, import("leaflet").Marker>());
  const popup = useRef<import("leaflet").Popup | null>(null);
  const [ready, setReady] = useState(false);
  const [tier, setTier] = useState<Tier>("far");
  const latest = useRef({ pins, kind, loadItems, onSelect });
  latest.current = { pins, kind, loadItems, onSelect };

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
        zoomControl: interactive, scrollWheelZoom: interactive, dragging: interactive, touchZoom: interactive,
        doubleClickZoom: interactive, boxZoom: interactive, keyboard: interactive,
      });
      lf.tileLayer(TILE, { maxZoom: 18, subdomains: "abcd", attribution: ATTR }).addTo(m);
      layer.current = lf.layerGroup().addTo(m);
      meLayer.current = lf.layerGroup().addTo(m);
      m.on("zoomend", () => setTier(tierOfZoom(m.getZoom())));
      m.on("popupclose", () => latest.current.onSelect(null));
      setTier(tierOfZoom(m.getZoom()));
      map.current = m;
      setReady(true);
    })();
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, [interactive]);

  const openCard = (p: Pin) => {
    const lf = L.current, m = map.current;
    if (!lf || !m || !interactive) return;
    latest.current.onSelect(p.key);
    const pop = lf.popup({ className: "pm-pop-wrap", maxWidth: 320, minWidth: 240, offset: [0, tier === "near" ? -38 : -14], autoPanPadding: [16, 16] })
      .setLatLng([p.lat, p.lng]).setContent(cardHtml(p, null)).openOn(m);
    popup.current = pop;
    void latest.current.loadItems(p.kind, p.key).then((items) => {
      if (popup.current === pop && pop.isOpen()) pop.setContent(cardHtml(p, items));
    });
  };

  // 핀 그리기. 단계·갈래·선택이 바뀌면 다시.
  useEffect(() => {
    const lf = L.current, m = map.current, g = layer.current;
    if (!lf || !m || !g) return;
    g.clearLayers(); markers.current.clear();
    const list = tier === "far" && pins.length > 1 ? sidoPins(pins) : pins;
    for (const p of list) {
      const mk = lf.marker([p.lat, p.lng], {
        icon: lf.divIcon({ html: pinHtml(p, tier, selected === p.key), className: "pm-wrap", iconSize: [0, 0], iconAnchor: [0, 0] }),
        keyboard: false, riseOnHover: true, zIndexOffset: selected === p.key ? 1000 : 0,
      });
      mk.on("click", () => {
        if (p.level === "sido") { m.setView([p.lat, p.lng], 10); return; }
        openCard(p);
      });
      mk.addTo(g);
      markers.current.set(p.key, mk);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, tier, kind, selected, ready]);

  // 내 위치와 반경 원.
  useEffect(() => {
    const lf = L.current, m = map.current, g = meLayer.current;
    if (!lf || !m || !g) return;
    g.clearLayers();
    if (!me) { if (pins.length !== 1) m.setView(KOREA, 7); return; }
    lf.circleMarker(me, { radius: 7, color: "#fff", weight: 2, fillColor: "#D97706", fillOpacity: 1 })
      .bindTooltip(meLabel || "내 위치", { direction: "top", offset: [0, -8] }).addTo(g);
    if (radius > 0) {
      const c = lf.circle(me, { radius: radius * 1000, color: "#D97706", weight: 1, fillColor: "#D97706", fillOpacity: 0.06, dashArray: "4 4" }).addTo(g);
      m.fitBounds(c.getBounds(), { padding: [12, 12] });
    } else {
      m.setView(me, 9);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, radius, meLabel, ready]);

  useImperativeHandle(ref, () => ({
    focus(key: string) {
      const m = map.current;
      const p = latest.current.pins.find((x) => x.key === key);
      if (!m || !p) return;
      m.setView([p.lat, p.lng], Math.max(m.getZoom(), 11));
      // 확대가 끝나 핀이 새로 그려진 뒤 카드를 연다.
      setTimeout(() => openCard(p), 350);
    },
  }));

  return <div ref={el} role="application" aria-label="지도" className={className} />;
});

export default LeafletEngine;
