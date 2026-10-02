import Link from "next/link";
import type { ReactNode } from "react";
import PortalSearch from "./PortalSearch";
import PortalIcon from "./PortalIcon";
import { SHORTCUTS } from "@/lib/nav";
import { applyStatus, daysLeft } from "@/lib/consts";
import { dueLabel, type Slide } from "@/lib/hotShared";
import type { Program } from "@/lib/db";

/**
 * 포털 첫 화면의 조각들. 네이버 첫 화면을 본떴다.
 *
 *  - 맨 위: 가운데 큰 알약 검색창 → 많이 찾는 말 → 색 아이콘 바로가기 한 줄.
 *  - 그 아래: 넓은 화면은 본문 + 오른쪽 기둥(300px), 휴대폰은 한 줄로 쌓는다.
 *    오른쪽 기둥은 네이버의 로그인 상자 자리에 "내 조건·알림"을 두고, 그 밑에
 *    많이 찾는 말 순위·마감 모음·정책지도를 둔다.
 */

type Idx = Record<string, { sido: string; full: string }>;

export function PortalTop({
  index, hot, scope = "all", h1, tagline, placeholder, placeholderNarrow, findHref = "/#find",
}: {
  index: Idx; hot: string[]; scope?: "all" | "business";
  /** 검색엔진이 읽는 쪽 제목. 휴대폰에서는 화면에 그리지 않는다(검색창이 먼저). */
  h1: string;
  /** 넓은 화면에서 검색창 위에 한 줄. */
  tagline: ReactNode;
  placeholder?: string; placeholderNarrow?: string;
  findHref?: string;
}) {
  return (
    <section className="pb-1 pt-4 sm:pt-9">
      <h1 className="sr-only">{h1}</h1>
      <p aria-hidden className="mb-4 hidden text-center text-[15px] font-semibold text-muted sm:block">{tagline}</p>
      <div className="mx-auto max-w-[46rem]">
        <PortalSearch index={index} hot={hot} scope={scope} size="xl" center autoFocus
                      placeholder={placeholder} placeholderNarrow={placeholderNarrow} />
      </div>
      <PortalShortcuts findHref={findHref} />
    </section>
  );
}

/** 색 아이콘 바로가기 열 칸. 휴대폰은 흰 카드 안에 5칸×2줄, 넓은 화면은 한 줄. */
export function PortalShortcuts({ findHref = "/#find" }: { findHref?: string }) {
  return (
    <nav aria-label="바로가기"
         className="mx-auto mt-4 grid max-w-[46rem] grid-cols-5 gap-y-3 rounded-card bg-white px-1 py-3.5 ring-1 ring-inset ring-line
                    sm:mt-7 sm:grid-cols-10 sm:bg-transparent sm:px-0 sm:py-0 sm:ring-0">
      {SHORTCUTS.map((s) => (
        <Link key={s.label} href={s.href === "/#find" ? findHref : s.href}
              className="group flex flex-col items-center gap-1.5 text-center">
          <span className={`flex h-12 w-12 items-center justify-center rounded-[16px] transition-transform duration-150
                            group-hover:-translate-y-0.5 group-active:scale-95 ${s.tone}`}>
            <PortalIcon name={s.icon} className="h-6 w-6" strokeWidth={2} />
          </span>
          <span className="whitespace-nowrap text-[12px] font-semibold tracking-[-.02em] text-ink2 sm:text-[12.5px]">{s.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** 본문 + 오른쪽 기둥. 휴대폰에서는 본문 다음에 기둥이 온다. */
export function PortalColumns({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="mt-6 grid gap-6 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="min-w-0 space-y-6">{main}</div>
      <aside aria-label="한눈에 보기" className="min-w-0 space-y-4">{aside}</aside>
    </div>
  );
}

/** 오른쪽 기둥의 상자. */
export function Box({ title, sub, more, moreLabel = "더보기", className = "", children }: {
  title: ReactNode; sub?: string; more?: string; moreLabel?: string; className?: string; children: ReactNode;
}) {
  return (
    <section className={`card p-4 ${className}`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-extrabold tracking-[-.02em]">{title}</h2>
        {sub && <span className="min-w-0 flex-1 truncate text-[12px] text-faint">{sub}</span>}
        {more && (
          <Link href={more} className="-my-1.5 shrink-0 py-1.5 text-[12.5px] font-semibold text-muted hover:text-ink">
            {moreLabel} ›
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** 많이 찾는 말 순위. 1~5 왼쪽, 6~10 오른쪽. 앞 세 개는 브랜드 색. */
export function HotRank({ terms, base = "/search", sub, className = "" }: {
  terms: string[]; base?: string; sub?: string; className?: string;
}) {
  if (!terms.length) return null;
  return (
    <Box title="많이 찾는 말" sub={sub} className={className}>
      <ol className="grid grid-flow-col grid-rows-5 gap-x-3">
        {terms.slice(0, 10).map((t, i) => (
          <li key={t} className="min-w-0">
            <Link href={`${base}?q=${encodeURIComponent(t)}`}
                  className="flex items-center gap-2 py-1.5 text-[13.5px] text-ink2 hover:text-brand">
              <span className={`num w-4 shrink-0 text-center text-[13px] font-extrabold ${i < 3 ? "text-brand" : "text-faint"}`}>{i + 1}</span>
              <span className="truncate">{t}</span>
            </Link>
          </li>
        ))}
      </ol>
    </Box>
  );
}

const KIND: Record<Slide["kind"], { label: string; cls: string }> = {
  pin: { label: "지원금", cls: "bg-cat-greenSoft text-cat-green" },
  exam: { label: "시험", cls: "bg-cat-orangeSoft text-cat-orange" },
  job: { label: "채용", cls: "bg-cat-blueSoft text-cat-blue" },
  biz: { label: "기업", cls: "bg-cat-violetSoft text-cat-violet" },
};

/** 남은 날 배지. 사흘 안은 빨강, 이레 안은 주황. */
export function DueBadge({ days }: { days: number }) {
  const cls = days <= 3 ? "bg-alertSoft text-alert" : days <= 7 ? "bg-accentSoft text-accent" : "bg-ground text-muted";
  return <span className={`num shrink-0 rounded-pill px-2 py-0.5 text-[12px] font-bold ${cls}`}>{dueLabel(days)}</span>;
}

/** 놓치기 쉬운 마감 모음(지원금·시험·채용·기업). 휴대폰은 위쪽 돌림 띠가 같은 것을 보여 준다. */
export function DeadlineList({ slides, className = "" }: { slides: Slide[]; className?: string }) {
  if (!slides.length) return null;
  return (
    <Box title="놓치면 안 되는 마감" className={className}>
      <ul className="divide-y divide-line">
        {slides.slice(0, 6).map((s) => (
          <li key={s.key}>
            <Link href={s.href} className="group flex items-center gap-2 py-2">
              <span className={`shrink-0 rounded-[6px] px-1.5 py-0.5 text-[12px] font-bold ${KIND[s.kind].cls}`}>{KIND[s.kind].label}</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink2 group-hover:text-ink">{s.title}</span>
              <DueBadge days={s.days} />
            </Link>
          </li>
        ))}
      </ul>
    </Box>
  );
}

/** 정책지도 입구. */
export function MapCard({ className = "" }: { className?: string }) {
  return (
    <Link href="/map" className={`card card-link flex items-center gap-3 p-4 ${className}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-cat-redSoft text-cat-red">
        <PortalIcon name="map" className="h-6 w-6" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <b className="block text-[15px] font-extrabold">정책지도</b>
        <span className="block text-[12.5px] leading-snug text-muted">내 주변 지원사업·채용을 지도에서 봅니다</span>
      </span>
      <PortalIcon name="chevron" className="ml-auto h-4 w-4 shrink-0 text-faint" />
    </Link>
  );
}

/** 나라지원 소개 한 상자. 첫 화면 아래의 긴 소개 덩어리를 대신한다. */
export function AboutBox({ total, closing, className = "" }: { total: number; closing: number; className?: string }) {
  return (
    <Box title="나라지원은" more="/about" moreLabel="소개" className={className}>
      <p className="num text-[13.5px] leading-relaxed text-ink2">
        공공데이터 <b className="font-extrabold text-ink">{total.toLocaleString("ko-KR")}</b>건을 매일 새벽 모읍니다.
        {closing > 0 && <> 2주 안에 마감되는 것이 <b className="font-extrabold text-accent">{closing.toLocaleString("ko-KR")}</b>건입니다.</>}
      </p>
      <ul className="mt-2.5 space-y-1 text-[13px] text-muted">
        {["회원가입 없이", "주민등록번호 안 받음", "모든 공고에 원문 링크"].map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <PortalIcon name="check" className="h-4 w-4 text-cat-green" strokeWidth={2.4} />{t}
          </li>
        ))}
      </ul>
    </Box>
  );
}

/** 공고 한 줄: 제목 · 기관/지역 · 남은 날. 포털의 촘촘한 목록. */
export function ProgramLine({ p, fresh = false }: { p: Program; fresh?: boolean }) {
  const st = applyStatus(p);
  const left = daysLeft(p);
  const place = p.sigungu || p.sido || "전국";
  return (
    <li>
      <Link href={`/p/${encodeURIComponent(p.source_id)}`} className="group flex items-center gap-3 py-2.5">
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[14.5px] font-semibold text-ink group-hover:text-brand">{p.title}</b>
          <span className="mt-0.5 block truncate text-[12.5px] text-muted">{[p.org_name, place].filter(Boolean).join(" · ")}</span>
        </span>
        {st === "always" ? (
          <span className="shrink-0 rounded-pill bg-cat-blueSoft px-2 py-0.5 text-[12px] font-bold text-cat-blue">상시</span>
        ) : st === "upcoming" ? (
          <span className="shrink-0 rounded-pill bg-ground px-2 py-0.5 text-[12px] font-bold text-muted">예정</span>
        ) : st === "closed" ? (
          <span className="shrink-0 rounded-pill bg-ground px-2 py-0.5 text-[12px] font-bold text-faint">마감</span>
        ) : left !== null && left <= 30 ? (
          <DueBadge days={left} />
        ) : fresh ? (
          <span className="shrink-0 rounded-pill bg-cat-greenSoft px-2 py-0.5 text-[12px] font-bold text-cat-green">새로</span>
        ) : (
          <span className="shrink-0 rounded-pill bg-cat-greenSoft px-2 py-0.5 text-[12px] font-bold text-cat-green">접수 중</span>
        )}
      </Link>
    </li>
  );
}
