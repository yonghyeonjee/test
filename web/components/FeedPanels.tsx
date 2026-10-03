import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 첫 화면의 "마감 임박 · 새로 올라온" 두 칸. 넓은 화면에서는 나란히, 휴대폰에서는 위아래.
 * 크제비(공지사항 | 블로그)처럼 제목 밑에 짧은 밑줄, 오른쪽에 더보기, 아래는 줄 목록.
 * 탭으로 번갈아 보이던 것을 둘 다 펼친다 — 한눈에 들어오고 탭을 누를 일이 없다.
 */
export default function FeedPanels({ panels, id }: {
  id?: string;
  panels: { key: string; label: string; sub?: string; more?: string; content: ReactNode }[];
}) {
  const shown = panels.filter((p) => p.content);
  if (!shown.length) return null;
  return (
    <div id={id} className={`grid gap-3 ${shown.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {shown.map((p) => (
        <section key={p.key} className="card feed-panel px-4 pb-2 pt-3 sm:px-5" aria-labelledby={`feed-${p.key}`}>
          <div className="flex items-end justify-between gap-3 border-b border-line">
            <h2 id={`feed-${p.key}`} className="feed-title -mb-px border-b-[3px] border-brand pb-2 text-[16px] font-extrabold tracking-[-.02em] text-ink">
              {p.label}
            </h2>
            {p.more && (
              <Link href={p.more} className="shrink-0 pb-2 text-[12.5px] font-semibold text-muted hover:text-ink">더보기 ›</Link>
            )}
          </div>
          {p.sub && <p className="mt-2 text-[12.5px] text-faint">{p.sub}</p>}
          {p.content}
        </section>
      ))}
    </div>
  );
}
