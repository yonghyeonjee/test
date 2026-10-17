import { unstable_cache } from "next/cache";
import { roundEvents } from "./calEvents";
import { db, dbConfigured } from "./db";
import { SIDO_SHORT } from "./geo";
import { getExamRounds } from "./qnetExam";

/**
 * 마감 달력(/calendar)의 자료. 지원사업 마감(programs_public.apply_end), 채용 마감(job_posts.end_date),
 * 자격시험 일정(exam_rounds)을 날짜별로 센다. 세는 함수는 sql/013_deadline_calendar.sql.
 *
 * 지역을 고르면 그 시·도(와 시·군·구) 것과 전국 것만 남는다. 채용 공고의 지역은 자유 글("경기도 수원시")이라
 * 짧은 이름("경기")이 들어 있는지로 거른다. 시험 일정은 전국 공통이라 지역과 상관없다.
 */
export type DayCount = { p: number; job: number; exam: number };
export type DayItem = { kind: "p" | "job"; id: string; title: string; org: string | null; place: string; start: string | null };
export type ExamItem = { title: string; start: string; end: string | null; url?: string };

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export function todayKst(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
/** 달의 첫날·마지막 날. */
export function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

const short = (sido?: string | null) => (sido ? SIDO_SHORT[sido] ?? sido.slice(0, 2) : null);

export async function deadlineDays(from: string, to: string, sido?: string | null, sigungu?: string | null): Promise<Record<string, DayCount>> {
  const out: Record<string, DayCount> = {};
  if (!dbConfigured) return out;
  try {
    const { data, error } = await db.rpc("deadline_days", {
      p_from: from, p_to: to, p_sido: sido ?? null, p_sido_short: short(sido), p_sigungu: sigungu ?? null,
    });
    if (error) throw error;
    for (const r of (data ?? []) as { d: string; kind: "p" | "job"; n: number }[]) {
      out[r.d] ??= { p: 0, job: 0, exam: 0 };
      out[r.d][r.kind] += r.n;
    }
  } catch (e) {
    console.warn("[calendar] days", e instanceof Error ? e.message : e);
  }
  return out;
}

export async function deadlineItems(day: string, sido?: string | null, sigungu?: string | null): Promise<DayItem[]> {
  if (!dbConfigured) return [];
  try {
    const { data, error } = await db.rpc("deadline_items", {
      p_day: day, p_sido: sido ?? null, p_sido_short: short(sido), p_sigungu: sigungu ?? null, p_limit: 150,
    });
    if (error) throw error;
    type Row = { kind: "p" | "job"; id: string; title: string; org: string | null; place: string; start_date: string | null };
    // 채용은 공고 번호(source_id)로 잇는다. sql/013 판은 job_posts.id("gojobs:305694")를 돌려줘 달력의 채용
    // 링크가 전부 "내려간 공고"로 갔다(2026-10-17, sql/014 로 고침). DB 함수가 어느 판이든 맞게 나오도록
    // 앞머리를 떼고, 상세 쪽이 없는 해외채용(worldjob) 줄은 뺀다.
    return ((data ?? []) as Row[]).flatMap((r): DayItem[] => {
      if (r.kind !== "job") return [{ kind: r.kind, id: r.id, title: r.title, org: r.org, place: r.place, start: r.start_date }];
      const m = /^(gojobs|alio|worldjob):(.+)$/.exec(r.id);
      if (m?.[1] === "worldjob") return [];
      return [{ kind: r.kind, id: m ? m[2] : r.id, title: r.title, org: r.org, place: r.place, start: r.start_date }];
    });
  } catch (e) {
    console.warn("[calendar] items", e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * 자격시험 일정을 날짜별로. 원서접수처럼 기간이 있는 것은 "마감"으로 끝나는 날에,
 * 시험·발표처럼 하루짜리는 그날에 둔다. 하루 한 번만 다시 센다.
 */
const examByDay = unstable_cache(async (): Promise<Record<string, ExamItem[]>> => {
  const out: Record<string, ExamItem[]> = {};
  for (const r of await getExamRounds()) {
    for (const e of roundEvents(r)) {
      const windowed = Boolean(e.end && e.end !== e.start);
      const day = windowed ? (e.end as string) : e.start;
      (out[day] ??= []).push({ title: windowed ? `${e.title} 마감` : e.title, start: e.start, end: e.end ?? null, url: e.url });
    }
  }
  return out;
}, ["exam-by-day-v1"], { revalidate: 86400 });

export async function examDays(from: string, to: string): Promise<Record<string, ExamItem[]>> {
  const all = await examByDay().catch(() => ({} as Record<string, ExamItem[]>));
  const out: Record<string, ExamItem[]> = {};
  for (const [d, list] of Object.entries(all)) if (d >= from && d <= to) out[d] = list;
  return out;
}
