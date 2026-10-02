"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { describe, parseQuery, toParams } from "@/lib/parse";
import { HOT_WELFARE, relatedTerms, suggest } from "@/lib/thesaurus";
import { tokenize } from "@/lib/keywords";
import { track } from "./Gtm";

type Idx = Record<string, { sido: string; full: string }>;

const clean = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/**
 * 포털의 큰 검색창. 어디서든 한 줄 적으면 복지·기업·채용·자격증·공공기관·
 * 안내 글을 한 번에 찾는다.
 *
 *  - 적는 중에 낱말 추천(앞글자 → 포함)과, 조건으로 알아들은 것(지역·나이)을 보여 준다.
 *  - 연관어를 같이 찾는다는 것을 미리 말해 준다("경비 → 경호·보안도").
 *  - 화살표로 고르고 Enter 로 간다. 서버는 부르지 않는다 — 추천은 코드 안 목록이다.
 *  - 자동 초점은 마우스가 있는 넓은 화면에서만. 휴대폰에서 자판이 먼저 올라오면
 *    첫 화면이 밀려 올라간다.
 */
export default function PortalSearch({
  index = {}, initial = "", size = "lg", autoFocus = false, hot = HOT_WELFARE, placeholder, placeholderNarrow,
  scope = "all", center = false,
}: {
  index?: Idx; initial?: string;
  /** xl: 첫 화면 한가운데(네이버 첫 화면 검색창 크기). lg: 검색 화면. md: 작은 자리. */
  size?: "xl" | "lg" | "md"; autoFocus?: boolean;
  /** 많이 찾는 말을 가운데로(첫 화면). */
  center?: boolean;
  /** 아래에 붙는 "많이 찾는 말". 빈 배열이면 안 그린다. */
  hot?: string[];
  placeholder?: string;
  /** 휴대폰에서 쓸 짧은 보기글. 없으면 placeholder 를 줄인다. */
  placeholderNarrow?: string;
  /** business 면 사업자 검색(/business/search)으로 간다. 기업 첫 화면이 쓴다. */
  scope?: "all" | "business";
}) {
  const base = scope === "business" ? "/business/search" : "/search";
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState(-1);
  // 휴대폰에서는 긴 보기글이 잘린다. 처음 그릴 때는 서버와 같게(넓은 화면 기준) 두고
  // 붙은 뒤에 바꾼다 — 그래야 서버 HTML 과 어긋나지 않는다.
  const [narrow, setNarrow] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const map = useMemo(() => new Map(Object.entries(index)), [index]);
  const parsed = useMemo(() => parseQuery(q, map), [q, map]);
  // 낱말("‘경비’ 포함")은 조건이 아니다. 지역·나이·상태·가구만 조건으로 보여 준다.
  const bits = describe(parsed).filter((b) => !b.endsWith(" 포함"));
  const words = useMemo(() => tokenize(q), [q]);
  const related = useMemo(() => relatedTerms(words, 5), [words]);
  const last = q.trim().split(/\s+/).pop() ?? "";
  const items = useMemo(
    () => suggest(last, 7).filter((v) => clean(v.t) !== clean(last)).slice(0, 6),
    [last],
  );

  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setNarrow(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    if (!autoFocus) return;
    if (window.matchMedia("(min-width: 768px) and (hover: hover)").matches) input.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const go = (text: string) => {
    const t = text.trim();
    if (!t) { input.current?.focus(); return; }
    track("search_submit", { entry: "portal", scope, matched: bits.length });
    setOpen(false);
    router.push(`${base}?q=${encodeURIComponent(t)}`);
  };
  /** 마지막 낱말을 추천어로 바꾼다. "서울 경비" + 추천 "경비원" → "서울 경비원" */
  const pick = (t: string) => {
    const parts = q.trim().split(/\s+/); parts[Math.max(0, parts.length - 1)] = t;
    go(parts.join(" "));
  };
  const rows = [
    ...(q.trim() ? [{ key: "all", label: `‘${q.trim()}’ 전체에서 찾기`, tag: "통합 검색", act: () => go(q) }] : []),
    ...items.map((v) => ({ key: "v:" + v.t, label: v.t, tag: v.tag, act: () => pick(v.t) })),
  ];
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setCur((c) => Math.min(rows.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCur((c) => Math.max(-1, c - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (cur >= 0 && rows[cur]) rows[cur].act(); else go(q); }
    else if (e.key === "Escape") setOpen(false);
  };
  const lg = size !== "md";
  const xl = size === "xl";
  const show = open && q.trim().length > 0 && (rows.length > 0 || bits.length > 0 || related.length > 0);

  return (
    <div ref={box} className="relative">
      {/* 알약 모양 검색창. 테두리는 브랜드 색 두 줄 — 화면에서 가장 먼저 눈에 들어와야 한다. */}
      <form role="search" onSubmit={(e) => { e.preventDefault(); go(q); }}
            className={`flex items-center gap-1.5 rounded-pill border-2 bg-white pr-1.5 transition-shadow
                        ${show ? "border-brand shadow-lift" : "border-brand/80 shadow-card hover:border-brand focus-within:border-brand focus-within:shadow-lift"}
                        ${xl ? "pl-5 sm:pl-7" : lg ? "pl-5" : "pl-4"}`}>
        <input
          ref={input}
          data-portal-search
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setCur(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          role="combobox" aria-expanded={show} aria-controls="portal-suggest" aria-autocomplete="list"
          placeholder={narrow
            ? placeholderNarrow ?? (placeholder ? placeholder.replace(/^.*?[—:]\s*/, "") : "경비, 신혼부부 전세, 기능사…")
            : placeholder ?? (lg ? "무엇이든 찾아보세요 — 경비 채용, 신혼부부 전세, 기능사 시험" : "경비 채용, 신혼부부 전세, 기능사…")}
          aria-label="통합 검색"
          enterKeyHint="search"
          className={`w-full min-w-0 bg-transparent outline-none placeholder:text-faint ${
            xl ? "h-[52px] text-[17px] sm:h-[58px] sm:text-[19px]" : lg ? "h-[50px] text-[16.5px]" : "h-11 text-[15px]"}`}
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); setCur(-1); input.current?.focus(); }} aria-label="지우기"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint hover:bg-ground hover:text-ink">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        )}
        <button type="submit" aria-label="검색"
                className={`flex shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brandDeep ${
                  xl ? "h-10 w-10 sm:h-11 sm:w-11" : lg ? "h-10 w-10" : "h-8 w-8"}`}>
          <svg viewBox="0 0 20 20" className={xl || lg ? "h-5 w-5" : "h-4 w-4"} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
            <circle cx="9" cy="9" r="5.8" /><path d="M13.6 13.6l4 4" strokeLinecap="round" />
          </svg>
        </button>
      </form>

      {show && (
        <div id="portal-suggest" role="listbox"
             className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-[18px] border border-line bg-white text-left shadow-lift">
          {rows.map((r, i) => (
            <button key={r.key} type="button" role="option" aria-selected={i === cur}
                    onMouseEnter={() => setCur(i)} onClick={r.act}
                    className={`flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left text-[15px] ${i === cur ? "bg-ground text-ink" : "hover:bg-ground"}`}>
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="shrink-0 text-[12px] text-faint">{r.tag}</span>
            </button>
          ))}
          {(bits.length > 0 || related.length > 0) && (
            <div className="border-t border-line bg-surface2 px-5 py-2.5 text-[12.5px] text-muted">
              {bits.length > 0 && (
                <p>조건으로 알아들음 <b className="text-ink2">{bits.join(" · ")}</b>
                  {" · "}<Link href={`/?${toParams(parsed)}`} className="font-bold text-brand underline underline-offset-4" onClick={() => setOpen(false)}>이 조건의 지원금 보기</Link>
                </p>
              )}
              {related.length > 0 && <p className={bits.length ? "mt-1" : ""}>같이 찾는 말 <b className="text-ink2">{related.join(" · ")}</b></p>}
            </div>
          )}
        </div>
      )}

      {hot.length > 0 && (
        // 휴대폰에서는 한 줄로 두고 옆으로 밀어 본다(열 개 모두). 넓은 화면은 한 줄에 드는 여덟 개까지.
        <div className={`mt-3 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
                         sm:flex-wrap sm:overflow-visible ${center ? "sm:justify-center" : ""} -mx-5 px-5 sm:mx-0 sm:px-0`}>
          <span className="shrink-0 text-[12.5px] font-bold text-ink2" title="지난 7일 동안 많이 찾은 말. 매일 새로 셉니다.">
            많이 찾는 말
          </span>
          {hot.map((h, i) => (
            <Link key={h} href={`${base}?q=${encodeURIComponent(h)}`}
                  className={`shrink-0 rounded-pill bg-white px-3 py-1.5 text-[13px] font-medium text-ink2 ring-1 ring-inset ring-line
                              transition-colors hover:text-brand hover:ring-brand/40 ${i >= 8 ? "sm:hidden" : ""}`}>
              {h}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
