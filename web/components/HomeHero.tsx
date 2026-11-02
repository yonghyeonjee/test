import type { ReactNode } from "react";
import PortalSearch from "./PortalSearch";

type Idx = Record<string, { sido: string; full: string }>;

/**
 * 첫 화면 맨 위(2026-11-02). 약속 한 문장(보이는 H1) → 입력 하나 → 신뢰 줄.
 *
 * 전에는 H1 이 sr-only 였고, 보이는 첫 줄은 "오늘의 채용 브리핑" 회전 띠 제목이었다. 처음 온 사람이 여기가
 * 무엇을 해 주는 곳인지 3초 안에 알 수 없었고, 검색엔진도 제목·H1·본문이 같은 말을 하지 않았다.
 * 입력은 PortalSearch 하나다 — "서울 32세 무주택"처럼 적으면 parseQuery 가 지역·나이를 조건으로 읽는다.
 * 단계 찾기(StepFinder)는 아래 "내 조건으로 지원금 찾기" 갈래가 가리킨다.
 */
export default function HomeHero({
  index, hot, scope = "all", h1, sub, trust, placeholder, placeholderNarrow,
}: {
  index: Idx; hot: string[]; scope?: "all" | "business";
  /** 보이는 H1. 한 문장, 두 줄 안. */
  h1: ReactNode;
  /** H1 밑 한 줄 설명. */
  sub: ReactNode;
  /** 신뢰 줄 조각(건수 · 갱신 · 출처 · 원문 링크). 빈 배열이면 안 그린다. */
  trust: ReactNode[];
  placeholder?: string; placeholderNarrow?: string;
}) {
  return (
    <section className="pb-2 pt-7 text-center sm:pt-11">
      <h1 className="mx-auto max-w-[26ch] text-[1.5rem] font-black leading-[1.28] tracking-[-.03em] break-keep text-ink sm:text-[2.125rem] [text-wrap:balance]">
        {h1}
      </h1>
      <p className="mx-auto mt-3 max-w-[38em] break-keep text-[14px] leading-relaxed text-muted sm:text-[15px]">{sub}</p>
      <div className="mx-auto mt-6 max-w-[46rem] sm:mt-7">
        <PortalSearch index={index} hot={hot} scope={scope} size="xl" center autoFocus
                      placeholder={placeholder} placeholderNarrow={placeholderNarrow} />
      </div>
      {trust.length > 0 && (
        <ul className="mx-auto mt-5 flex max-w-[48rem] flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted sm:mt-6"
            aria-label="자료에 대해">
          {trust.map((t, i) => (
            <li key={i} className="flex items-center gap-4">
              {i > 0 && <span aria-hidden className="h-1 w-1 rounded-full bg-line2" />}
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
