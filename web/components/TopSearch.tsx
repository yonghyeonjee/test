"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { describe, parseQuery, toParams } from "@/lib/parse";
import { track } from "./Gtm";

type Idx = Record<string, { sido: string; full: string }>;

/**
 * 머리말 검색창. 어느 화면에서든 한 줄 적으면 조회 화면으로 간다.
 *
 * 홈의 검색창과 같은 파서를 쓴다. 알아들은 것이 없으면 전체 정책 화면으로
 * 보내 훑어볼 수 있게 한다 — 검색어를 잘못 넣었다고 막다른 길로 보내지 않는다.
 * 좁은 화면에서는 돋보기만 두고, 누르면 펼쳐진다.
 */
export default function TopSearch({ index }: { index: Idx }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const map = useMemo(() => new Map(Object.entries(index)), [index]);
  const parsed = useMemo(() => parseQuery(q, map), [q, map]);
  const bits = describe(parsed);

  useEffect(() => { if (open) ref.current?.focus(); }, [open]);

  const go = () => {
    const text = q.trim();
    if (!text) { setOpen(true); return; }
    if (bits.length) {
      track("search_submit", { entry: "top", matched: bits.length });
      router.push(`/?${toParams(parsed)}&via=top`);
    } else {
      track("search_submit", { entry: "top", matched: 0 });
      router.push("/policies");
    }
    setOpen(false);
  };

  return (
    <div className={`relative flex min-w-0 items-center ${open ? "flex-1" : ""}`}>
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
        onSubmit={(e) => { e.preventDefault(); go(); }}
        className={`items-center gap-2 rounded-pill border border-line bg-surface pl-3 pr-1.5
                    transition-colors focus-within:border-brand
                    ${open ? "flex w-full" : "hidden sm:flex sm:w-[19rem]"}`}
      >
        <span className="text-faint"><SearchIcon /></span>
        <input
          ref={ref}
          data-search
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => { if (!q) setOpen(false); }}
          placeholder="지역·나이·상황  예) 수원 28살 미취업"
          aria-label="조건 검색"
          className="h-9 w-full min-w-0 bg-transparent text-[14px] outline-none placeholder:text-faint"
        />
        {q && (
          <span className="hidden shrink-0 text-[11px] text-muted sm:inline">
            {bits.length ? bits.slice(0, 2).join(" · ") : "전체에서 찾기"}
          </span>
        )}
        <button type="submit" className="btn btn-primary shrink-0 !rounded-pill !px-3 !py-1.5 !text-[13px]">
          찾기
        </button>
      </form>
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
