/**
 * 지역별 대상 구성 막대.
 *
 * 한 가지 값(사업 수)을 다섯 갈래로 나눠 크기만 비교하는 그림이라
 * 갈래마다 색을 달리하지 않는다. 색이 뜻을 지지 않으면 색맹 문제도,
 * 범례도 필요 없어진다 — 갈래는 왼쪽 이름으로 읽고, 크기는 길이로 읽는다.
 *
 * 값은 막대 끝에 직접 붙인다. 다섯 개뿐이라 축과 눈금선을 그리는 것보다
 * 그편이 짧고 정확하다.
 */

export type AreaBar = { label: string; full: string; n: number; href: string };

const W = 360;
const PAD_TOP = 12;
const ROW = 32;
const BAR_H = 14;
const R = 4;
const X0 = 96; // 막대 시작 (왼쪽은 이름 자리)
const X1 = 300; // 막대가 최대로 닿는 곳

/** 데이터 쪽 끝만 둥글게. 기준선 쪽은 각지게 붙여 둔다. */
function barPath(w: number, y: number) {
  if (w <= R) return `M${X0} ${y}h${Math.max(w, 1)}v${BAR_H}h${-Math.max(w, 1)}Z`;
  const x = X0 + w;
  return (
    `M${X0} ${y}` +
    `H${x - R}a${R} ${R} 0 0 1 ${R} ${R}` +
    `V${y + BAR_H - R}a${R} ${R} 0 0 1 ${-R} ${R}` +
    `H${X0}Z`
  );
}

export default function AreaChart({
  sido,
  bars,
}: {
  sido: string;
  bars: AreaBar[];
}) {
  const rows = bars.filter((b) => b.n > 0);
  if (rows.length < 2) return null;

  const max = Math.max(...rows.map((b) => b.n));
  const H = PAD_TOP + rows.length * ROW;

  return (
    <figure className="mt-8">
      <figcaption className="text-sm font-bold">
        {sido}는 어떤 분들을 위한 사업이 많은가
      </figcaption>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        조건이 확인되는 사업만 세었습니다. 막대를 누르면 그 조건으로 바로 찾습니다.
      </p>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="mt-3 max-w-[26rem]"
        role="img"
        aria-label={`${sido} 지원사업을 대상별로 나눈 막대그래프. ${rows
          .map((b) => `${b.full} ${b.n}건`)
          .join(", ")}.`}
      >
        {rows.map((b, i) => {
          const y = PAD_TOP + i * ROW;
          const w = Math.round((b.n / max) * (X1 - X0));
          const mid = y + BAR_H / 2;
          return (
            <a key={b.label} href={b.href}>
              {/* 한 덩어리 문자열로 넣는다. 조각을 나눠 넣으면 서버와
                  브라우저가 만드는 텍스트 노드가 달라져 하이드레이션이 깨진다. */}
              <title>{`${b.full} ${b.n}건 — 눌러서 이 조건으로 찾기`}</title>

              {/* 누르기 쉬우라고 행 전체를 판으로 깐다. 보이지는 않는다. */}
              <rect x="0" y={y - 9} width={W} height={ROW} fill="transparent" />

              <text
                x="88"
                y={mid}
                textAnchor="end"
                dominantBaseline="central"
                fontSize="11.5"
                fill="#2B3A4F"
              >
                {b.label}
              </text>

              <path d={barPath(w, y)} fill="#0B5FA5" />

              <text
                x={X0 + w + 7}
                y={mid}
                dominantBaseline="central"
                fontSize="11.5"
                fontWeight="700"
                fill="#5F6E82"
              >
                {b.n}
              </text>
            </a>
          );
        })}

        {/* 기준선. 눈에 걸리지 않을 만큼만. */}
        <line
          x1={X0 - 0.5}
          y1={PAD_TOP - 6}
          x2={X0 - 0.5}
          y2={H - ROW + BAR_H + 6}
          stroke="#E1E7F0"
          strokeWidth="1"
        />
      </svg>
    </figure>
  );
}
