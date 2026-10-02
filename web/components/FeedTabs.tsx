"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

/**
 * 탭 하나짜리 카드에 목록 여럿(마감 임박 · 새로 올라온). 두 목록을 나란히 세우면
 * 본문 기둥에서 제목이 반토막 나서, 한 장에 탭으로 갈아 끼운다. 내용은 서버가 다
 * 그려서 넘기므로 탭을 눌러도 다시 불러오지 않는다.
 */
export default function FeedTabs({ tabs, id }: {
  id?: string;
  tabs: { key: string; label: string; sub?: string; more?: string; content: ReactNode }[];
}) {
  const shown = tabs.filter((t) => t.content);
  const [cur, setCur] = useState(shown[0]?.key);
  if (!shown.length) return null;
  const on = shown.find((t) => t.key === cur) ?? shown[0];
  return (
    <section id={id} className="card px-4 pb-2 pt-3 sm:px-5">
      <div className="flex items-center justify-between gap-3 border-b border-line">
        <div role="tablist" className="-mb-px flex gap-4">
          {shown.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={t.key === on.key} onClick={() => setCur(t.key)}
                    className={`border-b-[3px] pb-2.5 pt-1 text-[16px] font-extrabold tracking-[-.02em] transition-colors ${
                      t.key === on.key ? "border-brand text-ink" : "border-transparent text-faint hover:text-ink2"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {on.more && (
          <Link href={on.more} className="shrink-0 pb-2 text-[12.5px] font-semibold text-muted hover:text-ink">더보기 ›</Link>
        )}
      </div>
      {on.sub && <p className="mt-2 text-[12.5px] text-faint">{on.sub}</p>}
      <div role="tabpanel">{on.content}</div>
    </section>
  );
}
