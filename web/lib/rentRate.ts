import { callOpenApi, openApiConfigured } from "./openapi";

/**
 * 전세자금대출 금리 정보 (한국주택금융공사).
 *
 * 주택금융공사가 보증하는 전세자금 대출을 취급하는 은행별 금리를 하루 한 번
 * 갱신해 공개한다. 응답 항목 이름이 interest1_1 처럼 뜻을 알 수 없게 되어
 * 있어, 명세의 국문 항목명대로 이름을 다시 붙여 둔다.
 *
 *   interest1_* 부분보증비율   interest2_* 기준금리
 *   interest3_* 가산금리       interest4_* 적용금리
 *
 * 끝의 _1 / _2 는 부분보증비율이 다른 두 가지 조건이다(예: 90% / 100%).
 */

const URL = "http://apis.data.go.kr/B551408/rent-loan-rate-info/rate-list";

export type RateTier = {
  /** 부분보증비율(%) */
  ratio: number | null;
  base: number | null;
  extra: number | null;
  /** 실제로 내가 내는 금리 */
  rate: number | null;
};

export type BankRate = {
  bank: string;
  callCenter: string | null;
  tiers: RateTier[];
  /** 가장 낮은 적용금리. 정렬과 요약에 쓴다. */
  low: number | null;
};

export type RateBoard = {
  ok: boolean;
  reason: string | null;
  /** 기준 주간 (YYYYMMDD) */
  from: string | null;
  to: string | null;
  banks: BankRate[];
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown): string | null => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s.length ? s : null;
};

export const rateApiConfigured = openApiConfigured;

export async function getRentRates(): Promise<RateBoard> {
  const res = await callOpenApi<Record<string, unknown>>(
    URL,
    { numOfRows: 100, pageNo: 1, dataType: "JSON" },
    21600,
  );
  if (!res.ok) return { ok: false, reason: res.reason, from: null, to: null, banks: [] };

  const banks: BankRate[] = [];
  let from: string | null = null;
  let to: string | null = null;

  for (const r of res.rows) {
    const bank = str(r.organId);
    if (!bank) continue;
    from ??= str(r.bssYmdStart);
    to ??= str(r.bssYmdEnd);

    const tier = (i: string): RateTier => ({
      ratio: num(r[`interest1_${i}`]),
      base: num(r[`interest2_${i}`]),
      extra: num(r[`interest3_${i}`]),
      rate: num(r[`interest4_${i}`]),
    });
    // 값이 하나도 없는 조건은 화면에 줄만 차지한다.
    const tiers = [tier("1"), tier("2")].filter(
      (t) => t.rate !== null || t.base !== null || t.extra !== null,
    );
    const rates = tiers.map((t) => t.rate).filter((n): n is number => n !== null);
    banks.push({
      bank,
      callCenter: str(r.callCenter),
      tiers,
      low: rates.length ? Math.min(...rates) : null,
    });
  }

  // 금리가 낮은 은행부터. 값이 없는 곳은 뒤로 민다.
  banks.sort((a, b) => (a.low ?? 99) - (b.low ?? 99) || a.bank.localeCompare(b.bank, "ko"));

  return {
    ok: banks.length > 0,
    reason: banks.length ? null : "조회 결과가 비어 있습니다.",
    from,
    to,
    banks,
  };
}

/** 20260415 → 2026.04.15 */
export function ymd(v: string | null) {
  if (!v || v.length !== 8) return null;
  return `${v.slice(0, 4)}.${v.slice(4, 6)}.${v.slice(6)}`;
}

export const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(2)}%`);
