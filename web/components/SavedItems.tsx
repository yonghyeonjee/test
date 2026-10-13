"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isClosed, itemHref, listItems, removeItem, type SavedItem } from "@/lib/savedItems";

/**
 * 저장한 공고·사업 목록.
 *  strip : 첫 화면·채용 첫 화면에 가로 한 줄(최근 본 것과 같은 꼴). 없으면 아무것도 안 그린다.
 *  list  : /saved 와 내 계정에 세로 목록. 지우기 단추가 있다.
 */
export default function SavedItems({ variant = "list", kind, max, className = "" }: {
  variant?: "strip" | "list"; kind?: SavedItem["kind"]; max?: number; className?: string;
}) {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  useEffect(() => { void listItems().then(setItems); }, []);
  if (!items) return null;
  const list = items.filter((s) => !kind || s.kind === kind).slice(0, max ?? items.length);

  if (variant === "strip") {
    if (!list.length) return null;
    return (
      <section className={className} aria-label="저장한 공고·사업">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] font-bold text-muted">저장한 {kind === "job" ? "공고" : kind === "p" ? "사업" : "공고·사업"}</h2>
          <Link href="/saved" className="py-1 text-[12px] text-faint hover:text-brand">모두 보기</Link>
        </div>
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {list.map((s) => (
            <li key={`${s.kind}:${s.item_id}`} className="shrink-0">
              <Link href={itemHref(s)} className="block w-[13.5rem] rounded-card border border-line bg-surface px-3.5 py-2.5 hover:border-brand">
                <span className="block truncate text-[13.5px] font-semibold text-ink">{s.title}</span>
                <span className="mt-0.5 block truncate text-[12px] text-muted">
                  {s.kind === "job" ? "채용" : "지원사업"}{s.sub ? ` · ${s.sub}` : ""}{isClosed(s) ? " · 마감" : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!list.length)
    return (
      <p className={`text-[13.5px] leading-relaxed text-muted ${className}`}>
        아직 저장한 것이 없습니다. 공고나 사업 쪽에서 제목 아래 <b className="text-ink">저장</b>을 누르면 여기 쌓입니다.
      </p>
    );

  return (
    <ul className={`divide-y divide-line ${className}`}>
      {list.map((s) => {
        const closed = isClosed(s);
        return (
          <li key={`${s.kind}:${s.item_id}`} className="flex items-start gap-3 py-3">
            <Link href={itemHref(s)} className="min-w-0 flex-1">
              <span className={`block text-[14.5px] font-semibold leading-snug ${closed ? "text-muted" : "text-ink"}`}>{s.title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted">
                <span>{s.kind === "job" ? "채용" : "지원사업"}</span>
                {s.sub && <span>{s.sub}</span>}
                {s.end_date && <span className={`num ${closed ? "text-alert" : ""}`}>{closed ? "마감" : `마감 ${s.end_date.replace(/-/g, ".")}`}</span>}
              </span>
            </Link>
            <button type="button" aria-label="저장 해제"
                    onClick={async () => { await removeItem(s.kind, s.item_id); setItems(await listItems()); }}
                    className="shrink-0 rounded-pill px-2.5 py-1.5 text-[12.5px] text-faint transition-colors hover:bg-ground hover:text-alert">
              지우기
            </button>
          </li>
        );
      })}
    </ul>
  );
}
