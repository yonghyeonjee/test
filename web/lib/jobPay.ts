import { unstable_cache } from "next/cache";
import { db, dbConfigured } from "./db";
import { detectRole, stageOf } from "./jobRole";
import { salaryFromPay } from "./jobSchema";
import { JOB_SOURCES, readAll, type Job } from "./pubJobs";
import type { JobSummary } from "./jobSummary";

/**
 * 조건 비교(2026-11-16): 이 공고의 보수를 지금 접수 중인 다른 공고와 견준다.
 *
 * 보수는 공고 요약(첨부 공고문에서 뽑은 것)의 글이라 표기가 제각각이다. 월 금액으로 확실히 읽히는 것만 쓴다 —
 * 단위가 분명한 금액(lib/jobSchema salaryFromPay), 모집 분야가 하나인 공고(여럿이면 어느 자리 금액인지 모른다),
 * 주 35시간 이상(시간제는 금액이 근무 시간에 비례해 견줄 수 없다). 범위(하한~상한)로 적힌 것은 하한을 쓴다 — 공고문이
 * 대개 "신규 임용은 하한액 원칙"이라고 적는다. 못 읽는 공고는 비교에서 빠지고, 그 공고 쪽에는 이 칸을 그리지 않는다.
 */

/** 주당 근무 시간. "주 35시간" 꼴만 읽는다. 못 읽으면 null(전일제로 본다). */
export function weeklyHours(text: string | null | undefined): number | null {
  const m = (text ?? "").match(/주\s*(?:당\s*)?(\d{2})\s*시간/);
  return m ? Number(m[1]) : null;
}

export type MonthlyPay = { won: number; basis: "월" | "연봉÷12"; floor: boolean };

/** 요약의 보수 글 → 월 금액(원). 확실하지 않으면 null. */
export function monthlyPay(pay: string | null | undefined, hours: string | null | undefined, positions: number): MonthlyPay | null {
  if (positions > 1) return null;
  const h = weeklyHours(hours) ?? weeklyHours(pay);
  if (h !== null && h < 35) return null;
  const s = salaryFromPay(pay);
  if (!s) return null;
  const v = s.value as { unitText?: string; value?: number; minValue?: number; maxValue?: number };
  const amount = v.value ?? v.minValue;
  if (!amount) return null;
  // 하한과 상한이 세 배 넘게 벌어지면 서로 다른 자리의 금액이 섞인 것이다.
  if (v.minValue && v.maxValue && v.maxValue > v.minValue * 3) return null;
  const floor = v.value === undefined;
  if (v.unitText === "MONTH") return { won: amount, basis: "월", floor };
  if (v.unitText === "YEAR") return { won: Math.round(amount / 12), basis: "연봉÷12", floor };
  return null;
}

type Entry = { id: string; won: number; role: string | null; hire: string | null };

async function load(): Promise<Entry[]> {
  if (!dbConfigured) return [];
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  type R = { source_id: string; title: string; org: string | null; hire: string | null };
  const rows = (await readAll<R>((from, to) => db
    .from("job_posts").select("source_id,title,org,hire").in("source", JOB_SOURCES)
    .gte("end_date", today).order("source_id").range(from, to), 4000))
    .filter((r) => { const s = stageOf(r.title); return s !== "final" && s !== "interview"; });
  const meta = new Map(rows.map((r) => [r.source_id, r]));
  const out: Entry[] = [];
  const ids = rows.map((r) => r.source_id);
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await db.from("job_summaries_public").select("source_id,summary").in("source_id", ids.slice(i, i + 300));
    if (error) throw new Error(error.message);
    for (const s of (data ?? []) as { source_id: string; summary: Partial<JobSummary> | null }[]) {
      const r = meta.get(s.source_id);
      const m = monthlyPay(s.summary?.work?.pay, s.summary?.work?.hours, s.summary?.positions?.length ?? 0);
      if (r && m) out.push({ id: s.source_id, won: m.won, role: detectRole(r.title, r.org)?.name ?? null, hire: r.hire });
    }
  }
  return out;
}

/** 접수 중 공고의 월 보수 목록. 여섯 시간마다 다시 센다. 못 읽으면 빈 목록(비교 칸이 빠질 뿐이다). */
const getOpenPays = unstable_cache(async () => {
  try {
    return await load();
  } catch {
    return [] as Entry[];
  }
}, ["open-pays-v1"], { revalidate: 21600 });

export type PayCompare = {
  mine: MonthlyPay;
  /** 견준 묶음 이름("사무·행정 접수 중 공고" 등)과 그 안의 건수(이 공고 포함). */
  group: string;
  n: number;
  /** 높은 쪽부터 센 순위(같은 금액은 같은 순위). */
  rank: number;
  median: number;
  min: number;
  max: number;
  /** 그림에 찍을 금액들(이 공고 제외, 최대 80개). */
  others: number[];
};

const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

/**
 * 이 공고의 보수 비교. 같은 직무(다섯 건 이상) → 같은 고용 형태(여덟 건 이상) → 접수 중 전체(스무 건 이상) 순으로
 * 처음 채워지는 묶음과 견준다. 마감한 공고는 견줄 "지금"이 없어 그리지 않는다.
 */
export async function getPayCompare(job: Job, sum: JobSummary | null | undefined): Promise<PayCompare | null> {
  if (!sum || job.status === "closed") return null;
  const mine = monthlyPay(sum.work.pay, sum.work.hours, sum.positions.length);
  if (!mine) return null;
  const all = (await getOpenPays()).filter((e) => e.id !== job.id);
  const role = detectRole(job.title, job.org)?.name ?? null;
  const tries: [string, Entry[], number][] = [
    [role ? `${role} 공고` : "", role ? all.filter((e) => e.role === role) : [], 4],
    [job.hire ? `${job.hire} 공고` : "", job.hire ? all.filter((e) => e.hire === job.hire) : [], 7],
    ["공고 전체", all, 19],
  ];
  for (const [group, list, min] of tries) {
    if (!group || list.length < min) continue;
    const wons = list.map((e) => e.won);
    const withMe = [...wons, mine.won];
    // 그림에는 고르게 솎아 80개까지만.
    const sorted = [...wons].sort((a, b) => a - b);
    const step = Math.max(1, Math.ceil(sorted.length / 80));
    return {
      mine, group, n: withMe.length,
      rank: wons.filter((w) => w > mine.won).length + 1,
      median: med(withMe), min: Math.min(...withMe), max: Math.max(...withMe),
      others: sorted.filter((_, i) => i % step === 0),
    };
  }
  return null;
}

/** 2,386,300 → "239만 원". 만 원 아래는 반올림. */
export const manwon = (won: number) => `${Math.round(won / 10000).toLocaleString("ko-KR")}만 원`;
