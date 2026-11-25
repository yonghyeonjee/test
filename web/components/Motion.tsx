"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 움직임을 담당하는 작은 부품들.
 *
 * 전부 "없어도 되는" 것들이다. 자바스크립트가 늦게 오거나 움직임을 줄이는
 * 설정이 켜져 있으면 그냥 정지 화면으로 보인다. 그래서 내용은 서버에서
 * 다 그려 두고, 여기서는 클래스 하나를 붙이거나 숫자를 굴리기만 한다.
 */

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** 화면에 들어올 때 살짝 떠오르게. */
export function Reveal({
  children, className = "", delay = 0, as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced() || !("IntersectionObserver" in window)) { el.classList.add("in"); return; }
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { el.classList.add("in"); io.disconnect(); } }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    // @ts-expect-error — 태그를 바꿔 끼우는 것뿐이다.
    <Tag ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  );
}

/** 숫자가 0에서 값까지 굴러 올라간다. 서버는 최종값을 그려 두므로 깜빡임이 없다. */
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || value <= 0) return;
    let raf = 0;
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 900;
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        setShown(Math.round(value * e));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      setShown(0);
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  return <span ref={ref} className={`num ${className}`}>{shown.toLocaleString()}</span>;
}

/** 머리말이 떠 있는 동안 그림자·배경을 준다. */
export function HeaderFx() {
  useEffect(() => {
    const h = document.querySelector<HTMLElement>("[data-site-header]");
    if (!h) return;
    const on = () => h.classList.toggle("scrolled", window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return null;
}

/** 위로 가기. 한 화면 넘게 내려갔을 때만 보인다. */
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > window.innerHeight);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <button
      type="button"
      aria-label="맨 위로"
      onClick={() => window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" })}
      className={`fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-pill
                  border border-line bg-surface/90 text-ink2 shadow-lift backdrop-blur transition
                  hover:border-brand hover:text-brand ${show ? "opacity-100" : "pointer-events-none opacity-0 translate-y-2"}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
    </button>
  );
}

/** "/" 를 누르면 첫 검색창으로. 키보드로 쓰는 사람을 위한 것. */
export function HotkeyFocus() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const box = document.querySelector<HTMLInputElement>("input[type='search'], input[name='q'], input[data-search]");
      if (box) { e.preventDefault(); box.focus(); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  return null;
}

/**
 * 맨 위 가는 띠가 읽은 만큼 찬다(2026-11-25). 쪽 전체에 하나. 움직임 줄이기 설정이면 그리지 않는다.
 * 스크롤마다 React 를 다시 그리지 않고 transform 만 바꾼다.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        el.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} aria-hidden className="scroll-progress" />;
}

/**
 * 카드 위 빛(2026-11-25). `.spot` 이 붙은 상자 위에서 마우스를 움직이면 그 자리에 옅은 빛이 따라온다.
 * 카드마다 구독하지 않고 문서에 하나만 건다. 터치 기기·움직임 줄이기 설정에서는 아무 일도 하지 않는다.
 */
export function SpotlightFx() {
  useEffect(() => {
    if (reduced() || !window.matchMedia?.("(hover: hover)").matches) return;
    const on = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest?.<HTMLElement>(".spot");
      if (!t) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty("--mx", `${e.clientX - r.left}px`);
      t.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", on, { passive: true });
    return () => document.removeEventListener("pointermove", on);
  }, []);
  return null;
}

/**
 * 세 걸음 이야기(2026-11-25). 내려가면 세로 선이 차오르고, 화면 가운데를 지난 걸음이 하나씩 켜진다.
 * 내용은 서버에서 다 그려져 있다 — 여기서는 `data-on` 과 선 길이(--p)만 바꾼다.
 */
export function StepStory({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const steps = Array.from(el.querySelectorAll<HTMLElement>("[data-step]"));
    if (reduced()) { steps.forEach((s) => s.setAttribute("data-on", "")); el.style.setProperty("--p", "1"); return; }
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const mid = window.innerHeight * 0.62;
        const p = Math.max(0, Math.min(1, (mid - r.top) / Math.max(1, r.height)));
        el.style.setProperty("--p", p.toFixed(3));
        steps.forEach((s) => s.toggleAttribute("data-on", s.getBoundingClientRect().top < mid));
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} className={`step-story ${className}`}>{children}</div>;
}
