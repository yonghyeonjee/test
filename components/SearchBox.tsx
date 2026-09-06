"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { describe, parseQuery, toParams } from "@/lib/parse";

type Idx = Record<string, { sido: string; full: string }>;

const SAMPLES = [
  "안산 28살 미취업",
  "서울 65세 기초수급",
  "경기도 청년 월세",
  "부산 한부모 초등학생",
];

export default function SearchBox({
  index,
  autoFocus,
}: {
  index: Idx;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const map = useMemo(
    () => new Map(Object.entries(index)),
    [index]
  );

  const parsed = useMemo(() => parseQuery(q, map), [q, map]);
  const bits = describe(parsed);
  const ready = bits.length > 0;

  const go = () => {
    if (!ready) return;
    router.push(`/?${toParams(parsed)}`);
  };

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded-card border-2 bg-white px-4
                    py-3 transition-colors ${
                      ready ? "border-brand shadow-card" : "border-line"
                    }`}
      >
        <svg
          viewBox="0 0 20 20"
          className="h-5 w-5 shrink-0 text-faint"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="9" cy="9" r="6" />
          <path d="M14 14l4 4" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="사는 곳, 나이, 상황을 한 줄로 적어보세요"
          aria-label="조건 검색"
          className="w-full bg-transparent text-[1.0625rem] outline-none
                     placeholder:text-faint"
        />
        <button
          type="button"
          onClick={go}
          disabled={!ready}
          className="btn btn-primary shrink-0 px-4 py-2 disabled:bg-line
                     disabled:text-faint"
        >
          찾기
        </button>
      </div>

      {/* 무엇으로 알아들었는지 즉시 되비춰 준다. 틀리면 바로 고칠 수 있게. */}
      <div className="mt-2.5 flex min-h-[1.75rem] flex-wrap items-center gap-1.5">
        {ready ? (
          <>
            <span className="text-xs text-muted">이렇게 찾습니다</span>
            {bits.map((b) => (
              <span key={b} className="badge badge-quiet">
                {b}
              </span>
            ))}
          </>
        ) : q.length > 1 ? (
          <span className="text-xs text-accent">
            지역·나이·상황 중 하나는 있어야 찾을 수 있습니다
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-faint">예시</span>
            {SAMPLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQ(s)}
                className="rounded-pill bg-white px-2.5 py-1 text-xs text-muted
                           ring-1 ring-line transition-colors hover:text-brand
                           hover:ring-brand"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
