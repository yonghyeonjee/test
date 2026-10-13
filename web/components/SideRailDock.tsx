"use client";

import { useEffect, useRef } from "react";

/**
 * 오른쪽 세로 광고의 세로 자리. 처음에는 머리말 바로 아래, 본문 시작선에 맞춰 두고,
 * 스크롤해 머리말이 올라가면 화면 위 1rem 에 붙는다(sticky 처럼). 레이아웃 바깥(body 끝)에
 * 있어 css sticky 가 안 먹으니 스크롤마다 top 을 계산한다.
 *
 * PC 에서는 body 에 zoom 이 걸려 있다. getBoundingClientRect 는 화면 px 로 오고, 이 상자의 top 은
 * 확대된 단위로 먹히니 zoom 으로 나눠 맞춘다.
 */
export default function SideRailDock({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const h = document.querySelector("[data-site-header]");
      const z = parseFloat(getComputedStyle(document.body).zoom as string) || 1;
      const below = h ? h.getBoundingClientRect().bottom / z + 20 : 16;
      el.style.top = `${Math.max(16, Math.round(below))}px`;
    };
    place();
    window.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place); window.removeEventListener("resize", place); };
  }, []);
  return <div ref={ref} className="side-rail">{children}</div>;
}
