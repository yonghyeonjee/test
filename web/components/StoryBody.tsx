import Link from "next/link";
import Inline from "./Inline";
import Toc from "./Toc";
import type { Block } from "@/lib/stories";

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
              <h2 key={i} id={b.id} className="sec-title mt-12 scroll-mt-24 text-[1.0625rem] font-extrabold">{b.text}</h2>
            );
          case "p":
            return <p key={i} className="mt-3 text-[15px] leading-[1.85] text-ink2"><Inline text={b.text} /></p>;
          case "note":
            return <p key={i} className="mt-6 text-xs leading-relaxed text-muted"><Inline text={b.text} /></p>;
          case "list":
            return (
              <ul key={i} className="mt-3 space-y-2 text-[15px] leading-[1.85] text-ink2">
                {b.items.map((t, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                    <span><Inline text={t} /></span>
                  </li>
                ))}
              </ul>
            );
          case "links":
            return (
              <ul key={i} className="card mt-3 divide-y divide-line">
                {b.items.map((l, j) => (
                  <li key={j}>
                    <Link href={l.href} className="block px-4 py-3 text-[14.5px] leading-snug hover:text-brand">{l.label}</Link>
                  </li>
                ))}
              </ul>
            );
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
          default:
            return null;
        }
      })}
    </div>
  );
}
