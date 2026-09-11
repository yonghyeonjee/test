"use client";

import { useState } from "react";

const MODES = [
  { key: "pick", label: "선택으로 찾기", hint: "골라서 찾기 — 쉬워요" },
  { key: "search", label: "검색으로 찾기", hint: "한 줄로 적어서 찾기" },
] as const;

type Mode = (typeof MODES)[number]["key"];

/**
 * 찾는 방법 두 가지를 한자리에 둔다.
 *
 * 기본은 선택이다. 빈칸을 눌러 고르기만 하면 되고 무엇을 적어야 할지 고민할
 * 일이 없어서, 처음 온 사람이나 어르신이 훨씬 덜 막힌다. 문장을 바로 칠 줄
 * 아는 사람은 옆 탭으로 넘어가면 된다.
 */
export default function Finder({
  pick,
  search,
}: {
  pick: React.ReactNode;
  search: React.ReactNode;
}) {
  const [mode, setMode] = useState<Mode>("pick");

  return (
    <div>
      <div
        role="tablist"
        aria-label="찾는 방법"
        className="relative mb-4 grid grid-cols-2 gap-1.5 rounded-btn bg-ground p-1.5"
      >
        {/* 선택된 쪽으로 미끄러지는 초록 판. 버튼은 그 위에 투명하게 올라간다. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-1.5 left-1.5 w-[calc(50%-6px)] rounded-ctl bg-brand
                     transition-transform duration-300 ease-[cubic-bezier(.2,.7,.2,1)]"
          style={{ transform: mode === "pick" ? "translateX(0)" : "translateX(calc(100% + 6px))" }}
        />
        {MODES.map((m) => {
          const on = mode === m.key;
          return (
            <button
              key={m.key}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setMode(m.key)}
              className={`relative rounded-ctl px-3 py-2.5 text-[15px] font-bold leading-tight
                          transition-colors duration-300 ${
                            on ? "text-white" : "text-muted hover:text-brand"
                          }`}
            >
              {m.label}
              <small
                className={`mt-0.5 block text-[11px] font-normal ${
                  on ? "text-[#A9CFBC]" : "text-faint"
                }`}
              >
                {m.hint}
              </small>
            </button>
          );
        })}
      </div>

      {mode === "pick" ? pick : search}
    </div>
  );
}
