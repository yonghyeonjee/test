"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * 주 메뉴의 "정책지도" 아래에 다는 말풍선(2026-11-15).
 *
 * 지원금은 사는 곳에 따라 받을 수 있는 것이 갈린다. 그런데 "내 동네 것만 보는 길"이 메뉴 이름(정책지도)만으로는
 * 드러나지 않았다. 처음 온 사람에게 한 번 알려 주고, 누르거나 닫으면 다시 띄우지 않는다.
 * 정책지도에서 위치를 정해 둔 사람에게는 그 동네 이름으로 적는다("시흥시 중심으로 찾기").
 *
 * 메뉴 줄은 가로로 넘치는 띠라(overflow-x) 그 안에 두면 잘린다. 띠 바깥(감싼 relative 칸)에 띄우고
 * 정책지도 글자의 가운데를 재서 그 아래에 맞춘다. 띠를 옆으로 밀어 글자가 화면 밖으로 나가면 숨긴다.
 */
const SEEN_KEY = "jw.tip.map.v1";
const GEO_KEY = "jw.geo.v1";

export default function MapTip({ path }: { path: string | null }) {
  const root = useRef<HTMLDivElement>(null);
  const [x, setX] = useState<number | null>(null);
  const [where, setWhere] = useState<string | null>(null);
  const [off, setOff] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) === "1") return;
      const s = JSON.parse(localStorage.getItem(GEO_KEY) ?? "null") as { label?: string } | null;
      const label = s?.label?.trim();
      // "경기 시흥시 대야동" → "시흥시". 좁은 말풍선에 다 넣으면 메뉴를 가린다.
      if (label && label !== "내 위치") { const w = label.split(/\s+/); setWhere(w[1] ?? w[0]); }
    } catch { /* 저장소를 못 읽어도 말풍선은 띄운다 */ }
    setOff(false);
  }, []);

  useEffect(() => {
    if (off) return;
    const wrap = root.current?.parentElement;
    const band = wrap?.querySelector<HTMLElement>("nav.menu-band");
    const link = band?.querySelector<HTMLElement>('a[href="/map"]');
    if (!wrap || !band || !link) return;
    const measure = () => {
      const w = wrap.getBoundingClientRect(), l = link.getBoundingClientRect();
      const mid = l.left + l.width / 2 - w.left;
      // 글자가 띠 밖으로 밀려 나갔으면 가리킬 곳이 없다.
      setX(l.right < w.left + 8 || l.left > w.right - 8 ? null : Math.min(Math.max(mid, 92), w.width - 92));
    };
    measure();
    band.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => { band.removeEventListener("scroll", measure); window.removeEventListener("resize", measure); };
  }, [off, path]);

  const close = () => { setOff(true); try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* */ } };

  // 정책지도 안에서는 띄우지 않는다(이미 와 있다).
  const hidden = off || x === null || path === "/map";
  return (
    <div ref={root} className="pointer-events-none absolute left-0 top-full z-30" style={{ transform: `translateX(${x ?? 0}px)` }} hidden={hidden}>
      <div role="note" className="pointer-events-auto relative mt-1 flex -translate-x-1/2 items-center whitespace-nowrap rounded-pill bg-ink text-[12.5px] font-bold text-white shadow-lift">
        <span aria-hidden className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-ink" />
        <Link href="/map" onClick={close} className="relative py-1.5 pl-3.5 pr-1.5">
          {where ? `${where} 중심으로 찾기` : "우리 지역 중심으로 찾기"}
        </Link>
        <button type="button" onClick={close} aria-label="안내 닫기" className="relative py-1.5 pl-1 pr-3 text-white/70 hover:text-white">×</button>
      </div>
    </div>
  );
}
