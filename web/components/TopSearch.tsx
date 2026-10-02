"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { describe, parseQuery } from "@/lib/parse";
import { suggest } from "@/lib/thesaurus";
import { track } from "./Gtm";

type Idx = Record<string, { sido: string; full: string }>;

const clean = (s: string) => s.replace(/\s+/g, "").toLowerCase();

/**
 * 머리말 검색창. 어느 화면에서든 한 줄 적으면 통합 검색으로 간다.
 *
 * 적는 동안 낱말 추천이 아래로 열린다(앞글자 → 포함). 추천은 코드 안 목록
 * 이라 서버를 부르지 않는다. 화살표로 고르고 Enter. 좁은 화면에서는 돋보기만
 * 두고, 누르면 펼쳐진다.
 */
export default function TopSearch({ index }: { index: Idx }) {
  const router = useRouter();
  const path = usePathname();
  // 기업 쪽 화면에서 적으면 사업자 검색으로. 거기서도 통합 검색으로 건너갈 수 있다.
  const base = path?.startsWith("/business") ? "/business/search" : "/search";
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(false);
  const [cur, setCur] = useState(-1);
  const ref = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const map = useMemo(() => new Map(Object.entries(index)), [index]);
  const parsed = useMemo(() => parseQuery(q, map), [q, map]);
  const bits = describe(parsed).filter((b) => !b.endsWith(" 포함"));
  const last = q.trim().split(/\s+/).pop() ?? "";
  const items = useMemo(() => suggest(last, 6).filter((v) => clean(v.t) !== clean(last)).slice(0, 5), [last]);

  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setList(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const go = (text: string) => {
    const t = text.trim();
    if (!t) { setOpen(true); ref.current?.focus(); return; }
    track("search_submit", { entry: "top", scope: base === "/search" ? "all" : "business", matched: bits.length });
    setList(false);
    setOpen(false);
    router.push(`${base}?q=${encodeURIComponent(t)}`);
  };
  const pick = (t: string) => {
    const parts = q.trim().split(/\s+/); parts[Math.max(0, parts.length - 1)] = t;
    go(parts.join(" "));
  };
  const rows = [
    ...(q.trim() ? [{ key: "all", label: `‘${q.trim()}’ ${base === "/search" ? "통합 검색" : "사업자 검색"}`, tag: bits.length ? bits.slice(0, 2).join(" · ") : "전체", act: () => go(q) }] : []),
    ...items.map((v) => ({ key: "v:" + v.t, label: v.t, tag: v.tag, act: () => pick(v.t) })),
  ];
  const show = list && q.trim().length > 0 && rows.length > 0;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setList(true); setCur((c) => Math.min(rows.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCur((c) => Math.max(-1, c - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (show && cur >= 0 && rows[cur]) rows[cur].act(); else go(q); }
    else if (e.key === "Escape") { setList(false); if (!q) setOpen(false); }
  };

  return (
    <div ref={box} className={`relative flex min-w-0 items-center ${open ? "flex-1" : ""}`}>
      <button
        type="button"
        aria-label="검색 열기"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border
                    border-line bg-surface text-ink2 transition-colors hover:border-brand hover:text-brand
                    sm:hidden ${open ? "hidden" : ""}`}
      >
        <SearchIcon />
      </button>
      <form
        role="search"
        onSubmit={(e) => { e.preventDefault(); go(q); }}
        className={`items-center gap-2 rounded-pill border bg-surface pl-3 pr-1.5
                    transition-colors focus-within:border-brand ${show ? "border-brand" : "border-line"}
                    ${open ? "flex w-full" : "hidden sm:flex sm:w-[20rem] lg:w-[27rem]"}`}
      >
        <span className="text-brand"><SearchIcon /></span>
        <input
          ref={ref}
          data-search
          value={q}
          onChange={(e) => { setQ(e.target.value); setList(true); setCur(-1); }}
          onFocus={() => setList(true)}
          onKeyDown={onKey}
          onBlur={() => { if (!q) setOpen(false); }}
          role="combobox" aria-expanded={show} aria-controls="top-suggest" aria-autocomplete="list"
          placeholder="통합 검색 — 경비 채용, 신혼부부 전세, 기능사"
          aria-label="통합 검색"
          enterKeyHint="search"
          className="h-9 w-full min-w-0 bg-transparent text-[14px] outline-none placeholder:text-faint"
        />
        <button type="submit" className="btn btn-primary shrink-0 !rounded-pill !px-3 !py-1.5 !text-[13px]">
          찾기
        </button>
      </form>

      {show && (
        <div id="top-suggest" role="listbox"
             className="absolute right-0 top-[calc(100%+6px)] z-40 w-full min-w-[16rem] overflow-hidden rounded-[14px] border border-line bg-white shadow-lift">
          {rows.map((r, i) => (
            <button key={r.key} type="button" role="option" aria-selected={i === cur}
                    onMouseEnter={() => setCur(i)} onMouseDown={(e) => e.preventDefault()} onClick={r.act}
                    className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[14px] ${i === cur ? "bg-brandSoft text-brand" : "hover:bg-ground"}`}>
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="shrink-0 text-[11.5px] text-faint">{r.tag}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="9" cy="9" r="6" />
      <path d="M14 14l4 4" strokeLinecap="round" />
    </svg>
  );
}
