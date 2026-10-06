import { db, dbConfigured } from "./db";
import type { SchedRow, StatsRow } from "./qnetSite";

/**
 * 큐넷에서 읽어 둔 종목별 일정·수험자 동향(exam_sched·exam_stats)을 사람 말로 바꾼다.
 *
 *  - "보통 몇 월에 치르나": 쌓인 해의 시험 날짜(기간이면 가운데 날)를 달로 모은다. 큐넷은 올해 표만 주니
 *    처음에는 한 해치뿐이다 — 그래서 "추정" 이라고 적고, 올해 실제 일정이 남아 있으면 그것을 먼저 보인다.
 *  - 난이도: 최근 3년 응시자·합격자를 더해 단계별 합격률을 내고, 가장 낮은 단계(병목)로 등급을 매긴다.
 *    기사 시험은 필기 60%·실기 20% 꼴이 흔하다. 평균을 내면 40% "보통" 이 되어 실기의 어려움이 묻힌다.
 */

export type ExamSite = { sched: SchedRow[]; stats: StatsRow[] };

export async function getExamSite(code: string): Promise<ExamSite> {
  if (!dbConfigured || !code) return { sched: [], stats: [] };
  try {
    const [a, b] = await Promise.all([
      db.from("exam_sched").select("*").eq("code", code).order("year", { ascending: false }).limit(60),
      db.from("exam_stats").select("*").eq("code", code).order("year", { ascending: false }).limit(20),
    ]);
    if (a.error) throw new Error(a.error.message);
    if (b.error) throw new Error(b.error.message);
    return { sched: (a.data ?? []) as SchedRow[], stats: ((b.data ?? []) as StatsRow[]).map((s) => ({ ...s, pass_rate: s.pass_rate === null ? null : Number(s.pass_rate) })) };
  } catch (e) {
    console.error("[examSite]", e);
    return { sched: [], stats: [] };
  }
}

// ── 시기 ───────────────────────────────────────────────

export type Stage = "필기" | "실기";

/** 전문자격 표의 단계 이름을 둘로 줄인다. 면접·2차·3차는 실기 자리다. */
const stageOf = (s: string | null): Stage => (s === null || /필기|1차/.test(s) ? "필기" : "실기");

/** 기간의 가운데 날이 든 달(1~12). 기사 필기 CBT 는 1/30~3/3 처럼 두 달에 걸쳐 2월로 본다. */
export function midMonth(start: string | null, end: string | null): number | null {
  if (!start) return null;
  const a = Date.parse(start), b = Date.parse(end ?? start);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return new Date((a + b) / 2).getUTCMonth() + 1;
}

export type ExamEvent = {
  year: number; label: string; stage: Stage;
  examStart: string; examEnd: string | null;
  regStart: string | null; regEnd: string | null;
};

/** 일정 줄을 (단계별) 시험 하나하나로 푼다. 기술자격 표는 한 줄에 필기·실기가 함께 있다. */
export function events(rows: SchedRow[]): ExamEvent[] {
  const out: ExamEvent[] = [];
  for (const r of rows) {
    if (r.stage === null) {
      if (r.exam_start) out.push({ year: r.year, label: r.label, stage: "필기", examStart: r.exam_start, examEnd: r.exam_end, regStart: r.reg_start, regEnd: r.reg_end });
      if (r.prac_exam_start) out.push({ year: r.year, label: r.label, stage: "실기", examStart: r.prac_exam_start, examEnd: r.prac_exam_end, regStart: r.prac_reg_start, regEnd: r.prac_reg_end });
    } else if (r.exam_start) {
      out.push({ year: r.year, label: `${r.label} ${r.stage}`, stage: stageOf(r.stage), examStart: r.exam_start, examEnd: r.exam_end, regStart: r.reg_start, regEnd: r.reg_end });
    }
  }
  return out.sort((a, b) => a.examStart.localeCompare(b.examStart));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** 오늘 이후에 시험이 있는 것(올해 실제 일정). 시험이 끝나는 날까지는 보여 준다. */
export function upcomingEvents(rows: SchedRow[], today = new Date()): ExamEvent[] {
  const t = iso(today);
  return events(rows).filter((e) => (e.examEnd ?? e.examStart) >= t);
}

export type MonthEstimate = {
  /** 단계별로 "보통 치르는 달". 쌓인 해의 절반 이상에 나온 달. */
  months: Record<Stage, number[]>;
  /** 바탕이 된 해들(오름차순). */
  years: number[];
  /** 다음에 올 것으로 보는 시험. 올해 실제 일정이 남아 있으면 그쪽을 쓰고 이것은 그 뒤를 가리킨다. */
  next: { stage: Stage; year: number; month: number } | null;
};

export function estimateMonths(rows: SchedRow[], today = new Date()): MonthEstimate | null {
  const ev = events(rows);
  if (!ev.length) return null;
  const years = Array.from(new Set(ev.map((e) => e.year))).sort();
  const months: Record<Stage, number[]> = { 필기: [], 실기: [] };
  for (const st of ["필기", "실기"] as const) {
    const count = new Map<number, Set<number>>();
    for (const e of ev) {
      if (e.stage !== st) continue;
      const m = midMonth(e.examStart, e.examEnd);
      if (!m) continue;
      (count.get(m) ?? count.set(m, new Set()).get(m)!).add(e.year);
    }
    const need = Math.ceil(years.length / 2);
    months[st] = Array.from(count.entries()).filter(([, ys]) => ys.size >= need).map(([m]) => m).sort((a, b) => a - b);
  }
  // 다음 시험: 아직 안 지난 달 가운데 가장 가까운 것. 올해 것이 다 지났으면 내년 첫 달.
  const y = today.getFullYear(), m = today.getMonth() + 1;
  let next: MonthEstimate["next"] = null;
  for (const st of ["필기", "실기"] as const) {
    const later = months[st].find((x) => x > m);
    const cand = later ? { stage: st, year: y, month: later } : months[st].length ? { stage: st, year: y + 1, month: months[st][0] } : null;
    if (cand && (!next || cand.year * 100 + cand.month < next.year * 100 + next.month)) next = cand;
  }
  if (!months.필기.length && !months.실기.length) return null;
  return { months, years, next };
}

// ── 난이도 ─────────────────────────────────────────────

export type Difficulty = {
  level: "쉬운 편" | "보통" | "어려운 편" | "매우 어려움";
  /** 단계별 3년 합산 합격률(%). 집계가 없는 단계는 null. */
  rate: Record<Stage, number | null>;
  /** 등급을 정한 단계. */
  by: Stage;
  /** 한 해 평균 접수자(필기 기준, 없으면 실기). */
  applicantsPerYear: number | null;
  years: number[];
  /** 해·단계별 원자료(화면 표). 최근 해부터. */
  rows: StatsRow[];
};

export function levelOf(rate: number): Difficulty["level"] {
  if (rate >= 55) return "쉬운 편";
  if (rate >= 35) return "보통";
  if (rate >= 20) return "어려운 편";
  return "매우 어려움";
}

export function difficulty(stats: StatsRow[]): Difficulty | null {
  const real = stats.filter((s) => (s.takers ?? 0) > 0 && s.passers !== null);
  if (!real.length) return null;
  const rate: Record<Stage, number | null> = { 필기: null, 실기: null };
  const apps: Record<Stage, number[]> = { 필기: [], 실기: [] };
  for (const st of ["필기", "실기"] as const) {
    const rs = real.filter((s) => s.stage === st);
    const takers = rs.reduce((a, s) => a + (s.takers ?? 0), 0);
    const passers = rs.reduce((a, s) => a + (s.passers ?? 0), 0);
    if (takers) rate[st] = Math.round((passers / takers) * 1000) / 10;
    for (const s of rs) if (s.applicants) apps[st].push(s.applicants);
  }
  const by: Stage = rate.실기 !== null && (rate.필기 === null || rate.실기 < rate.필기) ? "실기" : "필기";
  const r = rate[by];
  if (r === null) return null;
  const a = apps.필기.length ? apps.필기 : apps.실기;
  return {
    level: levelOf(r), rate, by,
    applicantsPerYear: a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null,
    years: Array.from(new Set(real.map((s) => s.year))).sort(),
    rows: [...real].sort((x, y) => y.year - x.year || x.stage.localeCompare(y.stage)),
  };
}

// ── 글자 ───────────────────────────────────────────────

export const monthList = (ms: number[]) => ms.map((m) => `${m}월`).join("·").replace(/월·/g, "·");

/** 850 → "850명", 4321 → "약 4,300명", 102228 → "약 10만 2천 명". 큰 수는 어림해 읽기 쉽게. */
export function peopleText(n: number): string {
  if (n >= 10_000) {
    const man = Math.floor(n / 10_000), rest = Math.round((n % 10_000) / 1000);
    return rest ? `약 ${man}만 ${rest}천 명` : `약 ${man}만 명`;
  }
  if (n >= 1000) return `약 ${(Math.round(n / 100) * 100).toLocaleString("ko-KR")}명`;
  return `${n.toLocaleString("ko-KR")}명`;
}
