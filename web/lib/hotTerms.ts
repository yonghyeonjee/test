import { unstable_cache } from "next/cache";
import { db, dbConfigured } from "./db";
import { rankHot, type LogRows } from "./hotRank";
import { HOT_BUSINESS, HOT_WELFARE } from "./thesaurus";

/** 서버 쪽: 기록을 읽어 세고 하루 동안 둔다. 세는 규칙은 lib/hotRank.ts(순수, 시험 가능). */
export type HotTerms = { welfare: string[]; business: string[]; days: number; from: "log" | "default" };

async function fetchRows(days: number): Promise<LogRows> {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const [v, s] = await Promise.all([
    db.from("visit_log").select("term,landing").gte("at", since).limit(5000),
    db.from("search_log").select("kind,household,employment,biz_field,biz_target,entry").gte("at", since).neq("entry", "policies").limit(5000),
  ]);
  if (v.error) throw v.error;
  if (s.error) throw s.error;
  return { visits: (v.data ?? []) as LogRows["visits"], searches: (s.data ?? []) as LogRows["searches"] };
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
export const getHotTerms = unstable_cache(load, ["hot-terms-v1"], { revalidate: 86400 });
