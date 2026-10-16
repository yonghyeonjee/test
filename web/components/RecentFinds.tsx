import Link from "next/link";
import { SIDO_SHORT } from "@/lib/geo";
import { agoLabel, getRecentFinds } from "@/lib/recentFinds";
import Glyph from "./Glyph";

/**
 * 방금 남들이 찾아본 조건 한 줄. 누르면 그 시·도로 찾는다(나이·상태는 그 사람 것이라
 * 옮기지 않는다). 기록이 없으면 아무것도 안 그린다.
 */
export default async function RecentFinds({ className = "" }: { className?: string }) {
  const rows = await getRecentFinds();
  if (rows.length < 3) return null;
  return (
    <section aria-label="방금 찾아본 조건" className={`card px-4 py-3 ${className}`}>
      <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-muted">
        <Glyph name="history" className="h-3.5 w-3.5 text-brand" strokeWidth={2.2} />
        방금 찾아본 조건
        <span className="font-normal text-faint">· 다른 분들이 고른 것</span>
      </p>
      <ul className="scrollbar-none -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-0.5">
        {rows.map((r, i) => {
          const who = [SIDO_SHORT[r.sido] ?? r.sido, r.ageBand, r.employment].filter(Boolean).join(" · ");
          return (
            <li key={i} className="shrink-0">
              <Link href={`/?sido=${encodeURIComponent(r.sido)}&via=recent`}
                    className="flex items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] transition-colors hover:border-brand hover:text-brand">
                <span className="font-bold text-ink2">{who}</span>
                <span className="num text-[12px] text-faint">
                  {r.n >= 60 ? "60건+" : `${r.n}건`} · {agoLabel(r.agoMin)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
