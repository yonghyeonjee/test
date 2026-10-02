"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearRecent, readRecent, recentHref, type Recent } from "@/lib/me";

/**
 * 최근 본 공고·사업. 열어 본 것을 다시 찾느라 검색부터 하지 않게.
 * kind 를 주면 그 종류만(채용 쪽에서는 채용만).
 */
export default function RecentStrip({ kind, max = 6, className = "" }: { kind?: Recent["kind"]; max?: number; className?: string }) {
  const [list, setList] = useState<Recent[]>([]);
  useEffect(() => { setList(readRecent().filter((r) => !kind || r.kind === kind).slice(0, max)); }, [kind, max]);
  if (!list.length) return null;
  return (
    <section className={`${className}`} aria-label="최근 본 것">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-bold text-muted">최근 본 {kind === "job" ? "공고" : kind === "p" ? "사업" : "공고·사업"}</h2>
        <button type="button" onClick={() => { clearRecent(); setList([]); }} className="py-1 text-[12px] text-faint hover:text-brand">
          지우기
        </button>
      </div>
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {list.map((r) => (
          <li key={`${r.kind}:${r.id}`} className="shrink-0">
            <Link href={recentHref(r)}
                  className="block w-[13.5rem] rounded-card border border-line bg-surface px-3.5 py-2.5 hover:border-brand">
              <span className="block truncate text-[13.5px] font-semibold text-ink">{r.title}</span>
              <span className="mt-0.5 block truncate text-[12px] text-muted">
                {r.kind === "job" ? "채용" : "지원사업"}{r.sub ? ` · ${r.sub}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
