import Link from "next/link";
import type { ReactNode } from "react";
import StoryCover from "./StoryCover";
import { Reveal } from "./Motion";

/**
 * 글 목록. 브런치처럼 카드 대신 한 줄씩 — 제목, 두 줄 요약, 작은 표식 줄(갈래 · 날짜 · 읽는 시간),
 * 오른쪽에 작은 네모 썸네일, 사이는 가는 선. 2026-10-16 "브런치처럼"이라는 말에 카드 격자를 걷었다.
 */
export type Article = {
  href: string;
  title: string;
  excerpt: string;
  /** 갈래 표식(파랑). */
  label?: string;
  /** 표식 앞의 짧은 꼬리표(예: 신청 중). 눈에 띄는 것 하나만. */
  tag?: string;
  date?: string;
  mins?: number;
  /** 썸네일: 갈래 색 띠(kind) 또는 직접 그린 것(art). 둘 다 없으면 글만. */
  kind?: string;
  art?: ReactNode;
};

const dot = (d?: string) => (d ? d.replaceAll("-", ".") : "");

export default function ArticleList({ items, className = "" }: { items: Article[]; className?: string }) {
  return (
    <ol className={`divide-y divide-line ${className}`}>
      {items.map((a, i) => (
        <Reveal as="li" key={a.href} delay={Math.min(i, 6) * 50}>
          <Link href={a.href} className="group flex items-start gap-5 py-6 sm:gap-7 sm:py-7">
            <span className="min-w-0 flex-1">
              {a.tag && <span className="mb-1.5 inline-block rounded-pill bg-brand px-2 py-0.5 text-[11.5px] font-bold text-white">{a.tag}</span>}
              <b className="article-title block text-[1.125rem] leading-snug text-ink group-hover:text-brand sm:text-[1.25rem]">{a.title}</b>
              <span className="mt-2 line-clamp-2 block text-[14px] leading-[1.7] text-muted sm:text-[14.5px]">{a.excerpt}</span>
              <span className="mt-3 block text-[12.5px] text-faint">
                {a.label && <span className="font-semibold text-brand">{a.label}</span>}
                {a.label && (a.date || a.mins) && <span className="mx-1.5">·</span>}
                {a.date && <span className="num">{dot(a.date)}</span>}
                {a.mins && <span className="num">{a.date ? " · " : ""}{a.mins}분</span>}
              </span>
            </span>
            {(a.art || a.kind) && (
              <span className="mt-1 h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[12px] sm:h-24 sm:w-24">
                {a.art ? <span className="flex h-full w-full items-center justify-center bg-brandSoft/50 p-2">{a.art}</span> : <StoryCover kind={a.kind!} square />}
              </span>
            )}
          </Link>
        </Reveal>
      ))}
    </ol>
  );
}
