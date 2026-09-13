/**
 * 기준 중위소득.
 *
 * "기준 중위소득 180% 이하" 라고만 적힌 공고가 많다. 그 말만으로는
 * 내가 되는지 알 수 없다. 금액으로 바꿔 적어 주려고 표를 둔다.
 *
 * 이 숫자는 보건복지부 장관이 중앙생활보장위원회 심의를 거쳐 해마다
 * 고시한다. 지어내면 안 되는 숫자다 — 아래 값은 고시 발표를 확인해
 * 적은 것이고, 해가 바뀌면 반드시 새 표를 넣어야 한다.
 *
 *   2026년: 제77차 중앙생활보장위원회, 4인 가구 6.51% 인상
 *   2027년: 제80차 중앙생활보장위원회, 4인 가구 6.70% 인상
 *
 * 표에 없는 해가 오면 조용히 옛 숫자를 쓰지 않는다. hasTable() 이
 * false 를 돌려주고, 화면은 금액 대신 "확인이 필요합니다" 를 보여 준다.
 * 낡은 금액을 그럴싸하게 보여 주는 것이 제일 나쁘다.
 */

/** 가구원 수 1~7인의 월 기준 중위소득(원). */
const TABLE: Record<number, number[]> = {
  2026: [2_564_238, 4_199_292, 5_359_036, 6_494_738, 7_556_719, 8_555_952, 9_515_150],
  2027: [2_736_042, 4_480_645, 5_718_091, 6_929_885, 8_063_019, 9_129_201, 10_152_665],
};

/**
 * 8인 이상은 고시에 표가 없다. 7인과 6인의 차액을 한 사람마다 더한다 —
 * 고시가 정한 방식 그대로다.
 */
function step(rows: number[]) {
  return rows[6] - rows[5];
}

export const MIN_SIZE = 1;
/** 화면에서 고르게 할 최대 가구원 수. 그 위는 계산으로 잇는다. */
export const MAX_SIZE = 10;

export function hasTable(year: number) {
  return year in TABLE;
}

/** 올해 적용되는 표의 연도. 없으면 null. */
export function tableYear(now = new Date()): number | null {
  const y = now.getFullYear();
  return hasTable(y) ? y : null;
}

/** 가구원 수의 월 기준 중위소득(100%). 표가 없으면 null. */
export function medianIncome(size: number, year: number): number | null {
  const rows = TABLE[year];
  if (!rows) return null;
  const n = Math.max(MIN_SIZE, Math.round(size));
  if (n <= 7) return rows[n - 1];
  return rows[6] + step(rows) * (n - 7);
}

/** 기준 중위소득 pct% 에 해당하는 월 금액. */
export function standardFor(size: number, pct: number, year: number): number | null {
  const base = medianIncome(size, year);
  return base === null ? null : Math.round((base * pct) / 100);
}

/** 월 소득이 기준 중위소득의 몇 %인가. 소수점 한 자리. */
export function percentOf(monthly: number, size: number, year: number): number | null {
  const base = medianIncome(size, year);
  return base ? Math.round((monthly / base) * 1000) / 10 : null;
}

/**
 * 공고에서 자주 보는 기준선.
 *
 * 32·40·48·50 은 기초생활보장 네 급여의 선정 기준이라 이름을 붙여 둔다.
 * 나머지는 지자체 사업에서 흔히 쓰는 선이다.
 */
export const TIERS: { pct: number; label?: string }[] = [
  { pct: 32, label: "생계급여" },
  { pct: 40, label: "의료급여" },
  { pct: 48, label: "주거급여" },
  { pct: 50, label: "교육급여" },
  { pct: 60 },
  { pct: 70 },
  { pct: 75 },
  { pct: 80 },
  { pct: 100 },
  { pct: 120 },
  { pct: 150 },
  { pct: 180 },
  { pct: 200 },
];

/** 1,234,567 → "1,234,567원" */
export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/**
 * 1,234,567 → "123만원". 표에서 눈으로 견줄 때 쓴다.
 * 만원 아래는 버린다 — 자릿수가 많으면 견주기 어렵다.
 */
export const manwon = (n: number) => `${Math.floor(n / 10_000).toLocaleString("ko-KR")}만원`;
