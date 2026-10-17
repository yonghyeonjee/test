import Link from "next/link";
import Inline from "./Inline";
import type { Block } from "@/lib/stories";

/**
 * 글 맨 위의 요약 상자(두괄식). 한 줄 요약 → 머리글의 핵심 문장 셋 → 차례.
 * 머리글(첫 문단)은 숫자가 굵게 박힌 핵심 문장이라 그대로 쪼개 쓴다. 본문에서는 그 문단을 뺀다.
 */
export default function StorySummary({ summary, blocks, className = "" }: { summary: string; blocks: Block[]; className?: string }) {
  const lead = blocks.find((b): b is Extract<Block, { type: "p" }> => b.type === "p")?.text ?? "";
  // "…입니다. " 단위로 쪼갠다. 괄호 안 마침표는 드물어 단순히 간다. 셋까지.
  const points = lead.split(/(?<=[다요]\.)\s+/).map((t) => t.trim()).filter(Boolean).slice(0, 3);
  const toc = blocks.find((b): b is Extract<Block, { type: "toc" }> => b.type === "toc")?.items ?? [];
  return (
    <section aria-label="요약" className={`rounded-card border-l-[3px] border-brand bg-brandSoft/40 px-5 py-4 ${className}`}>
      <p className="text-[12.5px] font-bold tracking-[.04em] text-brand">한눈에</p>
      <p className="mt-1.5 text-[15.5px] font-semibold leading-[1.75] text-ink">{summary}</p>
      {points.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-[14.5px] leading-[1.75] text-ink2">
          {points.map((t, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
              <span><Inline text={t} /></span>
            </li>
          ))}
        </ul>
      )}
      {toc.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-1.5">
          {toc.map((t) => (
            <Link key={t.id} href={`#${t.id}`} className="rounded-pill bg-white px-3 py-1 text-[12.5px] font-semibold text-ink2 ring-1 ring-inset ring-line hover:text-brand">
              {t.label}
            </Link>
          ))}
        </p>
      )}
    </section>
  );
}
