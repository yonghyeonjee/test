import { unstable_cache } from "next/cache";
import { db, dbConfigured } from "./db";

/**
 * 보금자리론·디딤돌대출 금리표.
 *
 * pipeline/home_loan_rates.py 가 주택금융공사 누리집에서 읽어 site_settings 의
 * home_loan_rates 에 넣어 둔 것을 그대로 쓴다. 화면에서 직접 긁지 않는다 —
 * 누리집이 느리거나 막혀도 쪽은 지난달 표를 들고 열려야 한다.
 */

export type RateRow = { name: string; rates: number[] };
export type BandRow = { band: string; rates: number[] };
export type Pref = { item: string; cond: string; pct: number };

export type HomeLoanRates = {
  ok: boolean;
  checked: string;
  bogeumjari: {
    month: string | null; notice: string | null; terms: string[]; rows: RateRow[];
    notes: string[]; prefs: Pref[]; extras: Pref[];
  };
  didimdol: {
    month: string | null; notice: string | null;
    general: { terms: string[]; rows: BandRow[] } | null;
    first_newlywed: { terms: string[]; rows: BandRow[] } | null;
    notes: string[]; prefs: string[]; floor: string | null;
  };
};

async function load(): Promise<HomeLoanRates | null> {
  if (!dbConfigured) return null;
  try {
    const { data } = await db.from("settings_public").select("value").eq("key", "home_loan_rates").maybeSingle();
    const v = (data as { value: HomeLoanRates } | null)?.value;
    return v && v.ok ? v : null;
  } catch {
    return null;
  }
}

export const getHomeLoanRates = unstable_cache(load, ["home-loan-rates"], { revalidate: 3600 });

/** "2026-10" → "2026년 10월" */
export const monthLabel = (m: string | null) =>
  m && /^\d{4}-\d{2}$/.test(m) ? `${m.slice(0, 4)}년 ${Number(m.slice(5))}월` : null;

export const pct = (n: number) => `${n.toFixed(2)}%`;

/** 디딤돌 표에서 가장 낮은 금리(생애최초 신혼 표가 있으면 그쪽). */
export function lowestDidimdol(r: HomeLoanRates) {
  const t = r.didimdol.first_newlywed ?? r.didimdol.general;
  if (!t) return null;
  return Math.min(...t.rows.flatMap((x) => x.rates));
}
