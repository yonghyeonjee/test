"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * 화면 아래에 잠깐 뜨는 알림. "저장했습니다 · 보기" 같은 것.
 *
 * 어디서든 toast("…") 로 부른다 — 창 이벤트로 보내고 Toaster(layout 에 하나) 가 받아 그린다.
 * 글자 옆 단추 하나까지만. 3초 뒤 사라지고, 새 알림이 오면 바꿔 단다.
 */
export type ToastMsg = { text: string; href?: string; label?: string; tone?: "ok" | "info" | "warn" };

export function toast(text: string, opts: Omit<ToastMsg, "text"> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastMsg>("jw:toast", { detail: { text, ...opts } }));
}

export default function Toaster() {
  const [m, setM] = useState<ToastMsg | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const on = (e: Event) => { setM((e as CustomEvent<ToastMsg>).detail); setN((k) => k + 1); };
    window.addEventListener("jw:toast", on);
    return () => window.removeEventListener("jw:toast", on);
  }, []);
  useEffect(() => {
    if (!m) return;
    const t = setTimeout(() => setM(null), 3200);
    return () => clearTimeout(t);
  }, [m, n]);
  if (!m) return null;
  const tone = m.tone === "warn" ? "bg-alert" : "bg-ink";
  return (
    <div key={n} role="status" aria-live="polite"
         className={`toast flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-pill ${tone} py-2.5 pl-4 pr-2 text-[14px] font-semibold text-white shadow-lift`}>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20" aria-hidden>
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10l4 4 8-8" /></svg>
      </span>
      <span className="min-w-0 truncate">{m.text}</span>
      {m.href && m.label && (
        <Link href={m.href} onClick={() => setM(null)}
              className="shrink-0 rounded-pill bg-white/15 px-3 py-1 text-[13px] font-bold hover:bg-white/25">{m.label}</Link>
      )}
      <button type="button" onClick={() => setM(null)} aria-label="닫기"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/15 hover:text-white">
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
      </button>
    </div>
  );
}
