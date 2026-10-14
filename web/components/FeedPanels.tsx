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
    // grid-cols-1 이라야 칸이 화면 폭(minmax(0,1fr))이 된다. 칸 수를 안 적으면 기본 칸은 안쪽의 가장 긴
    // 한 줄(말줄임 제목은 줄바꿈이 없어 제목 전체 길이)만큼 넓어져, 휴대폰에서 이 카드만 442px 로 그려지고
    // 쪽 전체가 옆으로 밀렸다(2026-10-14). 카드에도 min-w-0.
    <div id={id} className={`grid grid-cols-1 gap-3 ${shown.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {shown.map((p) => (
        <section key={p.key} className="card feed-panel min-w-0 px-4 pb-2 pt-3 sm:px-5" aria-labelledby={`feed-${p.key}`}>
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
