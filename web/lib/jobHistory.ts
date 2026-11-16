import { cache } from "react";
import { db, dbConfigured } from "./db";
import { stageOf } from "./jobRole";
import { readAll, type Job } from "./pubJobs";

/**
 * 공고 하나에만 해당하는 이 사이트의 자료(2026-11-16).
 *
 * 구글이 10월 중순 사이트 전체를 색인에서 뺀 뒤 반복 문구를 걷었는데, 걷기만 해서는 원문 사이트(나라일터)와 달라지지
 * 않는다. 기관 숫자(lib/jobFacts)는 같은 기관의 모든 공고에 같다. 여기서는 공고마다 다른 것을 센다 — 모아 둔 지난 공고에서
 *
 *   1. 이 자리의 모집 이력: 같은 기관이 같은 자리를 전에 언제, 며칠 동안 뽑았는지.
 *   2. 전형 일정 실적: 그 지난 모집에서 접수 마감 뒤 서류·면접 안내와 최종 발표 공고가 며칠 만에 올라왔는지.
 *
 * "같은 자리"는 제목에서 연도·회차·기관 이름·절차 낱말(채용·공고·합격자 발표 …)을 뗀 나머지가 글자 그대로 같은 것이다
 * (posKey). 기관이 제목을 다르게 쓰면 못 묶는다 — 틀리게 묶느니 안 묶는다. 지어내는 글은 없고, 자료가 없으면 그리지 않는다.
 */

export type OrgPost = { id: string; title: string; reg: string | null; start: string | null; end: string | null };

const DAY = 86400_000;
/** 지난 공고를 돌아보는 기간(일). 3년. */
const LOOKBACK_DAYS = 1100;
/** 합격자 발표 공고를 모집 공고에 잇는 한도(일). 이보다 뒤에 올라온 것은 다른 모집으로 본다. */
const STAGE_WINDOW_DAYS = 150;

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/** 제목에서 떼는 절차 낱말. 자리 이름(직원·근로자·연구원 …)은 건드리지 않는다. */
const PROC = new RegExp(
  [
    "채용\\s*후보자", "최종\\s*합격자?", "서류\\s*(전형|심사)?", "면접\\s*(시험|전형|심사)?", "필기\\s*(시험|전형)?", "인성\\s*검사",
    "합격자", "발표", "결과", "일정", "안내", "계획", "등록", "제출\\s*서류", "재\\s*공고", "연장", "변경", "정정", "수정", "추가",
    "공개\\s*모집", "공개\\s*경쟁", "경력\\s*경쟁", "채용", "시험", "모집", "공고문?", "및",
  ].join("|"),
  "g",
);

/** 같은 자리를 가리는 열쇠. 너무 짧으면(세 글자 미만) 빈 문자열 — "직원 채용 공고" 같은 제목은 묶지 않는다. */
export function posKey(title: string, org: string | null): string {
  let t = title.replace(/^\s*(\[[^\]]*\]\s*)+/, "");
  t = t.replace(/[’'`]?\d{2,4}\s*년도?/g, "").replace(/제?\s*\d+\s*(회|차|기)/g, "");
  for (const w of (org ?? "").split(/\s+/)) if (w.length >= 2) t = t.split(w).join("");
  t = t.replace(PROC, "").replace(/[\s·,.\-_/~:;!?"'“”‘’\[\]【】<>〈〉]/g, "").replace(/[（(][)）]/g, "");
  return t.length >= 3 ? t : "";
}

/** 한 기관의 최근 3년 공고(모집·발표 모두). 공고 쪽 하나에 한 번 읽는다. */
export const getOrgPosts = cache(async (org: string): Promise<OrgPost[]> => {
  if (!dbConfigured) return [];
  const since = new Date(Date.now() - LOOKBACK_DAYS * DAY).toISOString().slice(0, 10);
  type R = { source_id: string; title: string; reg_date: string | null; start_date: string | null; end_date: string | null };
  try {
    const rows = await readAll<R>((from, to) => db
      .from("job_posts").select("source_id,title,reg_date,start_date,end_date")
      .eq("org", org).gte("reg_date", since)
      .order("reg_date", { ascending: false }).order("source_id")
      .range(from, to), 3000);
    return rows.map((r) => ({ id: r.source_id, title: r.title, reg: r.reg_date, start: r.start_date, end: r.end_date }));
  } catch {
    return [];
  }
});

export type PastRound = {
  id: string;
  title: string;
  reg: string;
  end: string | null;
  /** 접수 기간(일). 시작일이 없으면 등록일부터 센다. */
  periodDays: number | null;
  /** 재공고·연장·변경 공고인지(제목에 적힌 대로). */
  again: "재공고" | "연장" | "변경" | null;
  /** 마감 뒤 서류·면접 안내 공고까지(일)와 그 공고. */
  interview: { id: string; reg: string; after: number } | null;
  /** 마감 뒤 최종 합격자 발표 공고까지(일)와 그 공고. */
  final: { id: string; reg: string; after: number } | null;
};

export type JobHistory = {
  /** 이 공고보다 먼저 올라온 같은 자리 모집 공고. 새것부터. */
  past: PastRound[];
  /** 지난 3년 같은 자리 공고가 올라온 달(YYYY-MM)과 건수. 이 공고 포함. 그림에 쓴다. */
  months: { ym: string; n: number; self: boolean }[];
  /** 같은 자리 공고 사이 간격의 중앙값(일). 공고가 셋 이상일 때. */
  gapDays: number | null;
  /** 이 공고 자체의 진행(마감한 공고에 발표 공고가 이미 올라온 경우). */
  self: Pick<PastRound, "interview" | "final">;
  /** 전형 일정 실적. scope 는 같은 자리(same) 또는 기관 전체(org). */
  pace: { scope: "same" | "org"; rounds: number; interview: number | null; final: number | null } | null;
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

const againOf = (title: string): PastRound["again"] =>
  /재\s*공고/.test(title) ? "재공고" : /연장/.test(title) ? "연장" : /변경|정정/.test(title) ? "변경" : null;

/**
 * 한 기관의 공고를 모집 회차로 엮는다. 발표 공고(서류·면접 안내, 최종 합격자)는 열쇠가 같은 가장 가까운 앞선 모집 공고에
 * 붙인다 — 그 모집 공고가 올라온 날부터 STAGE_WINDOW_DAYS 일 안의 것만.
 */
function buildRounds(posts: OrgPost[], org: string | null) {
  const recruits: (PastRound & { key: string })[] = [];
  const stages: { key: string; id: string; reg: string; kind: "interview" | "final" }[] = [];
  for (const p of posts) {
    if (!p.reg) continue;
    const key = posKey(p.title, org);
    if (!key) continue;
    const st = stageOf(p.title);
    if (st === "interview" || st === "final") stages.push({ key, id: p.id, reg: p.reg, kind: st });
    else {
      const from = p.start ?? p.reg;
      recruits.push({
        key, id: p.id, title: p.title, reg: p.reg, end: p.end,
        periodDays: p.end && p.end >= from ? days(from, p.end) + 1 : null,
        again: againOf(p.title), interview: null, final: null,
      });
    }
  }
  recruits.sort((a, b) => (a.reg < b.reg ? -1 : a.reg > b.reg ? 1 : a.id.localeCompare(b.id)));
  stages.sort((a, b) => (a.reg < b.reg ? -1 : 1));
  for (const s of stages) {
    // 열쇠가 같은 모집 공고 가운데 이 발표보다 앞선 가장 늦은 것.
    let owner: (typeof recruits)[number] | null = null;
    for (const r of recruits) if (r.key === s.key && r.reg <= s.reg) owner = r;
    if (!owner || days(owner.reg, s.reg) > STAGE_WINDOW_DAYS) continue;
    // 마감일이 있어야 "마감 뒤 며칠"을 센다. 마감 전에 올라온 발표(다른 차수의 것일 수 있다)는 버린다.
    if (!owner.end) continue;
    const after = days(owner.end, s.reg);
    if (after < 0) continue;
    if (!owner[s.kind]) owner[s.kind] = { id: s.id, reg: s.reg, after };
  }
  return recruits;
}

/** 이 공고의 모집 이력과 전형 일정 실적. 묶을 열쇠가 없거나 자료가 하나도 없으면 null. */
export const getJobHistory = cache(async (job: Job): Promise<JobHistory | null> => {
  if (!job.org || !job.reg) return null;
  const st = stageOf(job.title);
  if (st === "interview" || st === "final") return null;
  const posts = await getOrgPosts(job.org);
  if (!posts.length) return null;
  const rounds = buildRounds(posts, job.org);
  const key = posKey(job.title, job.org);
  const same = key ? rounds.filter((r) => r.key === key) : [];
  const me = same.find((r) => r.id === job.id) ?? null;
  const past = same.filter((r) => r.id !== job.id && r.reg <= job.reg!).reverse();

  const byMonth = new Map<string, { n: number; self: boolean }>();
  for (const r of same) {
    const ym = r.reg.slice(0, 7);
    const m = byMonth.get(ym) ?? { n: 0, self: false };
    m.n += 1;
    if (r.id === job.id) m.self = true;
    byMonth.set(ym, m);
  }
  const months = Array.from(byMonth.entries()).map(([ym, v]) => ({ ym, ...v })).sort((a, b) => (a.ym < b.ym ? -1 : 1));

  const gaps: number[] = [];
  for (let i = 1; i < same.length; i++) gaps.push(days(same[i - 1].reg, same[i].reg));
  const gapDays = same.length >= 3 ? median(gaps.filter((g) => g > 0)) : null;

  // 전형 일정 실적: 같은 자리의 지난 모집에 자료가 있으면 그것으로, 없으면 기관 전체(자료 있는 모집 셋 이상)로.
  const paceOf = (rs: PastRound[], scope: "same" | "org", min: number): JobHistory["pace"] => {
    const withData = rs.filter((r) => r.interview || r.final);
    if (withData.length < min) return null;
    return {
      scope, rounds: withData.length,
      interview: median(withData.flatMap((r) => (r.interview ? [r.interview.after] : []))),
      final: median(withData.flatMap((r) => (r.final ? [r.final.after] : []))),
    };
  };
  const pace = paceOf(past, "same", 1) ?? paceOf(rounds.filter((r) => r.id !== job.id), "org", 3);

  const self = { interview: me?.interview ?? null, final: me?.final ?? null };
  if (!past.length && !pace && !self.interview && !self.final) return null;
  return { past, months, gapDays, self, pace };
});

/** 설명문에 넣을 한 줄. 이력이 없으면 빈 문자열. */
export function historyLine(h: JobHistory | null): string {
  if (!h) return "";
  const bits: string[] = [];
  if (h.past.length) bits.push(`같은 자리 모집이 지난 3년 동안 ${h.past.length}번 더 있었습니다`);
  if (h.pace?.final != null) bits.push(`지난 모집에서는 마감 ${h.pace.final}일 뒤 최종 합격자 공고가 올라왔습니다`);
  return bits.length ? `${bits.join(". ")}.` : "";
}
