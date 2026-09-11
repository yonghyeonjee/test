/**
 * 순위 막대. 한 계열이라 범례가 없고, 색도 하나다.
 *
 * 막대는 얇게, 값 쪽 끝만 둥글게, 바닥에서 시작한다. 숫자는 막대 색이
 * 아니라 글자색으로 적는다. 마우스를 올리면 <title> 로 전체 값이 보인다.
 * 표 구실은 옆의 목록이 한다.
 */
export type Bar = { label: string; value: number; note?: string };

export default function RankBars({ bars, max = 100, unit = "%" }: {
  bars: Bar[]; max?: number; unit?: string;
}) {
  const H = 26, LABEL = 132, W = 520, GAP = 6;
  const height = bars.length * (H + GAP);
  const plotW = W - LABEL - 56;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full min-w-[30rem]"
           role="img" aria-label="학과별 취업률 순위">
        {bars.map((b, i) => {
          const y = i * (H + GAP);
          const w = Math.max(4, (Math.min(b.value, max) / max) * plotW);
          const r = 4;
          const path = `M${LABEL} ${y + 5}h${w - r}a${r} ${r} 0 0 1 ${r} ${r}v${H - 10 - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}H${LABEL}z`;
          return (
            <g key={b.label}>
              <title>{`${b.label} ${b.value}${unit}${b.note ? ` · ${b.note}` : ""}`}</title>
              <text x={LABEL - 8} y={y + H / 2 + 4.5} textAnchor="end" fontSize="12.5"
                    fill="#2E2B4F" fontFamily="inherit">{b.label}</text>
              <rect x={LABEL} y={y + 5} width={plotW} height={H - 10} fill="#F7F7FB" rx="4" />
              <path d={path} fill="#5A4BE0" />
              <text x={LABEL + w + 6} y={y + H / 2 + 4.5} fontSize="12" fill="#6B6885"
                    fontFamily="inherit" className="num">{b.value}{unit}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
