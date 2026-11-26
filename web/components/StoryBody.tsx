import Link from "next/link";
import Inline from "./Inline";
import Toc from "./Toc";
import type { Block } from "@/lib/stories";

const FOLD = 8;

/** 자료에서 만든 글의 블록을 그린다. 종류별로 모양이 정해져 있다. */
export default function StoryBody({ blocks }: { blocks: Block[] }) {
  return (
    <div>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "toc":
            return <Toc key={i} items={b.items} />;
          case "h2":
            return (
              <h2 key={i} id={b.id} className="article-title mt-14 scroll-mt-24 text-[1.2rem] sm:text-[1.3rem]">{b.text}</h2>
            );
          case "p":
            return <p key={i} className="mt-4 text-[16px] leading-[1.9] text-ink2 sm:text-[16.5px]"><Inline text={b.text} /></p>;
          case "note":
            return <p key={i} className="mt-6 text-xs leading-relaxed text-muted"><Inline text={b.text} /></p>;
          case "img":
            // 사진은 글 폭에 맞춰 둥글게. 출처가 있으면 아래 작은 글씨로(CC 사진은 표시가 조건이다).
            return (
              <figure key={i} className="mt-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.src} alt={b.alt} loading="lazy" className="w-full rounded-card object-cover" />
                {b.caption && <figcaption className="mt-2 text-xs leading-relaxed text-muted">{b.caption}</figcaption>}
              </figure>
            );
          case "list":
            return (
              <ul key={i} className="mt-4 space-y-2 text-[16px] leading-[1.85] text-ink2">
                {b.items.map((t, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                    <span><Inline text={t} /></span>
                  </li>
                ))}
              </ul>
            );
          case "links": {
            // 여덟 줄까지 펴고 나머지는 접는다. 하루 공고 60줄이 줄줄이 깔려 글이 너무 길었다.
            const row = (l: { href: string; label: string }, j: number) => (
              <li key={j}>
                <Link href={l.href} className="block px-4 py-3 text-[14.5px] leading-snug hover:text-brand">{l.label}</Link>
              </li>
            );
            const head = b.items.slice(0, FOLD), rest = b.items.slice(FOLD);
            return (
              <div key={i} className="card mt-3 overflow-hidden">
                <ul className="divide-y divide-line">{head.map(row)}</ul>
                {rest.length > 0 && (
                  <details className="group border-t border-line">
                    <summary className="cursor-pointer list-none px-4 py-2.5 text-center text-[13.5px] font-semibold text-brand hover:bg-ground">
                      <span className="group-open:hidden">나머지 {rest.length}건 더 보기</span><span className="hidden group-open:inline">접기</span>
                    </summary>
                    <ul className="divide-y divide-line border-t border-line">{rest.map((l, j) => row(l, j + FOLD))}</ul>
                  </details>
                )}
              </div>
            );
          }
          case "table":
            return (
              <div key={i} className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[20rem] border-collapse text-[13.5px]">
                  <thead>
                    <tr className="border-b-2 border-line2 text-left text-[12.5px] text-muted">
                      {b.head.map((h, j) => <th key={j} className="py-2 pr-3 font-semibold">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-b border-line">
                        {r.map((c, k) => (
                          <td key={k} className={`py-2.5 pr-3 align-top ${k === 0 ? "font-semibold" : "num text-ink2"}`}><Inline text={c} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "bars": {
            const max = Math.max(1, ...b.items.map((x) => x.n));
            return (
              <ul key={i} className="mt-3 space-y-1.5">
                {b.items.map((x, j) => (
                  <li key={j} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 text-[13px]">
                    <span className="truncate text-ink2" title={x.label}>{x.label}</span>
                    <span className="h-3 overflow-hidden rounded-full bg-ground">
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(2, (x.n / max) * 100)}%` }} />
                    </span>
                    <span className="num text-right text-muted">{x.n.toLocaleString("ko-KR")}{b.unit ?? ""}</span>
                  </li>
                ))}
              </ul>
            );
          }
          case "summary":
            // 글머리 핵심 정리. 체크 표시 목록 — 바쁜 사람은 여기만 읽고 간다.
            return (
              <section key={i} aria-label={b.title ?? "핵심 정리"} className="mt-6 rounded-card border border-brand/20 bg-brandSoft/50 px-5 py-4">
                <p className="text-[15px] font-extrabold tracking-[-.02em] text-ink">{b.title ?? "핵심 정리"}</p>
                <ul className="mt-2.5 space-y-2 text-[15.5px] leading-[1.7] text-ink2">
                  {b.items.map((t, j) => (
                    <li key={j} className="flex gap-2.5">
                      <svg viewBox="0 0 20 20" className="mt-[5px] h-[18px] w-[18px] shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 10.500l4 4 8-9" /></svg>
                      <span><Inline text={t} /></span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          case "steps":
            return (
              <ol key={i} className="mt-5 space-y-3">
                {b.items.map((t, j) => (
                  <li key={j} className="flex gap-3 rounded-card border border-line bg-surface px-4 py-3.5 text-[15.5px] leading-[1.75] text-ink2">
                    <span className="num mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-extrabold text-white">{j + 1}</span>
                    <span className="min-w-0"><Inline text={t} /></span>
                  </li>
                ))}
              </ol>
            );
          case "faq":
            return (
              <dl key={i} className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
                {b.items.map((x, j) => (
                  <div key={j} className="px-4 py-4">
                    <dt className="flex gap-2 text-[16px] font-bold leading-snug text-ink"><span className="text-brand" aria-hidden>Q.</span><span>{x.q}</span></dt>
                    <dd className="mt-2 text-[15.5px] leading-[1.8] text-ink2"><Inline text={x.a} /></dd>
                  </div>
                ))}
              </dl>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
