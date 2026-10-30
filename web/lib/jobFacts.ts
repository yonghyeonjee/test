import { cache } from "react";
import { db, dbConfigured } from "./db";
import { getOrgStat, peakMonths, type Job, type OrgStat } from "./pubJobs";
import { getOrgTrend, hireIndex, indexWord } from "./jobTrend";

/**
 * 공고 하나를 둘러싼 "이 사이트만의 숫자"(2026-10-30).
 *
 * 공고 원문을 그대로 실은 사이트(나라일터·korea.kr·복사 사이트)에는 없는 것만 모은다 — 이 기관이 얼마나 자주,
 * 언제 뽑는지, 이 공고의 접수 기간이 그 기관 평소와 견줘 긴지 짧은지, 지금 같은 지역에 열린 자리가 몇인지.
 * 검색엔진이 "원문이 있는데 복사본은 필요 없다"고 보는 판정에서 벗어나려면 쪽마다 다른 사실이 본문 앞쪽과
 * 설명문에 있어야 한다. 전부 미리 센 표(job_org_stats·job_org_years·job_org_recent)와 머리글 count 하나라
 * 공고 쪽 하나에 몇 ms 다. 못 읽으면 그 항목만 빠진다.
 */
export type JobFacts = {
  /** 접수 마감까지 남은 날(오늘 마감 = 0). 마감 지났거나 마감일 없으면 null. */
  daysLeft: number | null;
  /** 이 공고의 접수 기간(일). 시작·마감이 다 있을 때. */
  periodDays: number | null;
  /** 이 기관의 평소 접수 기간(일, 나라일터 공고 평균). */
  orgAvgDays: number | null;
  /** 이 기관 나라일터 공고 전체 수와 첫 공고 연도. */
  orgTotal: number;
  orgSince: string | null;
  /** 최근 12개월 공고 수, 1년 안에 공고 낸 기관 가운데 순위. */
  n12: number;
  rank: number | null;
  ranked: number;
  /** 채용 지수 말(평소보다 많이 뽑는 중 …). 근거가 모자라면 null. */
  pace: string | null;
  /** 공고가 몰리는 달. */
  peak: { label: string; share: number } | null;
  /** 이 기관이 지금 접수 중인 공고 수. */
  orgOpen: number;
  /** 같은 시·도(공고의 지역 칸 기준) 접수 중 공고 수. 못 셌으면 null. */
  regionOpen: number | null;
  /** 1월~12월 공고 수(길이 12). 비어 있으면 그리지 않는다. */
  months: number[];
  stat: OrgStat | null;
};

const DAY = 86400_000;

/** 한국 날짜(YYYY-MM-DD). 공고의 마감은 한국 날짜다. */
function todayKst() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY);
}

async function countRegionOpen(region: string, today: string): Promise<number | null> {
  if (!dbConfigured) return null;
  try {
    // (source, region, reg_date) 색인을 타게 출처마다 따로 묻지 않고 region 하나로 센다 — 머리글 count 라 가볍다.
    const { count, error } = await db
      .from("job_posts").select("source_id", { count: "exact", head: true })
      .eq("region", region).gte("end_date", today);
    if (error) return null;
    return count ?? null;
  } catch {
    return null;
  }
}

export const getJobFacts = cache(async (job: Job): Promise<JobFacts> => {
  const today = todayKst();
  const [stat, trend, regionOpen] = await Promise.all([
    job.org ? getOrgStat(job.org) : Promise.resolve(null),
    job.org ? getOrgTrend(job.org) : Promise.resolve(null),
    job.region ? countRegionOpen(job.region, today) : Promise.resolve(null),
  ]);
  const daysLeft = job.end && job.end >= today ? daysBetween(today, job.end) : null;
  const periodDays = job.start && job.end && job.end >= job.start ? daysBetween(job.start, job.end) + 1 : null;
  const idx = trend ? hireIndex(trend.years, trend.n12) : { index: null };
  return {
    daysLeft,
    periodDays,
    orgAvgDays: stat?.avgDays ?? null,
    orgTotal: stat?.n ?? 0,
    orgSince: stat?.firstReg ? stat.firstReg.slice(0, 4) : null,
    n12: trend?.n12 ?? 0,
    rank: trend?.rank ?? null,
    ranked: trend?.ranked ?? 0,
    pace: idx.index != null ? indexWord(idx.index) : null,
    peak: stat ? peakMonths(stat.months) : null,
    orgOpen: stat?.openN ?? 0,
    regionOpen,
    months: stat?.months ?? [],
    stat,
  };
});

/** 기관 이름의 윗기관을 뗀 짧은 꼴("대법원 수원지방법원" → "수원지방법원"). 화면과 설명문이 같이 쓴다. */
export function shortOrg(org: string | null) {
  if (!org) return "";
  const parts = org.split(/\s+/);
  return parts.length >= 2 ? parts.slice(1).join(" ") : org;
}

/**
 * 검색 결과 설명문에 넣을 한 줄. 쪽마다 다른 숫자만 적는다. 숫자가 하나도 없으면 빈 문자열.
 * 예: "국가과학기술연구회는 최근 1년 공고 41건(1년 안에 공고 낸 4,012곳 중 212위), 접수 기간 12일(이 기관 평균 9일), 주로 1·2월에 올라옵니다."
 */
export function factsLine(job: Job, f: JobFacts): string {
  const org = shortOrg(job.org) || "이 기관";
  const bits: string[] = [];
  if (f.n12 > 0) bits.push(`최근 1년 공고 ${f.n12}건${f.rank && f.ranked ? `(${f.ranked.toLocaleString("ko-KR")}곳 중 ${f.rank}위)` : ""}`);
  else if (f.orgTotal > 0) bits.push(`나라일터 공고 ${f.orgTotal}건`);
  if (f.periodDays) bits.push(`접수 기간 ${f.periodDays}일${f.orgAvgDays ? `(기관 평균 ${f.orgAvgDays}일)` : ""}`);
  if (f.peak) bits.push(`주로 ${f.peak.label}에 올라옴`);
  if (f.orgOpen > 1) bits.push(`지금 접수 중 ${f.orgOpen}건`);
  if (!bits.length) return "";
  return `${org}은 ${bits.join(", ")}.`;
}
