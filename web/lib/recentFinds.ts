import { unstable_cache } from "next/cache";
import { db, dbConfigured } from "./db";

/**
 * "방금 찾아본 조건". 숨고 첫 화면의 실시간 요청 띠처럼, 남들이 어떤 조건으로 찾는지
 * 보여 주어 "나도 해 볼까"를 끌어낸다.
 *
 * 기록(search_log)은 공개 키로 못 읽는다. sql/012 의 함수가 시·도·나이대·상태·건수·몇 분
 * 전만 돌려준다 — 시·군·구와 가구 특성(저소득·장애인 등)은 돌려주지 않는다. 사람이
 * 직접 고른 것(form·last·chip)만, 결과가 있었던 것만.
 */
export type RecentFind = {
  sido: string; ageBand: string | null; employment: string | null; n: number; agoMin: number;
};

async function load(): Promise<RecentFind[]> {
  if (!dbConfigured) return [];
  try {
    const { data, error } = await db.rpc("recent_search_rows", { p_limit: 8 });
    if (error) throw error;
    type Row = { sido: string; age_band: string | null; employment: string | null; n_results: number; ago_min: number };
    return ((data ?? []) as Row[]).map((r) => ({
      sido: r.sido, ageBand: r.age_band, employment: r.employment, n: r.n_results, agoMin: r.ago_min,
    }));
  } catch (e) {
    console.warn("[recentFinds]", e instanceof Error ? e.message : e);
    return [];
  }
}

/** 10분마다. 첫 화면(900초)이 가져갈 때 그때 것. */
export const getRecentFinds = unstable_cache(load, ["recent-finds-v1"], { revalidate: 600 });

/** "12분 전" · "3시간 전" · "2일 전". 캐시 때문에 몇 분은 어긋난다 — 그래서 분은 5분 단위로 뭉갠다. */
export function agoLabel(min: number) {
  if (min < 5) return "방금";
  if (min < 60) return `${Math.floor(min / 5) * 5}분 전`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 전`;
  return `${Math.floor(min / 1440)}일 전`;
}
