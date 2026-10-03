import type { MonthRow, YearRow } from "@/lib/jobTrend";

/**
 * 연도별 막대. 모인 자료 사이의 빈 해(2015~2019년)는 0건이 아니라 "추가 중"이라
 * 빗금 칸으로 따로 그린다. 올해는 아직 끝나지 않아 옅게.
 */
export function YearBars({ years, height = 96, unit = "건" }: { years: YearRow[]; height?: number; unit?: string }) {
  if (!years.length) return null;
  const have = new Map(years.map((r) => [r.y, r.n]));
  const from = years[0].y;
  const to = years[years.length - 1].y;
  const thisYear = new Date().getFullYear();
  const max = Math.max(1, ...years.map((r) => r.n));
  const cols: { y: number; n: number | null }[] = [];
  for (let y = from; y <= to; y++) cols.push({ y, n: have.get(y) ?? null });
  // 빈 해가 이어지면 한 칸으로 줄인다(다섯 해가 다섯 칸을 먹으면 막대가 가늘어진다).
  const packed: ({ y: number; n: number } | { gap: [number, number] })[] = [];
  for (const c of cols) {
    const last = packed[packed.length - 1];
    if (c.n == null) {
      if (last && "gap" in last) last.gap[1] = c.y;
      else packed.push({ gap: [c.y, c.y] });
    } else packed.push({ y: c.y, n: c.n });
  }
  return (
    <figure className="mt-3">
      <div className="flex items-end gap-[3px] sm:gap-1" style={{ height: height + 34 }}>
        {packed.map((c) => "gap" in c ? (
          <div key={`g${c.gap[0]}`} className="flex flex-[1.4] flex-col items-center justify-end gap-1"
               title={`${c.gap[0]}~${c.gap[1]}년 자료 추가 중`}>
            <span className="text-[10px] leading-none text-faint">추가 중</span>
            <div className="w-full rounded-t border border-dashed border-line bg-[repeating-linear-gradient(135deg,transparent_0_4px,rgba(0,0,0,.06)_4px_6px)]"
                 style={{ height: height * 0.5 }} />
            <span className="whitespace-nowrap text-[10.5px] text-faint">{String(c.gap[0]).slice(2)}~{String(c.gap[1]).slice(2)}</span>
          </div>
        ) : (
          <div key={c.y} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
               title={`${c.y}년 ${c.n.toLocaleString("ko-KR")}${unit}${c.y === thisYear ? " (올해, 아직 진행 중)" : ""}`}>
            <span className="num hidden text-[10.5px] leading-none text-muted sm:block">{compact(c.n)}</span>
            <div className={`w-full rounded-t ${c.y === thisYear ? "bg-brand/35" : "bg-brand/75"}`}
                 style={{ height: Math.max(2, Math.round((c.n / max) * height)) }} />
            <span className="num text-[10.5px] text-faint">{String(c.y).slice(2)}</span>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">
        {years.map((r) => `${r.y}년 ${r.n}${unit}`).join(", ")}
      </figcaption>
    </figure>
  );
}

/** 달별 막대(최근 n달). 이번 달은 덜 찼으니 옅게. 눈금은 석 달마다. */
export function MonthTrend({ months, count = 24, height = 80 }: { months: MonthRow[]; count?: number; height?: number }) {
  const rows = months.slice(-count);
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <figure className="mt-3">
      <div className="flex items-end gap-[2px] sm:gap-[3px]" style={{ height: height + 18 }}>
        {rows.map((r, i) => {
          const last = i === rows.length - 1;
          const mm = Number(r.ym.slice(5, 7));
          return (
            <div key={r.ym} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                 title={`${r.ym.replace("-", "년 ")}월 공고 ${r.n.toLocaleString("ko-KR")}건 · 기관 ${r.orgs.toLocaleString("ko-KR")}곳${last ? " (이번 달, 진행 중)" : ""}`}>
              <div className={`w-full rounded-t ${last ? "bg-brand/30" : mm === 1 ? "bg-brand" : "bg-brand/70"}`}
                   style={{ height: Math.max(2, Math.round((r.n / max) * height)) }} />
              <span className="num h-3 whitespace-nowrap text-[10px] leading-3 text-faint">
                {mm === 1 ? `${r.ym.slice(2, 4)}년` : i % 3 === 0 ? `${mm}` : ""}
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="sr-only">
        {rows.map((r) => `${r.ym} ${r.n}건`).join(", ")}
      </figcaption>
    </figure>
  );
}

function compact(n: number) {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}만` : n >= 1000 ? `${(n / 1000).toFixed(1)}천` : String(n);
}
