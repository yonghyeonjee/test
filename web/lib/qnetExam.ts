import { callOpenApiXml } from "./openapi";

/**
 * 국가기술자격 종목별 시험정보 (한국산업인력공단, InquiryTestInformationNTQSVC).
 *
 * 등급마다 오퍼레이션이 따로 있고, 하나를 부르면 그 등급의 올해 회차가
 * 전부 온다. 인증키 말고 다른 요청 항목이 없다.
 *
 *   getPEList  기술사     getMCList  기능장
 *   getEList   기사·산업기사  getCList   기능사
 *   getJMList  종목별(jmCd 필요)  getFeeList 응시 수수료(jmCd 필요)
 *
 * 항목 이름은 명세서(v1.3, 13·16·19·24·29쪽)를 그대로 옮겼다. 짐작하지
 * 않는다 — 나라일터에서 그러다 전부 틀렸다.
 *
 *   description     회차            "기술사(2014년도 제102회)"
 *   docregstartdt   필기 원서접수 시작
 *   docregenddt     필기 원서접수 종료   ← 우리가 가장 크게 쓰는 날짜
 *   docexamdt       필기시험일
 *   docpassdt       필기 합격(예정)자 발표
 *   docsubmitstartdt/enddt  응시자격 서류제출
 *   pracregstartdt  실기(면접) 원서접수 시작
 *   pracregenddt    실기(면접) 원서접수 종료
 *   pracexamstartdt/enddt   실기(면접) 시험
 *   pracpassdt      합격자 발표
 *
 * 기술사만 실기 자리에 면접이 온다. 이름은 같다.
 */

const BASE = "http://openapi.q-net.or.kr/api/service/rest/InquiryTestInformationNTQSVC";

/** 명세의 요청 예제가 ServiceKey(대문자 S)다. 그대로 따른다. */
const KEY_PARAM = "ServiceKey";

export type ExamGrade = "기술사" | "기능장" | "기사·산업기사" | "기능사";

const OP: Record<ExamGrade, string> = {
  기술사: "getPEList",
  기능장: "getMCList",
  "기사·산업기사": "getEList",
  기능사: "getCList",
};

export const EXAM_GRADES = Object.keys(OP) as ExamGrade[];

export type ExamRound = {
  /** 등급 + 회차. "기사·산업기사|기사,산업기사(2026년도 제1회)" 로 유일해진다. */
  id: string;
  grade: ExamGrade;
  /** 원문 회차 표기 */
  round: string;
  docRegStart: string | null;
  docRegEnd: string | null;
  docExam: string | null;
  docPass: string | null;
  docSubmitStart: string | null;
  docSubmitEnd: string | null;
  pracRegStart: string | null;
  pracRegEnd: string | null;
  pracExamStart: string | null;
  pracExamEnd: string | null;
  pracPass: string | null;
};

/** 20260113 → 2026-01-13. 빈 값·이상한 값은 null. */
export function ymd(v: string | undefined | null): string | null {
  const m = v?.trim().match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function toRound(grade: ExamGrade, r: Record<string, string>): ExamRound | null {
  const round = r.description?.trim();
  if (!round) return null;
  return {
    id: `${grade}|${round}`,
    grade,
    round,
    docRegStart: ymd(r.docregstartdt),
    docRegEnd: ymd(r.docregenddt),
    // 기능사·종목별은 시작/종료가 따로 오고, 나머지는 docexamdt 하나다.
    docExam: ymd(r.docexamdt) ?? ymd(r.docexamstartdt),
    docPass: ymd(r.docpassdt),
    docSubmitStart: ymd(r.docsubmitstartdt),
    docSubmitEnd: ymd(r.docsubmitentdt) ?? ymd(r.docsubmitenddt),
    pracRegStart: ymd(r.pracregstartdt),
    pracRegEnd: ymd(r.pracregenddt),
    pracExamStart: ymd(r.pracexamstartdt),
    pracExamEnd: ymd(r.pracexamenddt),
    pracPass: ymd(r.pracpassdt) ?? ymd(r.pracpassstartdt),
  };
}

/** 한 등급의 올해 회차 전부. */
export async function fetchGrade(grade: ExamGrade): Promise<
  { ok: true; rounds: ExamRound[] } | { ok: false; reason: string }
> {
  const res = await callOpenApiXml(`${BASE}/${OP[grade]}`, {}, 6 * 3600, { keyParam: KEY_PARAM });
  if (!res.ok) return { ok: false, reason: res.reason };
  const rounds = res.rows.map((r) => toRound(grade, r)).filter((x): x is ExamRound => !!x);
  if (!rounds.length) return { ok: false, reason: "회차를 읽지 못했습니다." };
  return { ok: true, rounds };
}

// ── 날짜를 사람 말로 ───────────────────────────────────────

export type Stage = {
  label: string;
  /** 접수 창의 시작·끝. 하루짜리면 둘이 같다. */
  from: string;
  to: string;
};

/** 회차에서 "신청" 창만 뽑는다. 마감일 중심으로 보여 주려는 것이다. */
export function applyWindows(r: ExamRound): Stage[] {
  const out: Stage[] = [];
  if (r.docRegStart && r.docRegEnd) out.push({ label: "필기 원서접수", from: r.docRegStart, to: r.docRegEnd });
  if (r.pracRegStart && r.pracRegEnd) {
    const label = r.grade === "기술사" ? "면접 원서접수" : "실기 원서접수";
    out.push({ label, from: r.pracRegStart, to: r.pracRegEnd });
  }
  return out;
}

/** 이 회차에서 가장 늦은 날. 다 지났는지 가리는 데 쓴다. */
export function roundEnd(r: ExamRound): string | null {
  const all = [
    r.docRegStart, r.docRegEnd, r.docExam, r.docPass,
    r.docSubmitStart, r.docSubmitEnd,
    r.pracRegStart, r.pracRegEnd, r.pracExamStart, r.pracExamEnd, r.pracPass,
  ].filter((v): v is string => Boolean(v));
  return all.length ? all.sort().at(-1)! : null;
}

/**
 * 회차를 앞으로 올 것과 지난 것으로 가른다.
 *
 * 그동안 필기 접수일 오름차순으로 통째로 늘어놓았다. 9월에 들어와도 표
 * 맨 위는 1월 회차였다 — 이미 끝난 것을 먼저 보여 준 셈이다. 사람이
 * 찾는 것은 "다음에 언제 넣나" 다.
 *
 * 날짜가 하나도 없는 회차가 있다("산업별 맞춤형 고교등 필기면제검정").
 * 날짜 표에 끼워 두면 빈칸만 늘어놓게 되니 따로 뺀다.
 */
export function splitRounds(rounds: ExamRound[], today = new Date()) {
  const upcoming: ExamRound[] = [];
  const past: ExamRound[] = [];
  const undated: ExamRound[] = [];

  for (const r of rounds) {
    const end = roundEnd(r);
    if (!end) undated.push(r);
    else if (daysUntil(end, today) >= 0) upcoming.push(r);
    else past.push(r);
  }

  const key = (r: ExamRound) => r.docRegStart ?? r.docExam ?? roundEnd(r) ?? "9999";
  // 앞으로 올 것은 가까운 것부터, 지난 것은 최근 것부터.
  upcoming.sort((a, b) => key(a).localeCompare(key(b)));
  past.sort((a, b) => key(b).localeCompare(key(a)));
  return { upcoming, past, undated };
}

/** 오늘 기준 남은 날. 지났으면 음수. */
export function daysUntil(iso: string, today = new Date()): number {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - t) / 86_400_000);
}

export type WindowState = "before" | "open" | "closed";

export function windowState(w: Stage, today = new Date()): WindowState {
  if (daysUntil(w.from, today) > 0) return "before";
  if (daysUntil(w.to, today) >= 0) return "open";
  return "closed";
}

// ── 저장·읽기 ──────────────────────────────────────────────

import { db, dbConfigured } from "./db";

type Row = {
  id: string; grade: string; round: string;
  doc_reg_start: string | null; doc_reg_end: string | null;
  doc_exam: string | null; doc_pass: string | null;
  doc_submit_start: string | null; doc_submit_end: string | null;
  prac_reg_start: string | null; prac_reg_end: string | null;
  prac_exam_start: string | null; prac_exam_end: string | null;
  prac_pass: string | null;
};

const fromRow = (r: Row): ExamRound => ({
  id: r.id, grade: r.grade as ExamGrade, round: r.round,
  docRegStart: r.doc_reg_start, docRegEnd: r.doc_reg_end,
  docExam: r.doc_exam, docPass: r.doc_pass,
  docSubmitStart: r.doc_submit_start, docSubmitEnd: r.doc_submit_end,
  pracRegStart: r.prac_reg_start, pracRegEnd: r.prac_reg_end,
  pracExamStart: r.prac_exam_start, pracExamEnd: r.prac_exam_end,
  pracPass: r.prac_pass,
});

export const toRow = (r: ExamRound) => ({
  id: r.id, grade: r.grade, round: r.round,
  doc_reg_start: r.docRegStart, doc_reg_end: r.docRegEnd,
  doc_exam: r.docExam, doc_pass: r.docPass,
  doc_submit_start: r.docSubmitStart, doc_submit_end: r.docSubmitEnd,
  prac_reg_start: r.pracRegStart, prac_reg_end: r.pracRegEnd,
  prac_exam_start: r.pracExamStart, prac_exam_end: r.pracExamEnd,
  prac_pass: r.pracPass,
  fetched_at: new Date().toISOString(),
});

/** 화면이 쓰는 것. DB 만 본다 — API 를 요청마다 부르지 않는다. */
export async function getExamRounds(): Promise<ExamRound[]> {
  if (!dbConfigured) return [];
  try {
    const { data, error } = await db.from("exam_rounds").select("*").limit(300);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Row[]).map(fromRow);
  } catch (e) {
    console.error("[examRounds]", e);
    return [];
  }
}

export type Upcoming = {
  round: ExamRound;
  stage: Stage;
  state: WindowState;
  /** 마감까지 남은 날. 접수 전이면 시작까지 남은 날. */
  days: number;
};

/**
 * 신청 창을 마감이 가까운 순으로 세운다. 화면이 이걸 맨 위에 놓는다.
 *
 * 이미 끝난 창은 뺀다 — 지난 마감일을 위에 놓으면 볼 이유가 없다.
 */
export function upcoming(rounds: ExamRound[], today = new Date()): Upcoming[] {
  const out: Upcoming[] = [];
  for (const r of rounds)
    for (const stage of applyWindows(r)) {
      const state = windowState(stage, today);
      if (state === "closed") continue;
      out.push({ round: r, stage, state, days: daysUntil(state === "before" ? stage.from : stage.to, today) });
    }
  // 접수 중이 먼저, 그중 마감이 가까운 것부터. 그다음 곧 열리는 것.
  return out.sort((a, b) => {
    if (a.state !== b.state) return a.state === "open" ? -1 : 1;
    return a.days - b.days;
  });
}

/**
 * 종목의 등급(series)과 시험일정의 등급(grade)을 잇는다.
 *
 * 두 API 가 등급을 다르게 부른다. 종목 목록은 "기사" 와 "산업기사" 를
 * 따로 세는데, 일정 API 는 둘을 한 회차로 묶어 "기사·산업기사" 로 준다.
 * 실제로 같은 날 같이 치르니 묶는 것이 맞다.
 *
 * 국가전문자격(공인중개사·세무사 …)은 이 일정 API 가 다루지 않는다.
 * null 을 주고, 화면은 "시행기관 일정을 따로 확인하세요" 라고 말한다 —
 * 없는 일정을 아무 회차에나 갖다 붙이면 시험 날짜를 잘못 알려 주게 된다.
 */
export function gradeOfSeries(series: string | null | undefined): ExamGrade | null {
  const s = (series ?? "").trim();
  if (s === "기술사") return "기술사";
  if (s === "기능장") return "기능장";
  if (s === "기능사") return "기능사";
  if (s === "기사" || s === "산업기사") return "기사·산업기사";
  return null;
}

/** 한 등급의 다가오는 신청 창. 종목 상세가 쓴다. */
export function upcomingForSeries(
  rounds: ExamRound[],
  series: string | null | undefined,
  today = new Date(),
): Upcoming[] {
  const grade = gradeOfSeries(series);
  if (!grade) return [];
  return upcoming(rounds.filter((r) => r.grade === grade), today);
}
