import type { ReactNode } from "react";
import PortalSearch from "./PortalSearch";

type Idx = Record<string, { sido: string; full: string }>;

/** 자료를 가져오는 곳. 띠로 흘러간다(움직임 줄이기 설정이면 멈춘 한 줄). */
const SOURCES = ["복지로", "기업마당", "나라일터", "잡알리오", "큐넷", "고용24", "공공데이터포털"];

/**
 * 첫 화면 맨 위. 약속 한 문장(보이는 H1) → 입력 하나 → 신뢰 줄.
 *
 * 2026-11-25 "배경이 단조롭고 신뢰가 없다"는 말에 화면 폭 전체의 짙은 남색 띠로 바꿨다.
 * 보라·파랑 빛 번짐(천천히 흐름) + 옅은 격자 + 출처 이름 띠. 글자는 모두 서버에서 그린다 — 움직임은 CSS 뿐이고
 * 내려갈수록 빛이 흐려지는 것도 CSS(animation-timeline) 라 자바스크립트가 늦어도 화면은 그대로다.
 * 아래 "오늘의 숫자" 카드가 띠 끝에 반쯤 걸쳐 올라온다(Home.tsx 의 -mt).
 */
export default function HomeHero({
  index, hot, scope = "all", h1, sub, trust, placeholder, placeholderNarrow, eyebrow = "전국 공공 공고 · 매일 새벽 갱신", sources = SOURCES,
}: {
  index: Idx; hot: string[]; scope?: "all" | "business";
  /** 보이는 H1. 한 문장, 두 줄 안. 강조는 <em>. */
  h1: ReactNode;
  /** H1 밑 한 줄 설명. */
  sub: ReactNode;
  /** 신뢰 줄 조각(건수 · 갱신 · 출처 · 원문 링크). 빈 배열이면 안 그린다. */
  trust: ReactNode[];
  placeholder?: string; placeholderNarrow?: string;
  eyebrow?: string;
  /** 출처 띠. 빈 배열이면 안 그린다. */
  sources?: string[];
}) {
  return (
    <section className="hero-dark bleed relative isolate overflow-hidden pb-20 pt-9 text-center sm:pb-24 sm:pt-14">
      {/* 배경: 빛 번짐 셋 + 격자. 글자 뒤에 깔리는 장식이라 화면 읽기 프로그램에는 숨긴다. */}
      <div aria-hidden className="hero-bg">
        <span className="hero-glow hero-glow-a" />
        <span className="hero-glow hero-glow-b" />
        <span className="hero-glow hero-glow-c" />
        <span className="hero-grid" />
      </div>
      <div className="hero-copy relative mx-auto max-w-[64rem] px-5">
        <p className="mx-auto inline-flex items-center gap-2 rounded-pill border border-white/15 bg-white/[.06] px-3.5 py-1.5
                      text-[12px] font-bold tracking-[.06em] text-white/80 backdrop-blur">
          <span className="live-dot" aria-hidden />{eyebrow}
        </p>
        <h1 className="mx-auto mt-5 max-w-[26ch] text-[1.5rem] font-black leading-[1.25] tracking-[-.035em] break-keep text-white
                       sm:text-[2.6rem] [text-wrap:balance]">
          {h1}
        </h1>
        <p className="mx-auto mt-4 max-w-[38em] break-keep text-[14px] leading-relaxed text-white/70 sm:text-[15.5px]">{sub}</p>
        <div className="mx-auto mt-7 max-w-[46rem] sm:mt-8">
          <div className="hero-search">
            <PortalSearch index={index} hot={hot} scope={scope} size="xl" center autoFocus tone="dark"
                          placeholder={placeholder} placeholderNarrow={placeholderNarrow} />
          </div>
        </div>
        {trust.length > 0 && (
          <ul className="mx-auto mt-6 flex max-w-[48rem] flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[12.5px] text-white/65
                         [&_b]:text-white sm:mt-7"
              aria-label="자료에 대해">
            {trust.map((t, i) => (
              <li key={i} className="flex items-center gap-4">
                {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-white/30" />}
                <span>{t}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* 출처 띠. 두 벌을 이어 붙여 끊김 없이 돈다. 두 번째 벌은 화면 읽기 프로그램에 숨긴다. */}
      {sources.length > 0 && <div className="marquee relative mx-auto mt-8 max-w-[64rem] sm:mt-10" aria-label="자료 출처">
        <div className="marquee-track">
          {[0, 1].map((k) => (
            <ul key={k} className="marquee-set" aria-hidden={k === 1 || undefined}>
              {[...sources, ...sources].map((s, j) => (
                <li key={j} className="rounded-pill border border-white/10 bg-white/[.04] px-4 py-1.5 text-[13px] font-semibold text-white/60">
                  {s}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>}
    </section>
  );
}
