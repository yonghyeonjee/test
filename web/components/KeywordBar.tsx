"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cleanQuery } from "@/lib/keywords";
import { track } from "./Gtm";

/**
 * 조건 문장 아래의 낱말 칸.
 *
 * 사는 곳·나이를 고른 채로 "신혼부부 전세" 처럼 찾는 것을 적으면 둘을 함께
 * 건다. 조건만으로는 60건이 나와도 그중 전세 얘기는 서너 건뿐이라, 이 칸이
 * 없으면 사람이 눈으로 걸러야 했다. 단추는 자주 찾는 말 — 누르면 바로 걸린다.
 */
export default function KeywordBar({ suggest, tab }: { suggest: string[]; tab: "welfare" | "business" }) {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp.get("q") ?? "";
  const [q, setQ] = useState(current);
  useEffect(() => setQ(current), [current]);

  const apply = (value: string) => {
    const next = new URLSearchParams(sp.toString());
    const v = cleanQuery(value);
    if (v) next.set("q", v); else next.delete("q");
    next.delete("tab");
    if (v) track("keyword_apply", { tab, words: v.split(" ").length });
    const base = tab === "business" ? "/business" : "/";
    router.replace(next.toString() ? `${base}?${next}` : base, { scroll: false });
  };

  const active = cleanQuery(current);

  return (
    <div className="mt-6">
      <p className="mb-2 text-sm text-muted">
        찾는 것이 정해져 있으면 적어 주세요. 조건과 함께 겁니다.
      </p>
      <form
        onSubmit={(e) => { e.preventDefault(); apply(q); }}
        className="flex items-center gap-2 rounded-card border-2 border-line bg-white px-3 py-2 transition-colors focus-within:border-brand"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="예) 신혼부부 전세, 학자금, 출산"
          aria-label="찾는 말"
          className="w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-faint"
        />
        {active && (
          <button type="button" onClick={() => { setQ(""); apply(""); }}
                  className="shrink-0 py-2 text-xs text-muted hover:text-brand" aria-label="찾는 말 지우기">
            지우기
          </button>
        )}
        <button type="submit" className="btn btn-primary shrink-0 px-3 py-1.5 text-[13px]">적용</button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggest.map((w) => {
          const on = active.split(" ").includes(w);
          return (
            <button
              key={w}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const words = active ? active.split(" ") : [];
                const next = on ? words.filter((x) => x !== w) : [...words, w];
                apply(next.join(" "));
              }}
              className={`chip ${on ? "chip-on" : ""}`}
            >
              {w}
            </button>
          );
        })}
      </div>
    </div>
  );
}
