/**
 * 청년미래적금 계산.
 *
 * 기사에는 "연 14.4% 효과" 같은 숫자가 크게 실리지만, 그건 정부기여금과
 * 비과세를 이자로 환산한 값이라 통장에 찍히는 금액이 아니다. 여기서는
 * 원금·정부기여금·이자를 나눠서 금액 그대로 낸다. 화면과 그림이 같은
 * 식을 쓰도록 계산은 한 곳에만 둔다.
 *
 * 출처: 금융위원회·서민금융진흥원 안내(2026년 9월 기준).
 */

/** 3년 만기. */
export const MONTHS = 36;
/** 첫 달 넣은 돈은 36개월, 마지막 달은 1개월치 이자가 붙는다. 36+35+…+1 */
export const MONTH_SUM = (MONTHS * (MONTHS + 1)) / 2;
/** 이자소득세. 이 상품은 비과세라 이만큼을 안 뗀다. */
export const TAX = 0.154;
/** 월 납입 한도. */
export const MAX_MONTHLY = 500_000;
/** 기본금리(전 은행 공통). */
export const BASE_RATE = 5;

export type Plan = {
  key: string;
  label: string;
  /** 정부기여금 매칭 비율(%). */
  pct: number;
  /** 월 기여금 한도(원). */
  cap: number;
  who: string;
};

export const PLANS: Plan[] = [
  { key: "pref", label: "우대형", pct: 12, cap: 60_000, who: "중소기업 재직자 등 · 총급여 3,600만원 이하" },
  { key: "std", label: "일반형", pct: 6, cap: 30_000, who: "총급여 6,000만원 이하" },
  { key: "none", label: "기여금 없음", pct: 0, cap: 0, who: "총급여 6,000만원 초과 7,500만원 이하 · 비과세만" },
];

export type Estimate = {
  principal: number;
  match: number;
  interest: number;
  tax: number;
  total: number;
  /** 같은 금리의 보통 적금. 기여금이 없고 이자에서 세금을 뗀다. */
  plain: number;
};

export function estimate(monthly: number, plan: Plan, rate: number): Estimate {
  const principal = monthly * MONTHS;
  const match = Math.min(Math.floor((monthly * plan.pct) / 100), plan.cap) * MONTHS;
  const interest = (monthly * (rate / 100) * MONTH_SUM) / 12;
  const tax = interest * TAX;
  return {
    principal,
    match,
    interest,
    tax,
    total: principal + match + interest,
    plain: principal + interest - tax,
  };
}

export const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

/** 1,917만원처럼. 견줄 때는 만원 아래가 눈을 어지럽힌다. */
export const manwon = (n: number) => `${Math.round(n / 10_000).toLocaleString("ko-KR")}만원`;
