"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const ITEMS = [
  { href: "/", label: "내 조건으로 찾기", d: "M9 3a6 6 0 100 12A6 6 0 009 3zm5 11l5 5" },
  { href: "/policies", label: "전체 정책", d: "M4 5h16v14H4z M8 9h8M8 13h5" },
  { href: "/jobs", label: "채용·취업", d: "M3 8h18v12H3z M8 8V5h8v3" },
  { href: "/license", label: "자격증", d: "M12 3l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 10l6-1z" },
  { href: "/money", label: "생활금융", d: "M3 7h18v10H3z M12 9a3 3 0 100 6 3 3 0 000-6z" },
  { href: "/agency", label: "공공기관", d: "M3 10l9-6 9 6 M5 10v10h14V10 M9 20v-6h6v6" },
];

/**
 * 떠 있는 메뉴. 오른쪽 아래 단추 하나가 여섯 갈래로 펼쳐진다.
 *
 * 긴 화면을 읽다가 다른 곳으로 가려면 맨 위까지 올라가야 했다. 손이 닿는
 * 자리에 갈래를 둔다. 한 화면 넘게 내려갔을 때는 "맨 위로"도 같이 나온다.
 */
export default function FloatingMenu() {
  const [open, setOpen] = useState(false);
  const [deep, setDeep] = useState(false);
  useEffect(() => {
    const on = () => setDeep(window.scrollY > window.innerHeight * 0.8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      {/* 펼쳐진 갈래 */}
      <ul
        className={`flex flex-col items-end gap-1.5 transition-all duration-200 ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}
        aria-hidden={!open}
      >
        {ITEMS.map((it, i) => (
          <li key={it.href} style={{ transitionDelay: open ? `${i * 25}ms` : "0ms" }}
              className="transition-transform">
            <Link href={it.href} onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-pill border border-line bg-surface/95 py-2 pl-3.5 pr-4
                             text-[13.5px] font-semibold text-ink2 shadow-lift backdrop-blur
                             transition-colors hover:border-brand hover:text-brand">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand" fill="none" stroke="currentColor"
                   strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={it.d} /></svg>
              {it.label}
            </Link>
          </li>
        ))}
        {deep && (
          <li>
            <button type="button" onClick={() => { window.scrollTo({ top: 0 }); setOpen(false); }}
                    className="flex items-center gap-2 rounded-pill border border-line bg-surface/95 py-2 pl-3.5 pr-4
                               text-[13.5px] font-semibold text-ink2 shadow-lift backdrop-blur hover:border-brand hover:text-brand">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-brand" fill="none" stroke="currentColor"
                   strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              맨 위로
            </button>
          </li>
        )}
      </ul>

      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "메뉴 닫기" : "바로가기 메뉴"}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-13 w-13 items-center justify-center rounded-pill text-white shadow-lift
                    transition-all duration-200 ${open ? "rotate-45 bg-deep" : "bg-brand hover:bg-brandDeep"}`}
        style={{ width: 52, height: 52 }}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2"
             strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  );
}
