import { unstable_cache } from "next/cache";
import { db, dbConfigured } from "./db";
import type { License } from "./qnet";

/**
 * 같은 등급 종목 사이에서 이 종목의 자리(2026-11-27).
 *
 * 큐넷 종목 안내는 그 종목의 응시자·합격률만 보여 준다. "기능사 가운데 몇 번째로 많이 보는 시험인지",
 * "같은 등급의 다른 종목보다 붙기 쉬운지"는 모든 종목의 통계를 모아 나란히 세워야 보인다. 원문에 없는 내용이라
 * 종목 쪽의 고유 자료로 싣는다(지원사업 쪽의 지역 간 비교 lib/programCompare 와 같은 생각).
 *
 * 숫자는 exam_stats 의 최근 세 해. 접수자는 단계(필기·실기)를 더한 값, 합격률은 단계별로 합격자/응시자를 내어
 * 가장 낮은 단계 것을 쓴다(그 시험의 문턱). 응시자가 30명이 안 되는 종목은 합격률 순위에서 뺀다(몇 명에 출렁인다).
 */

export type LicenseNum = { code: string; applicants: number; rate: number | null };

async function load(): Promise<LicenseNum[]> {
  if (!dbConfigured) return [];
  type R = { code: string; year: number; stage: string; applicants: number | null; takers: number | null; passers: number | null };
  const since = new Date().getFullYear() - 3;
  const rows: R[] = [];
  for (let from = 0; from < 12_000; from += 1000) {
    const { data, error } = await db.from("exam_stats").select("code,year,stage,applicants,takers,passers")
      .gte("year", since).order("id").range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as R[]));
    if (!data || data.length < 1000) break;
  }
  const by = new Map<string, { applicants: number; stage: Map<string, { t: number; p: number }> }>();
  for (const r of rows) {
    const x = by.get(r.code) ?? { applicants: 0, stage: new Map() };
    x.applicants += r.applicants ?? 0;
    const s = x.stage.get(r.stage) ?? { t: 0, p: 0 };
    s.t += r.takers ?? 0; s.p += r.passers ?? 0;
    x.stage.set(r.stage, s);
    by.set(r.code, x);
  }
  return [...by].map(([code, x]) => {
    const rates = [...x.stage.values()].filter((s) => s.t >= 30).map((s) => (s.p / s.t) * 100);
    return { code, applicants: x.applicants, rate: rates.length ? Math.round(Math.min(...rates) * 10) / 10 : null };
  });
}

/** 여섯 시간마다 다시 센다(통계는 한 해에 한 번 바뀐다). 못 읽으면 빈 목록 — 칸이 빠질 뿐이다. */
const getNums = unstable_cache(async () => {
  try { return await load(); } catch { return [] as LicenseNum[]; }
}, ["license-nums-v1"], { revalidate: 21600 });

export type LicenseRank = {
  series: string;
  /** 같은 등급에서 접수자 통계가 있는 종목 수와 이 종목의 순위(많은 순). */
  n: number; rank: number; applicants: number;
  /** 합격률: 이 종목, 같은 등급의 가운데값, 붙기 쉬운 순위(높은 순). 응시자가 적어 못 낸 종목은 null. */
  rate: number | null; median: number | null; rateRank: number | null; rateN: number;
  /** 같은 등급에서 가장 많이 보는 종목(이 종목 빼고 셋). */
  top: { code: string; name: string; applicants: number }[];
};

export async function getLicenseRank(l: License, all: License[]): Promise<LicenseRank | null> {
  const nums = new Map((await getNums()).map((x) => [x.code, x]));
  const me = nums.get(l.code);
  if (!me || me.applicants <= 0) return null;
  const peers = all.filter((x) => x.series === l.series).flatMap((x) => {
    const v = nums.get(x.code);
    return v && v.applicants > 0 ? [{ ...v, name: x.name }] : [];
  });
  if (peers.length < 5) return null;   // 견줄 종목이 너무 적으면 순위가 뜻이 없다
  const byApp = peers.slice().sort((a, b) => b.applicants - a.applicants);
  const rated = peers.filter((x) => x.rate !== null).sort((a, b) => (b.rate as number) - (a.rate as number));
  const mid = rated.length ? (rated[Math.floor((rated.length - 1) / 2)].rate as number) : null;
  return {
    series: l.series,
    n: peers.length, rank: byApp.findIndex((x) => x.code === l.code) + 1, applicants: me.applicants,
    rate: me.rate, median: mid,
    rateRank: me.rate !== null ? rated.findIndex((x) => x.code === l.code) + 1 : null, rateN: rated.length,
    top: byApp.filter((x) => x.code !== l.code).slice(0, 3).map((x) => ({ code: x.code, name: x.name, applicants: x.applicants })),
  };
}
