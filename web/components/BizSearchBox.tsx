"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { describeBiz, parseBizQuery, toBizParams } from "@/lib/parse";

const SAMPLES = [
  "경기도 소상공인 자금",
  "3년차 창업기업 판로",
  "부산 중소기업 수출",
  "예비창업자 기술",
];

/** 기업 지원사업용 한 줄 입력. 개인 쪽과 달리 시·군·구는 보지 않는다. */
export default function BizSearchBox({ autoFocus }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const parsed = useMemo(() => parseBizQuery(q), [q]);
  const bits = describeBiz(parsed);
  const ready = bits.length > 0;

  const go = () => {
    if (!ready) return;
    router.push(`/?${toBizParams(parsed)}`);
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
          placeholder="지역, 사업체 종류, 필요한 것을 한 줄로"
          aria-label="기업 지원사업 검색"
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
            지역·사업체 종류·지원분야 중 하나는 있어야 찾을 수 있습니다
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
