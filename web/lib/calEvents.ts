import type { AlioItem } from "./alioplus";
import type { CalEvent } from "./ical";
import type { ExamRound } from "./qnetExam";
import { SITE_URL } from "./seo";

/**
 * 화면의 일정을 캘린더 일정으로. 어디서나 같은 모양이 되게 한곳에 둔다.
 *
 * 마감일에 종일 일정 하나를 두는 것이 원칙이다. 접수 기간 전체를 띠로 깔면
 * 몇 주짜리 띠가 캘린더를 덮는다. 접수 시작이 아직 오지 않았으면 그날도 하나 더.
 */
const today = () => new Date().toISOString().slice(0, 10);
const dot = (s: string) => s.replaceAll("-", ".");
const cut = (s: string | null | undefined, n = 240) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

type ProgramLike = {
  source_id: string; title: string; org_name: string | null; dept_name?: string | null;
  apply_start: string | null; apply_end: string | null; is_always_on: boolean | null;
  apply_method?: string | null; contact?: string | null; sido?: string | null; sigungu?: string | null;
};

export function programEvents(p: ProgramLike): CalEvent[] {
  if (p.is_always_on || !p.apply_end) return [];
  const url = `${SITE_URL}/p/${encodeURIComponent(p.source_id)}`;
  const org = [p.org_name, p.dept_name].filter(Boolean).join(" ");
  const period = `접수 ${p.apply_start ? dot(p.apply_start) : ""} ~ ${dot(p.apply_end)}`;
  const details = [org, period, cut(p.apply_method), p.contact ? `문의 ${p.contact}` : ""].filter(Boolean).join("\n");
  const location = [p.sido, p.sigungu].filter(Boolean).join(" ") || undefined;
  const out: CalEvent[] = [{ title: `[마감] ${p.title}`, start: p.apply_end, details, location, url }];
  if (p.apply_start && p.apply_start > today())
    out.unshift({ title: `[접수 시작] ${p.title}`, start: p.apply_start, details, location, url });
  return out;
}

type JobLike = { id: string; title: string; org: string | null; region: string | null; start: string | null; end: string | null; hire?: string | null };

export function jobEvents(j: JobLike): CalEvent[] {
  if (!j.end && !j.start) return [];
  const url = `${SITE_URL}/jobs/${encodeURIComponent(j.id)}`;
  const details = [j.org, j.hire, j.start || j.end ? `접수 ${j.start ? dot(j.start) : ""} ~ ${j.end ? dot(j.end) : ""}` : ""].filter(Boolean).join("\n");
  const location = j.region ?? undefined;
  const out: CalEvent[] = [];
  if (j.end) out.push({ title: `[마감] ${j.title}`, start: j.end, details, location, url });
  if (j.start && j.start > today()) out.unshift({ title: `[접수 시작] ${j.title}`, start: j.start, details, location, url });
  if (!j.end && j.start) out.push({ title: `[접수] ${j.title}`, start: j.start, details, location, url });
  return out;
}

/** 큐넷 회차 하나의 날짜 전부. 없는 날짜는 건너뛴다. */
export function roundEvents(r: ExamRound, grade: string = r.grade): CalEvent[] {
  const url = `${SITE_URL}/license/schedule`;
  const tag = `[${grade}] ${r.round}`;
  const ev = (title: string, start: string | null, end?: string | null): CalEvent | null =>
    start ? { title: `${tag} ${title}`, start, end: end ?? null, details: "큐넷 원서접수는 정해진 기간에만 열립니다.", url } : null;
  return [
    ev("필기 원서접수", r.docRegStart, r.docRegEnd),
    ev("필기시험", r.docExam),
    ev("필기 합격 발표", r.docPass),
    ev("응시자격 서류 제출", r.docSubmitStart, r.docSubmitEnd),
    ev("실기 원서접수", r.pracRegStart, r.pracRegEnd),
    ev("실기시험", r.pracExamStart, r.pracExamEnd),
    ev("최종 합격 발표", r.pracPass),
  ].filter((x): x is CalEvent => x !== null);
}

/** 시험 일정 전체(앞으로 남은 회차)를 한 파일로. 지난 날짜는 뺀다. */
export function upcomingRoundEvents(rounds: ExamRound[]): CalEvent[] {
  const t = today();
  return rounds.flatMap((r) => roundEvents(r)).filter((e) => (e.end ?? e.start) >= t)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function agencyEvents(it: AlioItem): CalEvent[] {
  const start = it.start ?? it.end;
  if (!start) return [];
  return [{
    title: `[행사] ${it.title}`, start, end: it.end,
    details: [it.org, it.cate, it.target ? `대상 ${it.target}` : ""].filter(Boolean).join("\n"),
    location: it.address ?? undefined, url: it.url ?? undefined,
  }];
}
