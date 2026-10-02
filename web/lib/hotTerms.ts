import { unstable_cache } from "next/cache";
import { db, dbConfigured } from "./db";
import { rankHot, type LogRows } from "./hotRank";
import { HOT_BUSINESS, HOT_WELFARE } from "./thesaurus";

/** 서버 쪽: 기록을 읽어 세고 하루 동안 둔다. 세는 규칙은 lib/hotRank.ts(순수, 시험 가능). */
export type HotTerms = { welfare: string[]; business: string[]; days: number; from: "log" | "default" };

/**
 * 기록은 묶음과 건수로만 받는다(sql/005_hot_term_rows.sql). visit_log 는 공개 키로
 * 읽을 수 없게 막혀 있고, 막혀 있어야 한다 — 원문 한 줄을 열지 않는다.
 */
async function fetchRows(days: number): Promise<LogRows> {
  const { data, error } = await db.rpc("hot_term_rows", { p_days: days });
  if (error) throw error;
  type Row = { src: string; term: string | null; landing: string | null; kind: string | null;
               household: string[] | null; biz_field: string[] | null; biz_target: string | null; n: number };
  const rows = (data ?? []) as Row[];
  return {
    visits: rows.filter((r) => r.src === "term" || r.src === "landing")
      .map((r) => ({ term: r.src === "term" ? r.term : null, landing: r.src === "landing" ? r.landing : null, n: r.n })),
    searches: rows.filter((r) => r.src === "search")
      .map((r) => ({ kind: r.kind, household: r.household, biz_field: r.biz_field, biz_target: r.biz_target, n: r.n })),
  };
}

async function load(): Promise<HotTerms> {
  const dflt: HotTerms = { welfare: HOT_WELFARE, business: HOT_BUSINESS, days: 0, from: "default" };
  if (!dbConfigured) return dflt;
  try {
    for (const days of [7, 30]) {
      const r = rankHot(await fetchRows(days));
      if (r.fromLog) return { welfare: r.welfare, business: r.business, days, from: "log" };
    }
  } catch (e) {
    console.warn("[hotTerms]", e instanceof Error ? e.message : e);
  }
  return dflt;
}

/** 하루에 한 번. 첫 화면(900초 재생성)이 그날 것을 집어 간다. */
export const getHotTerms = unstable_cache(load, ["hot-terms-v2"], { revalidate: 86400 });
