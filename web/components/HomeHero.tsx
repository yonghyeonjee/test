import type { ReactNode } from "react";
import Link from "next/link";
import PortalSearch from "./PortalSearch";
import DuoIcon from "./DuoIcon";
import { daysLeft } from "@/lib/consts";
import { dueLabel } from "@/lib/hotShared";
import type { Program } from "@/lib/db";

type Idx = Record<string, { sido: string; full: string }>;

/** 자료를 가져오는 곳. 띠로 흘러간다(움직임 줄이기 설정이면 멈춘 한 줄). */
const SOURCES = ["복지로", "기업마당", "나라일터", "잡알리오", "큐넷", "고용24", "공공데이터포털"];

/**
 * 첫 화면 맨 위. 약속 한 문장(보이는 H1) → 입력 하나 → 신뢰 줄.
 *
 * 2026-11-25(2차) 짙은 남색 띠는 남의 사이트(가전 구독) 느낌이라는 말에 밝은 하늘빛으로 다시 입혔다.
 * 복지·보조금 포털의 색감: 흰 바탕에 맑은 파랑, 민트·노랑 점, 면을 채운 둥근 아이콘.
 * 넓은 화면은 오른쪽에 "지금 마감이 가까운 실제 공고" 석 장이 떠 있다(picks) — 장식이 아니라 눌러서 가는 카드다.
 * 카드는 저마다 다른 빠르기로 스크롤을 따라 흘러간다(CSS animation-timeline, 지원 브라우저만).
 * 2026-11-25(3차) 휴대폰에서 띠가 한 화면을 다 먹는다는 말에: 휴대폰은 제목 → 검색창 → 많이 찾는 말만 남기고
 * 알약·설명·신뢰 줄·출처 띠를 접었다(넓은 화면은 그대로). 숫자 카드와 갈래가 첫 화면에 들어온다.
 * 글자는 모두 서버에서 그린다. 아래 "오늘의 숫자" 카드가 띠 끝에 걸쳐 올라온다(Home.tsx 의 -mt).
 */
export default function HomeHero({
  index, hot, scope = "all", h1, sub, trust, placeholder, placeholderNarrow,
  eyebrow = "전국 공공 공고 · 매일 새벽 갱신", sources = SOURCES, picks = [],
}: {
  index: Idx; hot: string[]; scope?: "all" | "business";
  /** 보이는 H1. 한 문장, 두 줄 안. 강조는 <em>. */
  h1: ReactNode;
  /** H1 밑 한 줄 설명. */
  sub: ReactNode;
  /** 신뢰 줄 조각(건수 · 갱신 · 원문 링크). 빈 배열이면 안 그린다. */
  trust: ReactNode[];
  placeholder?: string; placeholderNarrow?: string;
  eyebrow?: string;
  /** 출처 띠. 빈 배열이면 안 그린다. */
  sources?: string[];
  /** 오른쪽에 띄울 실제 공고(마감 임박 순). 셋 미만이면 그림만 그린다. */
  picks?: Program[];
}) {
  const cards = picks.slice(0, 3);
  const wide = cards.length === 3;
  return (
    <section className="hero-sky bleed relative isolate overflow-hidden pb-16 pt-5 sm:pb-24 sm:pt-12">
      {/* 배경: 빛 번짐 셋 + 점무늬. 글자 뒤 장식이라 화면 읽기 프로그램에는 숨긴다. */}
      <div aria-hidden className="hero-bg">
        <span className="hero-blob hero-blob-a" />
        <span className="hero-blob hero-blob-b" />
        <span className="hero-blob hero-blob-c" />
        <span className="hero-dots" />
      </div>
      <div className={`relative mx-auto max-w-[64rem] px-5 ${wide ? "lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center lg:gap-10" : ""}`}>
        <div className={`hero-copy text-center ${wide ? "lg:text-left" : ""}`}>
          <p className="hidden items-center gap-2 rounded-pill border border-brand/15 sm:inline-flex bg-surface/80 px-3.5 py-1.5
                        text-[12px] font-bold tracking-[.02em] text-brand shadow-card backdrop-blur">
            <span className="live-dot" aria-hidden />{eyebrow}
          </p>
          <h1 className={`mx-auto max-w-[26ch] text-[1.4rem] sm:mt-4 font-black leading-[1.28] tracking-[-.035em] break-keep text-ink
                          sm:text-[2.3rem] [text-wrap:balance] ${wide ? "lg:mx-0 lg:max-w-none lg:text-[2.05rem]" : ""}`}>
            {h1}
          </h1>
          <p className={`mx-auto mt-3.5 hidden max-w-[38em] sm:block break-keep text-[14px] leading-relaxed text-muted sm:text-[15.5px] ${wide ? "lg:mx-0" : ""}`}>{sub}</p>
          <div className={`mx-auto mt-4 max-w-[46rem] sm:mt-7 ${wide ? "hero-search-left lg:mx-0" : ""}`}>
            <div className="hero-search">
              <PortalSearch index={index} hot={hot} scope={scope} size="xl" center autoFocus
                            placeholder={placeholder} placeholderNarrow={placeholderNarrow} />
            </div>
          </div>
          {trust.length > 0 && (
            <ul className={`mx-auto mt-5 hidden max-w-[48rem] sm:flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted sm:mt-6
                            ${wide ? "lg:mx-0 lg:justify-start" : ""}`}
                aria-label="자료에 대해">
              {trust.map((t, i) => (
                <li key={i} className="flex items-center gap-4">
                  {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-line2" />}
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 오른쪽: 실제 마감 임박 공고 석 장 + 떠 있는 아이콘. 넓은 화면에서만. */}
        {wide && (
          <div className="hero-stack relative hidden h-[400px] lg:block" aria-label="마감이 가까운 공고">
            <span aria-hidden className="float-ic float-ic-a"><DuoIcon name="find" className="h-14 w-14" /></span>
            <span aria-hidden className="float-ic float-ic-b"><DuoIcon name="license" className="h-12 w-12" /></span>
            <span aria-hidden className="float-ic float-ic-c"><DuoIcon name="map" className="h-12 w-12" /></span>
            {cards.map((p, i) => {
              const left = daysLeft(p);
              return (
                <Link key={p.id} href={`/p/${encodeURIComponent(p.source_id)}`} className={`pick pick-${i + 1}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="rounded-pill bg-brandSoft px-2 py-0.5 text-[11.5px] font-bold text-brand">{p.sigungu || p.sido || "전국"}</span>
                    {left !== null && left >= 0 && (
                      <span className={`num rounded-pill px-2 py-0.5 text-[11.5px] font-bold ${left <= 3 ? "bg-alertSoft text-alert" : "bg-accentSoft text-accent"}`}>{dueLabel(left)}</span>
                    )}
                  </span>
                  <b className="mt-2 line-clamp-2 text-[14.5px] font-extrabold leading-snug tracking-[-.02em] text-ink break-keep">{p.title}</b>
                  {p.org_name && <span className="mt-1 block truncate text-[12px] text-muted">{p.org_name}</span>}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 출처 띠. 두 벌을 이어 붙여 끊김 없이 돈다. 두 번째 벌은 화면 읽기 프로그램에 숨긴다. */}
      {sources.length > 0 && (
        <div className="marquee relative mx-auto mt-8 hidden max-w-[64rem] sm:mt-10 sm:block" aria-label="자료 출처">
          <div className="marquee-track">
            {[0, 1].map((k) => (
              <ul key={k} className="marquee-set" aria-hidden={k === 1 || undefined}>
                {[...sources, ...sources].map((s, j) => (
                  <li key={j} className="flex items-center gap-1.5 rounded-pill border border-line bg-surface/70 px-4 py-1.5 text-[13px] font-semibold text-muted">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand2" />{s}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
