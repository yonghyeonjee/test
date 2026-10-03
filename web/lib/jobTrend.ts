import { cache } from "react";
import { db, dbConfigured } from "./db";

/**
 * 기관별 채용 추이. 세는 일은 DB 의 미리 센 표가 한다
 * (job_months·job_org_years·job_org_recent, refresh_site_stats 가 새로 고침).
 *
 * 모인 공고에는 빈 해가 있다. 2008~2014년과 2020년 이후만 있고 2015~2019년은
 * 아직 받아 오지 못했다. 빈 해를 0건으로 그리면 "그 해에 안 뽑았다"는 거짓말이
 * 되므로, 화면은 빈 해를 "자료 없음"으로 따로 그린다.
 */

export type MonthRow = { ym: string; n: number; orgs: number };
export type YearRow = { y: number; n: number };
export type OrgRecent = { org: string; n12: number; p12: number };

export type JobTrend = {
  months: MonthRow[];
  years: YearRow[];
  /** 최근 12개월 공고 수와 그 전 12개월. */
  n12: number;
  p12: number;
};

export const getJobTrend = cache(async (): Promise<JobTrend | null> => {
  if (!dbConfigured) return null;
  try {
    const { data, error } = await db.from("job_months").select("ym,n,orgs").order("ym", { ascending: true }).limit(400);
    if (error || !data?.length) return null;
    const months = (data as { ym: string; n: number; orgs: number }[]).map((r) => ({ ym: String(r.ym).slice(0, 7), n: Number(r.n), orgs: Number(r.orgs) }));
    const byYear = new Map<number, number>();
    for (const m of months) byYear.set(+m.ym.slice(0, 4), (byYear.get(+m.ym.slice(0, 4)) ?? 0) + m.n);
    const years = Array.from(byYear, ([y, n]) => ({ y, n })).sort((a, b) => a.y - b.y);
    // 이번 달은 아직 덜 찼다. 최근 12개월은 지난달까지 꽉 찬 열두 달로 센다.
    const full = months.slice(0, -1);
    const n12 = full.slice(-12).reduce((a, m) => a + m.n, 0);
    const p12 = full.slice(-24, -12).reduce((a, m) => a + m.n, 0);
    return { months, years, n12, p12 };
  } catch {
    return null;
  }
});

/** 최근 1년 공고가 많은 기관. */
export async function getBusyOrgs(limit = 10): Promise<OrgRecent[]> {
  if (!dbConfigured) return [];
  try {
    const { data } = await db.from("job_org_recent").select("org,n12,p12").order("n12", { ascending: false }).limit(limit);
    return (data ?? []) as OrgRecent[];
  } catch {
    return [];
  }
}

/**
 * 지난해보다 많이 늘어난 기관. 작은 숫자의 배수(1건 → 4건)는 뜻이 없어
 * 그 전 해 10건 이상, 올해 20건 이상인 곳만 본다.
 */
export async function getRisingOrgs(limit = 8): Promise<OrgRecent[]> {
  if (!dbConfigured) return [];
  try {
    const { data } = await db.from("job_org_recent").select("org,n12,p12")
      .gte("p12", 10).gte("n12", 20).order("n12", { ascending: false }).limit(400);
    return ((data ?? []) as OrgRecent[])
      .filter((r) => r.n12 >= r.p12 * 1.3)
      .sort((a, b) => b.n12 / b.p12 - a.n12 / a.p12)
      .slice(0, limit);
  } catch {
    return [];
  }
}

export type OrgTrend = {
  years: YearRow[];
  n12: number;
  p12: number;
  /** 최근 1년 공고 수로 줄 세운 순위(1부터)와 1년 안에 공고를 낸 기관 수. */
  rank: number | null;
  ranked: number;
  /** 채용 지수. 평소(2020년~지난해 연평균) = 100. 근거가 모자라면 null. */
  index: number | null;
  /** 지수의 기준이 된 연평균과 그 해들. */
  base: { avg: number; from: number; to: number } | null;
};

export const getOrgTrend = cache(async (org: string): Promise<OrgTrend | null> => {
  if (!dbConfigured) return null;
  try {
    const [ys, rc] = await Promise.all([
      db.from("job_org_years").select("y,n").eq("org", org).order("y", { ascending: true }),
      db.from("job_org_recent").select("n12,p12").eq("org", org).maybeSingle(),
    ]);
    if (ys.error) return null;
    const years = ((ys.data ?? []) as YearRow[]).map((r) => ({ y: Number(r.y), n: Number(r.n) }));
    const n12 = Number((rc.data as { n12?: number } | null)?.n12 ?? 0);
    const p12 = Number((rc.data as { p12?: number } | null)?.p12 ?? 0);
    let rank: number | null = null;
    let ranked = 0;
    if (n12 > 0) {
      const [above, all] = await Promise.all([
        db.from("job_org_recent").select("org", { count: "exact", head: true }).gt("n12", n12),
        db.from("job_org_recent").select("org", { count: "exact", head: true }).gt("n12", 0),
      ]);
      if (!above.error && above.count != null) rank = above.count + 1;
      ranked = all.count ?? 0;
    }
    const { index, base } = hireIndex(years, n12);
    return { years, n12, p12, rank, ranked, index, base };
  } catch {
    return null;
  }
});

/**
 * 채용 지수 = 최근 12개월 공고 수 ÷ 평소 한 해 공고 수 × 100.
 * 평소는 2020년(지금 자료가 끊김 없이 이어지는 첫 해)부터 지난해까지의 연평균.
 * 그 기관의 첫 공고가 2020년 뒤면 그 해부터 센다. 공고가 없던 해는 0건이다
 * (2020년 이후는 빠짐없이 모였다). 기준이 두 해 미만이거나 연평균 3건 미만이면
 * 들쭉날쭉해서 지수를 내지 않는다.
 */
export function hireIndex(years: YearRow[], n12: number, thisYear = new Date().getFullYear()) {
  const recent = years.filter((r) => r.y >= 2020 && r.y < thisYear);
  if (!recent.length) return { index: null, base: null };
  const from = Math.max(2020, recent[0].y);
  const to = thisYear - 1;
  const span = to - from + 1;
  if (span < 2) return { index: null, base: null };
  const avg = recent.reduce((a, r) => a + r.n, 0) / span;
  if (avg < 3) return { index: null, base: null };
  return { index: Math.round((n12 / avg) * 100), base: { avg: Math.round(avg * 10) / 10, from, to } };
}

/** 지수를 사람 말로. */
export function indexWord(i: number): string {
  if (i >= 150) return "평소보다 훨씬 많이 뽑는 중";
  if (i >= 115) return "평소보다 많이 뽑는 중";
  if (i >= 85) return "평소만큼 뽑는 중";
  if (i >= 50) return "평소보다 적게 뽑는 중";
  return "평소보다 훨씬 적게 뽑는 중";
}

/** 증감 %. 그 전 값이 없으면 null. */
export function pctChange(now: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((now - prev) / prev) * 100);
}

/**
 * 공고 제목에서 고용 형태와 자주 나오는 자리 이름.
 * 화면의 "어떤 자리를 주로 뽑나"와 준비 안내가 쓴다.
 */
const KINDS: [RegExp, string][] = [
  [/공무직|무기계약/, "공무직"],
  [/기간제|계약직|한시/, "기간제"],
  [/임기제/, "임기제"],
  [/군무원|군무경력관/, "군무원"],
  [/인턴/, "청년인턴"],
  [/전문경력관/, "전문경력관"],
  [/시간선택/, "시간선택제"],
  [/청원경찰/, "청원경찰"],
  [/연구원|연구직|박사후/, "연구직"],
  [/정규직|일반직/, "정규직·일반직"],
];

const STOP = new Set([
  "채용", "공고", "모집", "공개", "선발", "계획", "재공고", "추가", "시행", "안내", "제출", "서류", "합격자", "결과",
  "근로자", "직원", "인력", "직렬", "분야", "명", "년도", "년", "차", "제", "및", "등", "관련", "담당", "업무",
  "공무직", "무기계약", "무기계약직", "기간제", "계약직", "임기제", "공무원", "시간선택제", "전문경력관", "청원경찰", "정규직", "일반직",
  "상반기", "하반기", "경력", "경력경쟁", "경쟁", "신규", "통합", "단시간", "대체", "육아휴직", "휴직", "결원", "충원",
  "공무직근로자", "기간제근로자", "주관", "전반기", "후반기", "채용시험", "채용공고", "경력경쟁채용", "경력경쟁채용시험",
  "변경", "수정", "시험", "연기", "최종", "공개모집", "개방형", "직위", "소속", "본부", "부대", "기관", "센터",
]);

/** 합격자 발표·면접 일정 같은 안내 공고. 어떤 자리를 뽑는지 셀 때는 뺀다. */
export const NOTICE_RE = /합격자|면접|서류전형|일정|발표|시행계획|계획 안내|결과/;

export type TitleMix = { kinds: { label: string; n: number }[]; words: { word: string; n: number }[]; total: number };

export function titleMix(all: string[], org: string): TitleMix {
  const titles = all.filter((t) => !NOTICE_RE.test(t));
  const kinds = new Map<string, number>();
  const words = new Map<string, number>();
  const orgBits = new Set(org.split(/\s+/));
  for (const t of titles) {
    for (const [re, label] of KINDS) if (re.test(t)) kinds.set(label, (kinds.get(label) ?? 0) + 1);
    const seen = new Set<string>();
    // 괄호 안이 제일 쓸모 있다("기간제근로자(사후검토분석관)"). 괄호를 지우지 않고 낱말 경계로만 쓴다.
    for (const raw of t.split(/[^가-힣A-Za-z]+/)) {
      const w = raw.replace(/(채용|모집|공고)$/, "");
      if (w.length < 2 || w.length > 10 || STOP.has(w) || orgBits.has(w) || /(년도|차수)$/.test(w)) continue;
      // 고용 형태(전문임기제·청년인턴)는 위에서 따로 셌고, 부대·군 이름은 자리가 아니다.
      if (KINDS.some(([re]) => re.test(w)) || /^(육군|해군|공군|국군|해병대)$|부대$/.test(w)) continue;
      if (seen.has(w)) continue;
      seen.add(w);
      words.set(w, (words.get(w) ?? 0) + 1);
    }
  }
  const total = titles.length;
  return {
    kinds: Array.from(kinds, ([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
    // 한 번만 나온 말은 그 공고의 사정이다. 두 번 이상, 그리고 스물다섯 건에 한 번꼴 이상.
    words: Array.from(words, ([word, n]) => ({ word, n }))
      .filter((x) => x.n >= 2 && x.n >= total * 0.04)
      .sort((a, b) => b.n - a.n)
      .slice(0, 10),
    total,
  };
}
