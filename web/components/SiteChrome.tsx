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
  // 휴대폰 갈래 탭은 가로로 넘친다. 고른 갈래가 보이게 그 줄만 옆으로 민다(쪽은 안 움직인다).
  useEffect(() => {
    const band = document.querySelector<HTMLElement>("nav.menu-band");
    const on = band?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!band || !on) return;
    const want = on.offsetLeft - (band.clientWidth - on.offsetWidth) / 2;
    band.scrollTo({ left: Math.max(0, want) });
  }, [path]);
  if (path?.startsWith("/admin")) return null;
  const { open, leaf } = current(path);
  const home = isHome(path);
  return (
    <>
      <header data-site-header>
        <HeaderFx />
        <div className={WRAP}>
          <div className="flex h-14 items-center justify-between gap-3 sm:h-[60px]">
            <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="K나라지원 첫 화면">
              <BrandMark className="h-7 w-7" />
              <span className="display text-[1.35rem] text-ink sm:text-[1.45rem]"><span className="text-brand">K</span>나라지원</span>
              {home && (
                <span className="ml-1 hidden border-l border-line pl-3 text-[13px] font-medium text-muted lg:inline">
                  정부지원금 · 채용 · 자격증 검색
                </span>
              )}
            </Link>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
              {!hasOwnSearch(path) && <TopSearch index={index} />}
              {/* 저장한 공고·사업. 공고 쪽 "저장"을 누른 사람이 다시 찾는 입구 — 머리말에 늘 보인다. */}
              <Link href="/saved" aria-label="저장한 공고·사업" aria-current={path === "/saved" ? "page" : undefined}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-ground sm:h-10 sm:w-10 ${
                      path === "/saved" ? "text-brand" : "text-ink2"}`}>
                <PortalIcon name="bookmark" className="h-6 w-6 sm:h-[22px] sm:w-[22px]" strokeWidth={2} />
              </Link>
              <div className="hidden sm:block"><BigText /></div>
              {/* 휴대폰: 전체 메뉴. 글자 크기 단추는 그 안에 있다. 아래 탭 막대는 광고 띠에 가려 치웠다(2026-10-13). */}
              <button type="button" onClick={() => setSheet(true)} aria-expanded={sheet} aria-label="전체 메뉴"
                      className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink2 hover:bg-ground sm:hidden">
                <PortalIcon name="menu" className="h-6 w-6" strokeWidth={2.1} />
              </button>
            </div>
          </div>

          {/* 갈래 탭. 휴대폰에서도 머리말이 위에 붙어 따라오니 이 줄이 늘 손 닿는 곳에 있다. */}
          <nav aria-label="주 메뉴"
               className="menu-band -mx-5 flex overflow-x-auto px-2 text-[14.5px] [scrollbar-width:none]
                          sm:mx-0 sm:-ml-3 sm:px-0 sm:text-[15px] [&::-webkit-scrollbar]:hidden">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}
                    aria-current={open ? (open.href === n.href ? "page" : undefined) : hit(path, n) ? "page" : undefined}
                    className="shrink-0 whitespace-nowrap px-2.5 py-2 font-semibold transition-colors sm:px-3 sm:py-2.5">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {sheet && <MenuSheet onClose={() => setSheet(false)} />}

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
    { h: "찾기", items: [["통합 검색", "/search"], ["정책지도", "/map"], ["내 조건으로 찾기", "/"], ["기업·창업 지원", "/business"], ["분야별", "/topic"], ["지역별", "/#areas"], ["정책 전체", "/policies"], ["저장한 공고·사업", "/saved"]] },
    { h: "정보", items: [["공공기관 채용", "/jobs"], ["지역별 채용", "/jobs/region"], ["기관별 채용 이력", "/jobs/org"], ["자격증·시험 일정", "/license"], ["생활금융 금리", "/money"], ["주거 지원", "/housing"], ["공공기관 사업", "/agency"]] },
    { h: "읽을거리", items: [["지원금 안내 글", "/blog"], ["블로그", "/story"], ["소득 기준 계산기", "/blog/income"], ["무료 서비스", "/free"], ["서비스 소개", "/about"], ["개인정보 처리방침", "/privacy"]] },
  ];
  const quick: [string, string][] = [["서비스 소개", "/about"], ["개인정보 처리방침", "/privacy"], ["통합 검색", "/search"], ["정책지도", "/map"], ["무료 서비스", "/free"]];
  return (
    <footer className="mt-20 border-t border-line bg-white text-[13px] text-muted">
      <div className={`${WRAP} pb-8 pt-9 sm:pt-12`}>
        <div className="grid gap-8 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <p className="flex items-center gap-2"><BrandMark className="h-6 w-6" /><span className="display text-[1.2rem] text-ink"><span className="text-brand">K</span>나라지원</span></p>
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
        <p className="mt-3 text-[12px] text-faint">© K나라지원</p>
      </div>
    </footer>
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
        <div className="grid grid-cols-2 gap-2">
          <Link href="/saved" onClick={onClose} className="flex items-center gap-2 rounded-card bg-white px-4 py-3 text-[14.5px] font-bold">
            <PortalIcon name="bookmark" className="h-5 w-5 text-brand" /> 저장한 공고
          </Link>
          <Link href="/account" onClick={onClose} className="flex items-center gap-2 rounded-card bg-white px-4 py-3 text-[14.5px] font-bold">
            <PortalIcon name="user" className="h-5 w-5 text-brand" /> 내 계정
          </Link>
        </div>
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
