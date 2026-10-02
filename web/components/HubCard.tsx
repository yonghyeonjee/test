import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 허브(생활금융 등)의 큰 안내 카드. 글은 왼쪽, 그림은 오른쪽의 옅은 무대 위에.
 * 좁은 화면에서는 그림이 위로 올라간다.
 */
export default function HubCard({ href, tag, title, desc, art }: {
  href: string; tag?: string; title: string; desc: string; art: ReactNode;
}) {
  return (
    <Link href={href} className="card card-link group flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
      <span className="hub-stage flex h-28 w-full shrink-0 items-center justify-center rounded-[16px] p-3 sm:h-32 sm:w-40">
        <span className="h-full w-full transition-transform duration-300 group-hover:scale-[1.04]">{art}</span>
      </span>
      <span className="min-w-0 flex-1">
        {tag && <span className="badge badge-new">{tag}</span>}
        <b className="mt-2 block text-[1.0625rem] font-bold leading-snug group-hover:text-brand">{title}</b>
        <span className="mt-2 block text-sm leading-relaxed text-muted">{desc}</span>
        <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-brand">
          자세히 보기
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </span>
      </span>
    </Link>
  );
}
