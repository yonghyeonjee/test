"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import BigText from "./BigText";
import { HeaderFx } from "./Motion";
import { BrandMark } from "./Illus";
import PortalIcon from "./PortalIcon";
import TopSearch from "./TopSearch";
import { NAV, WRAP, current, hit } from "@/lib/nav";

/** 첫 화면(복지·기업)에서는 큰 검색창이 바로 아래 있다. 머리말 검색창을 겹쳐 두지 않는다. */
const isHome = (p: string | null) => p === "/" || p === "/business";
/** 쪽 안에 큰 검색창이 있는 곳(첫 화면·검색 결과). 머리말 검색창을 겹쳐 두지 않는다. */
// 검색 결과 화면은 본문 맨 위에 큰 검색창이 있어 머리말에는 두지 않는다. 첫 화면은 내려 읽다가도 찾게 머리말에도 둔다.
const hasOwnSearch = (p: string | null) => p === "/search" || p === "/business/search";

/**
 * 머리말. 화면 폭 전체의 흰 띠.
 *
 *  - 첫 줄: 로고 · 검색창(검색 결과 화면만 뺀다) · 글자 크게.
 *  - 둘째 줄: 갈래 탭. 고른 갈래는 굵게, 아래 보라 줄(네이버의 판 탭처럼).
 *  - 갈래 안에 들어와 있으면 그 하위 메뉴가 머리말 밑에 한 줄 더(붙박이 아님).
 *
 * 예전에는 짙은 보라 띠가 둥근 상자로 떠 있어 관공서 화면처럼 무거웠다.
 */
export function SiteHeader({ index = {} }: { index?: Record<string, { sido: string; full: string }> }) {
  const path = usePathname();
  if (path?.startsWith("/admin")) return null;
  const { open, leaf } = current(path);
  const home = isHome(path);
  return (
    <>
      <header data-site-header>
        <HeaderFx />
        <div className={WRAP}>
          <div className="flex h-14 items-center justify-between gap-3 sm:h-[60px]">
            <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="나라지원 첫 화면">
              <BrandMark className="h-7 w-7" />
              <span className="display text-[1.35rem] text-ink sm:text-[1.45rem]">나라지원</span>
              {home && (
                <span className="ml-1 hidden border-l border-line pl-3 text-[13px] font-medium text-muted lg:inline">
                  정부지원금 · 채용 · 자격증 검색
                </span>
              )}
            </Link>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              {!hasOwnSearch(path) && <TopSearch index={index} />}
              <BigText />
            </div>
          </div>

          {/* 휴대폰에서는 아래 탭 막대(홈·검색·정책지도·채용·전체)가 같은 일을 해서 위 메뉴 줄을 접는다. */}
          <nav aria-label="주 메뉴"
               className="menu-band -mx-5 hidden overflow-x-auto px-2 text-[15px] [scrollbar-width:none] sm:flex
                          sm:mx-0 sm:-ml-3 sm:px-0 [&::-webkit-scrollbar]:hidden">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}
                    aria-current={open ? (open.href === n.href ? "page" : undefined) : hit(path, n) ? "page" : undefined}
                    className="shrink-0 px-3 py-2.5 font-semibold transition-colors">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* 첫 화면에서는 하위 메뉴 줄을 두지 않는다 — 검색창이 바로 머리말 밑에 와야 한다. */}
      {open?.sub && !home && (
        <div className={WRAP}>
          <nav aria-label={`${open.label} 하위 메뉴`}
               className="-mx-5 flex gap-1 overflow-x-auto px-3 pt-3 text-[13.5px] [scrollbar-width:none]
                          sm:mx-0 sm:-ml-1 sm:px-0 [&::-webkit-scrollbar]:hidden">
            {open.sub.map((t) => (
              <Link key={t.href} href={t.href} aria-current={leaf === t ? "page" : undefined}
                    className={`shrink-0 rounded-pill px-3 py-1.5 font-semibold transition-colors ${
                      leaf === t ? "bg-ink text-white" : "text-muted hover:bg-surface hover:text-ink"}`}>
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}

const SOURCES: [string, string][] = [
  ["복지로", "https://www.bokjiro.go.kr"], ["기업마당", "https://www.bizinfo.go.kr"],
  ["소상공인24", "https://www.sbiz24.kr"], ["나라일터", "https://www.gojobs.go.kr"], ["월드잡플러스", "https://www.worldjob.or.kr"],
  ["큐넷", "https://www.q-net.or.kr"], ["주택금융공사", "https://www.hf.go.kr"],
  ["한국장학재단", "https://www.kosaf.go.kr"], ["알리오 플러스", "https://www.alioplus.go.kr"],
  ["공공데이터포털", "https://www.data.go.kr"],
];

/**
 * 꼬리말. 밝은 회색 띠에 짧게.
 * 넓은 화면은 갈래별 링크 세 묶음, 휴대폰은 한 줄 링크와 고지문만 — 짙고 긴
 * 꼬리말이 휴대폰에서 두 화면을 차지했다.
 */
export function SiteFooter() {
  const path = usePathname();
  if (path?.startsWith("/admin")) return null;
  const cols: { h: string; items: [string, string][] }[] = [
    { h: "찾기", items: [["통합 검색", "/search"], ["정책지도", "/map"], ["내 조건으로 찾기", "/"], ["기업·창업 지원", "/business"], ["분야별", "/topic"], ["지역별", "/#areas"], ["정책 전체", "/policies"]] },
    { h: "정보", items: [["공공기관 채용", "/jobs"], ["지역별 채용", "/jobs/region"], ["기관별 채용 이력", "/jobs/org"], ["자격증·시험 일정", "/license"], ["생활금융 금리", "/money"], ["주거 지원", "/housing"], ["공공기관 사업", "/agency"]] },
    { h: "읽을거리", items: [["지원금 안내 글", "/blog"], ["블로그", "/story"], ["소득 기준 계산기", "/blog/income"], ["무료 서비스", "/free"], ["서비스 소개", "/about"], ["개인정보 처리방침", "/privacy"]] },
  ];
  const quick: [string, string][] = [["서비스 소개", "/about"], ["개인정보 처리방침", "/privacy"], ["통합 검색", "/search"], ["정책지도", "/map"], ["무료 서비스", "/free"]];
  return (
    <footer className="mt-20 border-t border-line bg-white text-[13px] text-muted">
      <div className={`${WRAP} pb-8 pt-9 sm:pt-12`}>
        <div className="grid gap-8 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <p className="flex items-center gap-2"><BrandMark className="h-6 w-6" /><span className="display text-[1.2rem] text-ink">나라지원</span></p>
            <p className="mt-3 max-w-[22rem] leading-relaxed">
              모르고 지나칠 정부 지원 혜택을 찾는 검색 서비스입니다. 공공데이터포털 등에 공개된
              자료를 매일 새벽 색인합니다.
            </p>
            {/* 휴대폰: 갈래 묶음 대신 한 줄 링크 */}
            <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 md:hidden">
              {quick.map(([label, href]) => (
                <Link key={href} href={href} className="py-1.5 font-semibold text-ink2 hover:text-ink">{label}</Link>
              ))}
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.h} className="hidden md:block">
              <p className="text-[12.5px] font-bold text-ink">{c.h}</p>
              <ul className="mt-2 space-y-0.5">
                {c.items.map(([label, href]) => (
                  <li key={href}><Link href={href} className="inline-block py-1 hover:text-ink">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-8 border-t border-line pt-5 text-[12px] leading-relaxed text-faint">
          화면의 조건은 공고 원문에서 자동으로 추려낸 것이라 실제와 다를 수 있습니다. 신청 자격의 최종
          확인과 접수는 원문 또는 관할 주민센터를 통해 하시기 바랍니다. 정부 공식 서비스가 아닙니다.
        </p>
        {/* 자료 출처: 넓은 화면은 한 줄로 늘 보이고, 휴대폰은 접어 둔다. */}
        <p className="mt-3 hidden flex-wrap items-center gap-x-3 text-[12px] text-faint md:flex">
          <span className="font-bold text-muted">자료 출처</span>
          {SOURCES.map(([name, href]) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="inline-block py-1.5 hover:text-ink">{name}</a>
          ))}
        </p>
        <details className="mt-3 text-[12px] text-faint md:hidden">
          <summary className="cursor-pointer py-1 font-bold text-muted">자료 출처</summary>
          <p className="flex flex-wrap gap-x-3">
            {SOURCES.map(([name, href]) => (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="inline-block py-1.5 hover:text-ink">{name}</a>
            ))}
          </p>
        </details>
        <p className="mt-3 text-[12px] text-faint">© 나라지원</p>
      </div>
    </footer>
  );
}

/** 아래 탭 막대의 칸. sheet 는 전체 메뉴를 연다. */
const TABS: { href?: string; label: string; icon: string; on?: (p: string) => boolean; sheet?: true; search?: true }[] = [
  { href: "/", label: "홈", icon: "home", on: (p) => p === "/" || p === "/business" },
  { href: "/search", label: "검색", icon: "search", search: true, on: (p) => p === "/search" || p === "/business/search" },
  { href: "/map", label: "정책지도", icon: "map", on: (p) => p === "/map" },
  { href: "/jobs", label: "채용", icon: "jobs", on: (p) => p === "/jobs" || p.startsWith("/jobs/") },
  { label: "전체", icon: "menu", sheet: true },
];

/**
 * 휴대폰 아래 탭 막대. 엄지가 닿는 자리에 홈·검색·정책지도·채용·전체.
 *
 * 머리말은 휴대폰에서 붙박이가 아니라 스크롤하면 사라진다. 긴 화면을 읽다가
 * 다른 곳으로 가려면 맨 위까지 올라가야 했다 — 이 막대가 그 일을 한다.
 * "검색"은 화면에 큰 검색창이 있으면 거기로 초점을 옮기고(자판이 바로 뜬다),
 * 없으면 검색 화면으로 간다.
 */
export function BottomBar() {
  const path = usePathname() ?? "/";
  const [sheet, setSheet] = useState(false);
  useEffect(() => { setSheet(false); }, [path]);
  useEffect(() => {
    if (!sheet) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setSheet(false);
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [sheet]);
  if (path.startsWith("/admin")) return null;

  const focusSearch = (e: React.MouseEvent) => {
    const input = document.querySelector<HTMLInputElement>("input[data-portal-search]");
    if (!input) return;
    e.preventDefault();
    input.scrollIntoView({ block: "center" });
    input.focus();
  };

  return (
    <>
      {/* 막대 높이만큼 문서 끝을 띄운다. 꼬리말 마지막 줄이 가리지 않게. */}
      <div aria-hidden className="h-[calc(60px+env(safe-area-inset-bottom))] sm:hidden" />
      <nav aria-label="빠른 이동"
           className="bottom-bar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur sm:hidden">
        <ul className="grid h-[60px] grid-cols-5">
          {TABS.map((t) => {
            const on = t.on?.(path) ?? false;
            const cls = `flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
              on || (t.sheet && sheet) ? "text-ink" : "text-faint"}`;
            const ic = <PortalIcon name={t.icon} className="h-[22px] w-[22px]" strokeWidth={on ? 2.3 : 1.9} />;
            return (
              <li key={t.label}>
                {t.sheet ? (
                  <button type="button" onClick={() => setSheet(true)} aria-expanded={sheet} className={`${cls} w-full`}>
                    {ic}{t.label}
                  </button>
                ) : (
                  <Link href={t.href!} onClick={t.search ? focusSearch : undefined}
                        aria-current={on ? "page" : undefined} className={cls}>
                    {ic}{t.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      {sheet && <MenuSheet onClose={() => setSheet(false)} />}
    </>
  );
}

/** 전체 메뉴. 갈래와 그 하위 메뉴를 한 화면에 펼친다(네이버 '전체 서비스' 자리). */
function MenuSheet({ onClose }: { onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="전체 메뉴"
         className="fixed inset-0 z-50 overflow-y-auto bg-ground sm:hidden">
      <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-white px-5">
        <b className="text-[17px] font-extrabold">전체 메뉴</b>
        <button type="button" onClick={onClose} aria-label="닫기"
                className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-ink2 hover:bg-ground">
          <PortalIcon name="close" className="h-6 w-6" />
        </button>
      </div>
      <div className="space-y-3 px-4 py-4 pb-24">
        <Link href="/search" onClick={onClose}
              className="flex items-center gap-2 rounded-pill border-2 border-brand bg-white px-4 py-3 text-[15px] text-faint">
          <PortalIcon name="search" className="h-5 w-5 text-brand" strokeWidth={2.2} />
          무엇이든 찾아보세요
        </Link>
        <Link href="/blog/youth-future-savings" onClick={onClose}
              className="flex items-center gap-2 rounded-card bg-brand px-4 py-3 text-[14.5px] font-bold text-white">
          <PortalIcon name="fire" className="h-5 w-5" /> HOT 정부지원 — 청년미래적금 안내
        </Link>
        {NAV.map((n) => (
          <section key={n.href} className="rounded-card bg-white px-4 py-3">
            <Link href={n.href} onClick={onClose} className="flex items-center justify-between py-1 text-[15.5px] font-extrabold">
              {n.label}
              <PortalIcon name="chevron" className="h-4 w-4 text-faint" />
            </Link>
            {n.sub && (
              <ul className="mt-1 grid grid-cols-2 gap-x-3">
                {n.sub.map((t) => (
                  <li key={t.href}>
                    <Link href={t.href} onClick={onClose} className="block py-1.5 text-[14px] text-muted hover:text-ink">{t.label}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <div className="flex items-center justify-between rounded-card bg-white px-4 py-3 text-[14px]">
          <span className="font-semibold">글자 크기</span>
          <BigText />
        </div>
      </div>
    </div>
  );
}
