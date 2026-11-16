"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * 거르기 단추 하나와 그 펼침 창(2026-11-15).
 *
 * 채용 사이트(사람인·잡코리아)처럼 항목마다 단추를 두고, 누르면 고를 것이 펼쳐진다.
 * 휴대폰에서는 아래에서 올라오는 판(바텀 시트), 넓은 화면에서는 단추 바로 아래 창.
 *
 * <details> 로 짠다 — 자바스크립트가 없어도 열고 닫히고, 안의 폼·링크는 처음부터 문서에 있다.
 * 자바스크립트는 덤만 한다: 하나를 열면 다른 것을 닫고, 바깥을 누르거나 Esc 를 누르면 닫는다.
 */
export default function FilterMenu({ label, value, active, children }: {
  label: string;
  /** 고른 값 요약("행정·사무 외 1"). 없으면 항목 이름만. */
  value?: string;
  active?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  // 창 안의 링크·폼으로 주소가 바뀌면 닫는다. 쪽을 새로 열지 않고 옮겨 가므로(스크롤 유지) 그대로 두면 열린 채 남는다.
  const pathname = usePathname();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [pathname]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const close = () => { el.open = false; };
    const onToggle = () => {
      if (!el.open) return;
      document.querySelectorAll<HTMLDetailsElement>("details[data-filter-menu]").forEach((d) => { if (d !== el) d.open = false; });
    };
    const onDown = (e: PointerEvent) => {
      if (!el.open) return;
      const panel = el.querySelector("[data-filter-panel]");
      const t = e.target as Node;
      // 판 바깥(어두운 바탕 포함)을 누르면 닫는다. 단추 자체는 details 가 알아서 여닫는다.
      if (panel?.contains(t) || el.querySelector("summary")?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && el.open) { close(); el.querySelector("summary")?.focus(); } };
    el.addEventListener("toggle", onToggle);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("toggle", onToggle);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details ref={ref} data-filter-menu className="group/fm relative shrink-0">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-pill border px-3.5 py-2 text-[13.5px] font-semibold transition-colors [&::-webkit-details-marker]:hidden ${
          active ? "border-brand bg-brandSoft text-brand" : "border-line2 bg-surface text-ink2 hover:border-ink2"
        } group-open/fm:border-brand`}
      >
        <span>{label}</span>
        {value && <span className="max-w-[9rem] truncate font-bold">· {value}</span>}
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 transition-transform group-open/fm:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m5 8 5 5 5-5" />
        </svg>
      </summary>
      {/* 휴대폰: 화면 아래에 붙는 판 + 어두운 바탕. sm 이상: 단추 아래 창. */}
      <div className="fixed inset-0 z-[1190] bg-black/40 sm:hidden" aria-hidden />
      <div
        data-filter-panel
        role="dialog"
        aria-label={`${label} 고르기`}
        className="fixed inset-x-0 bottom-0 z-[1200] flex max-h-[75vh] flex-col rounded-t-[20px] bg-surface shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-[calc(100%+6px)] sm:max-h-[60vh] sm:w-[340px] sm:rounded-card sm:border sm:border-line"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line2 sm:hidden" aria-hidden />
        {children}
      </div>
    </details>
  );
}
