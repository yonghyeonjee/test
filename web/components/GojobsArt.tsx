/**
 * 나라일터 안내 글의 그림들.
 *
 * 사진 대신 구조와 숫자를 그린다. 나라일터에서 사람들이 막히는 지점은
 * "공고는 여기 있는데 접수는 딴 데서 한다", "마감이 짧다" 두 가지라서,
 * 그 두 가지가 보이면 안내가 절반은 끝난다. 숫자는 나라지원이 최근 1년
 * 동안 받아 둔 나라일터 공고에서 센 것이다(lib 가 아니라 글이 넘긴다).
 *
 * 막대는 한 계열이라 색 하나(브랜드), 범례 없음, 값은 막대 끝에 바로 적는다.
 */

const INK = "#1E1B4B";
const BRAND = "#5B4BE0";
const SOFT = "#ECEAFF";
const MUTED = "#6B6B80";

export type Bar = { label: string; n: number; note?: string };

/** 머리 그림: 공고는 나라일터에 모이고, 접수는 기관마다 다르다. */
export function GojobsHero({ className = "" }: { className?: string }) {
  const ink = "#EAF3EE", dim = "rgba(234,243,238,.55)", hi = "#C4B5FD";
  const orgs = ["중앙부처", "지자체", "교육청·학교", "공공기관"];
  return (
    <svg viewBox="0 0 340 160" className={`w-full ${className}`} role="img"
         aria-label="중앙부처·지자체·교육청·공공기관의 채용 공고가 나라일터 한 곳에 모이고, 나라지원은 그 공고를 매일 받아 조건별로 보여 준다는 그림"
         fontFamily="inherit">
      <rect width="340" height="160" rx="14" fill="#2A2266" />
      <g transform="translate(18 18)">
        {orgs.map((o, i) => (
          <g key={o} transform={`translate(0 ${i * 31})`}>
            <rect width="88" height="24" rx="6" fill="rgba(255,255,255,.12)" stroke={dim} />
            <text x="10" y="16" fontSize="10.5" fill={ink} fontWeight="700">{o}</text>
            <path d={`M92 12 h22`} stroke={dim} strokeWidth="1.5" />
          </g>
        ))}
      </g>
      <path d="M132 30 v93" stroke={dim} strokeWidth="1.5" />
      <path d="M132 77 h18" stroke={dim} strokeWidth="1.5" />
      <path d="M146 72 l6 5 -6 5" fill="none" stroke={dim} strokeWidth="1.5" />
      <g transform="translate(156 48)">
        <rect width="78" height="58" rx="10" fill={hi} />
        <text x="12" y="24" fontSize="12" fill={INK} fontWeight="800">나라일터</text>
        <text x="12" y="41" fontSize="9" fill={INK}>공직 채용 공고</text>
        <text x="12" y="52" fontSize="9" fill={INK}>한 곳에 모임</text>
      </g>
      <path d="M238 77 h18" stroke={dim} strokeWidth="1.5" />
      <path d="M252 72 l6 5 -6 5" fill="none" stroke={dim} strokeWidth="1.5" />
      <g transform="translate(262 40)">
        <rect width="66" height="74" rx="10" fill="rgba(255,255,255,.1)" stroke={hi} />
        <text x="10" y="22" fontSize="11.5" fill={ink} fontWeight="800">나라지원</text>
        <text x="10" y="38" fontSize="8.5" fill={dim}>매일 새로 받아</text>
        <text x="10" y="50" fontSize="8.5" fill={dim}>지역·기관·직무로</text>
        <text x="10" y="62" fontSize="8.5" fill={dim}>골라 보기</text>
      </g>
      <text x="18" y="150" fontSize="8.5" fill={dim}>접수는 공고마다 다릅니다 — 원문에서 확인</text>
    </svg>
  );
}

/**
 * 가로 막대. 한 계열이라 색 하나, 값은 막대 끝에 적는다.
 * pct 가 true 면 전체 대비 %도 같이 적는다.
 */
export function HBars({ bars, unit = "건", pct = false, ariaLabel, className = "" }: {
  bars: Bar[]; unit?: string; pct?: boolean; ariaLabel: string; className?: string;
}) {
  const total = bars.reduce((s, b) => s + b.n, 0) || 1;
  const max = Math.max(...bars.map((b) => b.n)) || 1;
  const row = 26, left = 92, w = 340, barW = w - left - 74;
  const h = bars.length * row + 6;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`w-full ${className}`} role="img" aria-label={ariaLabel}
         fontFamily="inherit">
      {bars.map((b, i) => {
        const y = i * row + 4;
        const bw = Math.max(4, Math.round((b.n / max) * barW));
        const label = pct ? `${Math.round((b.n / total) * 100)}%` : `${b.n.toLocaleString("ko-KR")}${unit}`;
        return (
          <g key={b.label} transform={`translate(0 ${y})`}>
            <text x={left - 8} y="14" fontSize="10.5" fill={INK} textAnchor="end" fontWeight="600">{b.label}</text>
            <rect x={left} y="3" width={barW} height="16" rx="4" fill={SOFT} />
            <rect x={left} y="3" width={bw} height="16" rx="4" fill={BRAND} />
            <text x={left + bw + 6} y="15" fontSize="10.5" fill={INK} fontWeight="700">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** 요일 막대(세로). 월~일 일곱 개, 주말이 거의 비어 있는 게 보이면 된다. */
export function WeekBars({ counts, className = "" }: { counts: number[]; className?: string }) {
  const days = ["월", "화", "수", "목", "금", "토", "일"];
  const max = Math.max(...counts) || 1;
  const w = 340, h = 120, base = 92, colW = 40, x0 = 22;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`w-full ${className}`} role="img"
         aria-label={`요일별 공고 등록 건수. ${days.map((d, i) => `${d}요일 ${counts[i].toLocaleString("ko-KR")}건`).join(", ")}`}
         fontFamily="inherit">
      <line x1={x0 - 6} x2={w - 10} y1={base} y2={base} stroke="#D9D7E8" />
      {counts.map((n, i) => {
        const bh = Math.max(2, Math.round((n / max) * 72));
        const x = x0 + i * (colW + 4);
        const weekend = i >= 5;
        return (
          <g key={days[i]}>
            <rect x={x} y={base - bh} width={colW} height={bh} rx="4" fill={weekend ? "#B9B3F2" : BRAND} />
            <text x={x + colW / 2} y={base - bh - 5} fontSize="9.5" fill={INK} textAnchor="middle" fontWeight="700">
              {n >= 1000 ? `${(n / 1000).toFixed(1)}천` : n}
            </text>
            <text x={x + colW / 2} y={base + 15} fontSize="10.5" fill={MUTED} textAnchor="middle">{days[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}
