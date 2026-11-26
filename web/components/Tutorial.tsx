"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DuoIcon from "./DuoIcon";

/**
 * 처음 온 사람을 위한 30초 사용법(2026-11-26). 아래에서 올라오는 판에 네 장 — 옆으로 넘기거나 "다음"을 누른다.
 *
 *  - 첫 화면(/)에 처음 왔을 때 한 번만 저절로 뜬다(이 기기에 jw.tour=1 을 남긴다). 그 뒤로는 "사용법" 단추로만 연다.
 *  - 검색 로봇·성능 측정기에는 띄우지 않는다. 내용은 화면 위에 덮이는 안내라 색인될 글이 아니다.
 *  - 쪽이 다 그려진 뒤(1.6초) 띄운다 — 첫 그리기(LCP)를 건드리지 않는다.
 */
const KEY = "jw.tour";
const EVT = "jw:tutorial";

type Step = { icon: string[]; title: string; body: string; demo?: React.ReactNode; /** 예시를 누르면 닫고 진짜 검색창으로 간다. */ try?: boolean };

const STEPS: Step[] = [
  {
    icon: ["find"],
    title: "한 줄로 적으면 알아듣습니다",
    body: "검색창에 사는 곳과 나이를 그냥 적어 보세요. 지역·나이를 조건으로 읽어 맞는 것만 보여 드립니다.",
    try: true,
    demo: (
      <span className="flex items-center justify-between rounded-pill border-2 border-dashed border-brand/40 bg-surface px-4 py-2.5 text-[15px] text-ink">
        <span><span className="mr-2 rounded-[6px] bg-brandSoft px-1.5 py-0.5 text-[12px] font-bold text-brand">예시</span>서울 32세 무주택<span className="tour-caret" aria-hidden /></span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white" aria-hidden>
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="9" cy="9" r="5.500" /><path d="M13.500 13.500L17 17" strokeLinecap="round" /></svg>
        </span>
      </span>
    ),
  },
  {
    icon: ["find"],
    title: "네 번만 누르면 끝",
    body: "적기 번거로우면 ‘내 조건으로 지원금 찾기’에서 사는 곳 → 나이 → 상태를 차례로 누르세요. 회원가입은 없습니다.",
    demo: (
      <span className="flex items-center justify-center gap-1.5 text-[13.5px] font-bold">
        {["사는 곳", "나이", "상태", "결과"].map((t, i) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`rounded-pill px-3 py-1.5 ${i === 3 ? "bg-brand text-white" : "bg-brandSoft text-brand"}`}>{t}</span>
            {i < 3 && <span aria-hidden className="text-faint">›</span>}
          </span>
        ))}
      </span>
    ),
  },
  {
    icon: ["license"],
    title: "라벨만 봐도 됩니다",
    body: "D-7 은 마감까지 7일 남았다는 뜻입니다. 나이·소득 라벨로 내게 해당하는지 먼저 확인하세요.",
    demo: (
      <span className="flex flex-wrap items-center justify-center gap-1.5 text-[13px] font-bold">
        <span className="rounded-pill bg-alertSoft px-2.5 py-1 text-alert">D-3</span>
        <span className="rounded-pill bg-accentSoft px-2.5 py-1 text-accent">D-7</span>
        <span className="rounded-[6px] bg-cat-violetSoft px-2 py-1 text-cat-violet">만 19~39세</span>
        <span className="rounded-[6px] bg-cat-amberSoft px-2 py-1 text-cat-amber">중위소득 150% 이하</span>
        <span className="rounded-[6px] bg-brandSoft px-2 py-1 text-brand">현금지급</span>
      </span>
    ),
  },
  {
    icon: ["jobs", "license", "map"],
    title: "채용·자격증·지도도 한곳에",
    body: "공공기관 채용, 자격증 시험일, 내 주변 정책지도까지 위 메뉴에 있습니다. 책갈피(저장)를 누르면 다음에 바로 볼 수 있어요.",
  },
];

/** 사용법을 여는 단추. 어디에 두어도 된다(첫 화면 띠에 하나 있다). */
export function TutorialButton({ className = "" }: { className?: string }) {
  return (
    <p className={`mt-3 flex justify-center ${className}`}>
      <button type="button" onClick={() => window.dispatchEvent(new Event(EVT))}
              className="inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-3.5 py-2 text-[13.5px] font-bold text-white backdrop-blur transition hover:bg-white/25 active:scale-95">
        <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[12px] font-black text-brand">?</span>
        처음이신가요? 30초 사용법
      </button>
    </p>
  );
}

export default function Tutorial() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const drag = useRef<{ x: number; id: number } | null>(null);

  // 열려 있는 동안 뒤 화면의 움직임(빛 번짐·흐르는 띠)을 멈춘다 — 저사양·절전 상태의 휴대폰에서 판이 굳어 단추가 안 먹었다.
  useEffect(() => {
    document.documentElement.classList.toggle("tour-open", open);
    return () => document.documentElement.classList.remove("tour-open");
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(KEY, "1"); } catch { /* 저장을 막아 둔 브라우저 — 다음에 또 뜰 뿐이다 */ }
  }, []);

  useEffect(() => {
    const show = () => { setI(0); setOpen(true); };
    window.addEventListener(EVT, show);
    let t = 0;
    try {
      const bot = /bot|crawl|spider|google|lighthouse|pagespeed|headless|preview|yeti|bing|daum/i.test(navigator.userAgent);
      if (!bot && window.location.pathname === "/" && !localStorage.getItem(KEY)) t = window.setTimeout(show, 1600);
    } catch { /* 저장을 못 읽으면 저절로 띄우지 않는다 */ }
    return () => { window.removeEventListener(EVT, show); window.clearTimeout(t); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((v) => Math.min(STEPS.length - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [open, close]);

  if (!open) return null;
  const last = i === STEPS.length - 1;
  const s = STEPS[i];
  return (
    <div className="tour-back fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="사용법"
         onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="tour-sheet w-full max-w-[26rem] rounded-t-[28px] bg-surface px-6 pb-6 pt-3 shadow-float sm:rounded-[28px]"
           onPointerDown={(e) => { drag.current = (e.target as Element).closest("button") ? null : { x: e.clientX, id: e.pointerId }; }}
           onPointerCancel={() => { drag.current = null; }}
           onPointerUp={(e) => {
             const d = drag.current; drag.current = null;
             if (!d) return;
             const dx = e.clientX - d.x;
             if (dx < -50) setI((v) => Math.min(STEPS.length - 1, v + 1));
             if (dx > 50) setI((v) => Math.max(0, v - 1));
           }}>
        <span aria-hidden className="mx-auto block h-1.5 w-10 rounded-full bg-line2 sm:hidden" />
        <div className="mt-3 flex items-center justify-between">
          <span className="num text-[13px] font-bold text-brand">{i + 1} / {STEPS.length}</span>
          <button type="button" onClick={close} className="-mr-2 rounded-pill px-3 py-1.5 text-[13.5px] font-semibold text-muted hover:text-ink">건너뛰기</button>
        </div>
        {/* key 를 바꿔 장이 넘어갈 때마다 다시 떠오르게 한다. */}
        <div key={i} className="tour-step mt-2 text-center">
          <div className="flex items-end justify-center gap-2">
            {s.icon.map((n) => <span key={n} className="tour-ic"><DuoIcon name={n} className="h-[68px] w-[68px]" /></span>)}
          </div>
          <h2 className="mt-4 text-[1.4rem] font-black leading-snug tracking-[-.03em] text-ink break-keep">{s.title}</h2>
          <p className="mx-auto mt-2 max-w-[21rem] text-[15.5px] leading-relaxed text-muted break-keep">{s.body}</p>
          {s.demo && (s.try ? (
            // 예시 검색창은 진짜 입력칸이 아니다. 누르면 판을 닫고 진짜 검색창에 커서를 둔다(키보드가 열린다).
            <button type="button" className="mt-4 block w-full text-left" aria-label="닫고 검색창에 직접 적어 보기"
                    onClick={() => { close(); const el = document.querySelector<HTMLInputElement>(".hero-search input"); el?.focus(); }}>
              {s.demo}
              <span className="mt-2 block text-center text-[13px] font-bold text-brand">눌러서 직접 적어 보기 ›</span>
            </button>
          ) : <div className="mt-4">{s.demo}</div>)}
        </div>
        <div className="mt-6 flex justify-center gap-1.5" aria-hidden>
          {STEPS.map((_, k) => <span key={k} className={`h-2 rounded-full transition-all duration-300 ${k === i ? "w-6 bg-brand" : "w-2 bg-line2"}`} />)}
        </div>
        <div className="mt-5 flex gap-2">
          {i > 0 && <button type="button" onClick={() => setI(i - 1)} className="btn btn-ghost flex-none px-5">이전</button>}
          <button type="button" onClick={() => (last ? close() : setI(i + 1))} className="btn btn-primary flex-1 text-[16px]">
            {last ? "시작하기" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
