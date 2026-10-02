"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";
import type { MapItem } from "@/lib/mapData";
import { NAVER_KEY, loadNaver, type NCircle, type NMap, type NMarker, type NaverMaps } from "./naver";
import { KOREA_BOX, OV_K, boundsAround, cardHtml, cardLift, drawnPins, pickLabels, pinHtml, tierOfZoom, visiblePins, type Pin, type Pos, type Tier } from "./pins";
import type { EngineProps, Handle } from "./LeafletEngine";

const KOREA: LatLng = [36.2, 127.9];

/**
 * 네이버 지도로 그리는 지도. 핀·카드는 HTML 마커(icon.content)에 얹는다 —
 * Leaflet·카카오 쪽과 같은 HTML, 같은 CSS. zoom 단계는 Leaflet 과 같다.
 * NEXT_PUBLIC_NAVER_MAP_KEY 가 있을 때만 쓰인다(components/map/naver.ts).
 */
const NaverEngine = forwardRef<Handle, EngineProps>(function NaverEngine(
  { pins, kind, me, meLabel, radius, selected, onSelect, loadItems, interactive = true, className = "", extra, onView, overview }, ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const N = useRef<NaverMaps | null>(null);
  const map = useRef<NMap | null>(null);
  const markers = useRef<NMarker[]>([]);
  const meObjs = useRef<{ dot: NMarker | null; circle: NCircle | null }>({ dot: null, circle: null });
  const card = useRef<NMarker | null>(null);
  const labeled = useRef<Map<string, Pos>>(new Map());
  const [ready, setReady] = useState(false);
  const [tier, setTier] = useState<Tier>("far");
  const [view, setView] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const latest = useRef({ pins, kind, loadItems, onSelect, tier, extra, onView });
  latest.current = { pins, kind, loadItems, onSelect, tier, extra, onView };

  useEffect(() => {
    let dead = false;
    loadNaver(NAVER_KEY).then((n) => {
      if (dead || !el.current || map.current) return;
      N.current = n;
      const single = latest.current.pins.length === 1 ? latest.current.pins[0] : null;
      const m = new n.Map(el.current, {
        center: new n.LatLng(single ? single.lat : KOREA[0], single ? single.lng : KOREA[1]),
        zoom: single ? (single.approx ? 8 : 11) : 7, minZoom: 6,
        zoomControl: interactive, zoomControlOptions: { position: n.Position.RIGHT_CENTER },
        draggable: interactive, scrollWheel: interactive, pinchZoom: interactive, disableDoubleClickZoom: !interactive,
        keyboardShortcuts: interactive, mapDataControl: false, scaleControl: false,
      });
      n.Event.addListener(m, "zoom_changed", () => setTier(tierOfZoom(m.getZoom())));
      const tell = () => {
        const b = m.getBounds(), sw = b.getSW(), ne = b.getNE();
        latest.current.onView?.({ s: sw.lat(), w: sw.lng(), n: ne.lat(), e: ne.lng(), zoom: m.getZoom() });
      };
      n.Event.addListener(m, "idle", () => { setView((v) => v + 1); tell(); });
      setTier(tierOfZoom(m.getZoom()));
      map.current = m;
      setReady(true);
    }).catch((e: Error) => setErr(e.message));
    return () => { dead = true; };
  }, [interactive]);

  const closeCard = () => { card.current?.setMap(null); card.current = null; latest.current.onSelect(null); };

  const openCard = (p: Pin) => {
    const n = N.current, m = map.current;
    if (!n || !m || !interactive) return;
    card.current?.setMap(null);
    latest.current.onSelect(p.key);
    const box = document.createElement("div");
    box.className = "pm-kcard";
    box.style.setProperty("--lift", `${cardLift(p, latest.current.tier, labeled.current.has(p.key))}px`);
    const render = (items: MapItem[] | null) => {
      box.innerHTML = cardHtml(p, items, { close: true });
      box.querySelector("[data-close]")?.addEventListener("click", (e) => { e.stopPropagation(); closeCard(); });
    };
    render(null);
    const mk = new n.Marker({ position: new n.LatLng(p.lat, p.lng), map: m, zIndex: 3000, clickable: true, icon: { content: box, anchor: new n.Point(0, 0) } });
    card.current = mk;
    m.panTo(new n.LatLng(p.lat + 0.004 * Math.pow(2, 12 - m.getZoom()), p.lng));
    void latest.current.loadItems(p.kind, p.key).then((items) => { if (card.current === mk) render(items); });
  };

  // 핀.
  useEffect(() => {
    const n = N.current, m = map.current;
    if (!n || !m) return;
    for (const mk of markers.current) mk.setMap(null);
    markers.current = [];
    const list = visiblePins(pins, extra ?? [], tier);
    const proj = m.getProjection();
    const size = m.getSize();
    // fromCoordToOffset 이 컨테이너 기준이든 세계 픽셀이든, 지도 가운데를 빼서 화면 좌표로 맞춘다.
    const c = proj.fromCoordToOffset(m.getCenter());
    const project = (p: Pin) => {
      const o = proj.fromCoordToOffset(new n.LatLng(p.lat, p.lng));
      return { x: o.x - c.x + size.width / 2, y: o.y - c.y + size.height / 2 };
    };
    const show = pickLabels(list, project, { w: size.width, h: size.height }, tier, selected, overview ? OV_K : 1);
    labeled.current = show;
    for (const p of drawnPins(list, show, selected, overview)) {
      const pos = show.get(p.key);
      const on = pos !== undefined;
      const box = document.createElement("div");
      box.innerHTML = pinHtml(p, tier, pos, selected === p.key);
      const mk = new n.Marker({
        position: new n.LatLng(p.lat, p.lng), map: m, clickable: true,
        zIndex: selected === p.key ? 2000 : on ? 1000 + Math.min(p.n, 999) : Math.min(p.n, 999),
        icon: { content: box, anchor: new n.Point(0, 0) },
      });
      n.Event.addListener(mk, "click", () => {
        if (p.level === "sido") { m.setCenter(new n.LatLng(p.lat, p.lng)); m.setZoom(10); return; }
        openCard(p);
      });
      markers.current.push(mk);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, extra, tier, kind, selected, ready, view]);

  // 내 위치와 반경 원.
  useEffect(() => {
    const n = N.current, m = map.current;
    if (!n || !m) return;
    meObjs.current.dot?.setMap(null); meObjs.current.circle?.setMap(null);
    meObjs.current = { dot: null, circle: null };
    if (!me) {
      if (overview) m.fitBounds(new n.LatLngBounds(new n.LatLng(...KOREA_BOX[0]), new n.LatLng(...KOREA_BOX[1])), { top: 6, right: 6, bottom: 6, left: 6 });
      else if (pins.length !== 1) { m.setCenter(new n.LatLng(KOREA[0], KOREA[1])); m.setZoom(7); }
      return;
    }
    const dot = document.createElement("div");
    dot.className = "pm-me"; dot.title = meLabel || "내 위치";
    meObjs.current.dot = new n.Marker({ position: new n.LatLng(me[0], me[1]), map: m, zIndex: 1500, icon: { content: dot, anchor: new n.Point(0, 0) } });
    if (radius > 0) {
      meObjs.current.circle = new n.Circle({ map: m, center: new n.LatLng(me[0], me[1]), radius: radius * 1000, strokeColor: "#D97706", strokeOpacity: 0.9, strokeWeight: 1, strokeStyle: "dash", fillColor: "#D97706", fillOpacity: 0.06, clickable: false });
      const { sw, ne } = boundsAround(me[0], me[1], radius);
      m.fitBounds(new n.LatLngBounds(new n.LatLng(sw[0], sw[1]), new n.LatLng(ne[0], ne[1])), { top: 12, right: 12, bottom: 12, left: 12 });
    } else {
      m.setCenter(new n.LatLng(me[0], me[1])); m.setZoom(9);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, radius, meLabel, ready]);

  useImperativeHandle(ref, () => ({
    focus(key: string) {
      const n = N.current, m = map.current;
      const p = latest.current.pins.find((x) => x.key === key) ?? latest.current.extra?.find((x) => x.key === key);
      if (!n || !m || !p) return;
      m.setCenter(new n.LatLng(p.lat, p.lng));
      const want = p.level === "dong" ? 14 : 11;
      if (m.getZoom() < want) m.setZoom(want);
      setTimeout(() => openCard(p), 350);
    },
  }));

  return (
    <div className={`relative ${className}`}>
      <div ref={el} role="application" aria-label="지도" className="h-full w-full" />
      {err && <p className="absolute inset-x-0 bottom-0 bg-white/90 px-3 py-2 text-[12.5px] text-alert">{err}</p>}
    </div>
  );
});

export default NaverEngine;
