"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { LatLng } from "@/lib/geo";
import type { MapItem } from "@/lib/mapData";
import { KAKAO_KEY, loadKakao, type KCircle, type KMap, type KOverlay, type KakaoMaps } from "./kakao";
import { boundsAround, cardHtml, cardLift, pickLabels, pinHtml, sidoPins, tierOfLevel, type Kind, type Pin, type Pos, type Tier } from "./pins";
import type { EngineProps, Handle } from "./LeafletEngine";

const KOREA: LatLng = [36.2, 127.9];

/**
 * 카카오맵 JavaScript SDK 로 그리는 지도(시흥 돌봄지도와 같은 기술).
 * 핀·카드는 CustomOverlay 에 HTML 을 얹는다 — Leaflet 쪽과 같은 HTML, 같은 CSS.
 * NEXT_PUBLIC_KAKAO_MAP_KEY 가 있을 때만 쓰인다(components/map/kakao.ts).
 */
const KakaoEngine = forwardRef<Handle, EngineProps>(function KakaoEngine(
  { pins, kind, me, meLabel, radius, selected, onSelect, loadItems, interactive = true, className = "" }, ref,
) {
  const el = useRef<HTMLDivElement>(null);
  const K = useRef<KakaoMaps | null>(null);
  const map = useRef<KMap | null>(null);
  const overlays = useRef<KOverlay[]>([]);
  const meOverlays = useRef<{ dot: KOverlay | null; circle: KCircle | null }>({ dot: null, circle: null });
  const card = useRef<KOverlay | null>(null);
  const [ready, setReady] = useState(false);
  const [tier, setTier] = useState<Tier>("far");
  const [view, setView] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const labeled = useRef<Map<string, Pos>>(new Map());
  const latest = useRef({ pins, kind, loadItems, onSelect, tier });
  latest.current = { pins, kind, loadItems, onSelect, tier };

  useEffect(() => {
    let dead = false;
    loadKakao(KAKAO_KEY).then((k) => {
      if (dead || !el.current || map.current) return;
      K.current = k;
      const single = latest.current.pins.length === 1 ? latest.current.pins[0] : null;
      const m = new k.Map(el.current, {
        center: new k.LatLng(single ? single.lat : KOREA[0], single ? single.lng : KOREA[1]),
        level: single ? (single.approx ? 11 : 8) : 12,
        draggable: interactive, scrollwheel: interactive, disableDoubleClickZoom: !interactive,
      });
      if (interactive) m.addControl(new k.ZoomControl(), k.ControlPosition.RIGHT);
      k.event.addListener(m, "zoom_changed", () => setTier(tierOfLevel(m.getLevel())));
      // 움직임이 멎을 때마다 이름표 자리를 다시 고른다.
      k.event.addListener(m, "idle", () => setView((v) => v + 1));
      setTier(tierOfLevel(m.getLevel()));
      map.current = m;
      setReady(true);
    }).catch((e: Error) => setErr(e.message));
    return () => { dead = true; };
  }, [interactive]);

  const closeCard = () => { card.current?.setMap(null); card.current = null; latest.current.onSelect(null); };

  const openCard = (p: Pin) => {
    const k = K.current, m = map.current;
    if (!k || !m || !interactive) return;
    card.current?.setMap(null);
    latest.current.onSelect(p.key);
    const box = document.createElement("div");
    box.className = "pm-kcard";
    box.style.setProperty("--lift", `${cardLift(p, latest.current.tier, labeled.current.has(p.key))}px`);
    const render = (items: MapItem[] | null) => {
      box.innerHTML = cardHtml(p, items, { close: true });
      box.querySelector("[data-close]")?.addEventListener("click", closeCard);
    };
    render(null);
    const ov = new k.CustomOverlay({ position: new k.LatLng(p.lat, p.lng), content: box, xAnchor: 0, yAnchor: 0, zIndex: 20, clickable: true });
    ov.setMap(m);
    card.current = ov;
    m.panTo(new k.LatLng(p.lat + 0.004 * Math.pow(2, m.getLevel() - 7), p.lng));
    void latest.current.loadItems(p.kind, p.key).then((items) => { if (card.current === ov) render(items); });
  };

  // 핀.
  useEffect(() => {
    const k = K.current, m = map.current;
    if (!k || !m) return;
    for (const o of overlays.current) o.setMap(null);
    overlays.current = [];
    const list = tier === "far" && pins.length > 1 ? sidoPins(pins) : pins;
    const proj = m.getProjection();
    const w = el.current?.clientWidth ?? 0, h = el.current?.clientHeight ?? 0;
    const show = pickLabels(list, (p) => proj.containerPointFromCoords(new k.LatLng(p.lat, p.lng)), { w, h }, tier, selected);
    labeled.current = show;
    for (const p of list) {
      const pos = show.get(p.key);
      const on = pos !== undefined;
      const box = document.createElement("div");
      box.innerHTML = pinHtml(p, tier, pos, selected === p.key);
      const pin = box.firstElementChild as HTMLElement | null;
      pin?.addEventListener("click", () => {
        if (p.level === "sido") { m.setCenter(new k.LatLng(p.lat, p.lng)); m.setLevel(9); return; }
        openCard(p);
      });
      const ov = new k.CustomOverlay({ position: new k.LatLng(p.lat, p.lng), content: box, xAnchor: 0, yAnchor: 0, zIndex: selected === p.key ? 6 : on ? 4 : 2, clickable: true });
      ov.setMap(m);
      overlays.current.push(ov);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, tier, kind, selected, ready, view]);

  // 내 위치와 반경 원.
  useEffect(() => {
    const k = K.current, m = map.current;
    if (!k || !m) return;
    meOverlays.current.dot?.setMap(null); meOverlays.current.circle?.setMap(null);
    meOverlays.current = { dot: null, circle: null };
    if (!me) { if (pins.length !== 1) { m.setCenter(new k.LatLng(KOREA[0], KOREA[1])); m.setLevel(12); } return; }
    const dot = document.createElement("div");
    dot.className = "pm-me"; dot.title = meLabel || "내 위치";
    const d = new k.CustomOverlay({ position: new k.LatLng(me[0], me[1]), content: dot, xAnchor: 0, yAnchor: 0, zIndex: 3 });
    d.setMap(m);
    meOverlays.current.dot = d;
    if (radius > 0) {
      const c = new k.Circle({ center: new k.LatLng(me[0], me[1]), radius: radius * 1000, strokeWeight: 1, strokeColor: "#D97706", strokeOpacity: 0.9, strokeStyle: "dashed", fillColor: "#D97706", fillOpacity: 0.06 });
      c.setMap(m);
      meOverlays.current.circle = c;
      const { sw, ne } = boundsAround(me[0], me[1], radius);
      m.setBounds(new k.LatLngBounds(new k.LatLng(sw[0], sw[1]), new k.LatLng(ne[0], ne[1])));
    } else {
      m.setCenter(new k.LatLng(me[0], me[1])); m.setLevel(10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, radius, meLabel, ready]);

  useImperativeHandle(ref, () => ({
    focus(key: string) {
      const k = K.current, m = map.current;
      const p = latest.current.pins.find((x) => x.key === key);
      if (!k || !m || !p) return;
      m.setCenter(new k.LatLng(p.lat, p.lng));
      if (m.getLevel() > 7) m.setLevel(7);
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

export default KakaoEngine;
