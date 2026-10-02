import type { Job } from "./pubJobs";
import { expandTerms } from "./thesaurus";

/**
 * 채용 목록 거르기. react 를 끌어오지 않는 순수 함수만 — 테스트가 node 에서
 * 바로 부른다. 화면은 pubJobs 를 통해 쓴다.
 */

/** "서울,경기" / "서울 경기" / "전국" 처럼 오는 근무지를 시·도 조각으로. */
export function regionTokens(region: string | null) {
  if (!region) return [];
  return region
    .split(/[,/·\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

export type JobFilter = { q?: string; region?: string; hire?: string; open?: boolean };

const hayOf = (j: Job) => `${j.title} ${j.org ?? ""} ${j.sectors ?? ""}`.toLowerCase();

/**
 * 검색어를 낱말로 나누고, 낱말마다 연관어까지 넓힌다. 낱말끼리는 AND,
 * 묶음 안은 OR — "서울 경비" 는 서울이 있고 경비·경호·보안·방호 가운데
 * 하나가 있는 공고. 통합 검색(lib/search.ts)과 같은 사전을 쓴다.
 */
function termGroups(q?: string): string[][] {
  return (q ?? "").trim().toLowerCase().split(/\s+/).filter((w) => w.length >= 1)
    .map((w) => Array.from(new Set(expandTerms(w).map((t) => t.toLowerCase()))));
}

export function filterJobs(jobs: Job[], f: JobFilter) {
  const groups = termGroups(f.q);
  return jobs.filter((j) => {
    if (f.open && (j.status === "closed")) return false;
    if (f.region && !regionTokens(j.region).some((t) => t.startsWith(f.region!) || f.region!.startsWith(t)))
      return false;
    if (f.hire && j.hire !== f.hire) return false;
    if (groups.length) {
      const hay = hayOf(j);
      if (!groups.every((g) => g.some((t) => hay.includes(t)))) return false;
    }
    return true;
  });
}

/**
 * 걸러진 목록에서 실제로 쓰인 연관어. "경비" 로 찾았는데 경호·보안 공고가
 * 섞여 있으면 그 말을 돌려준다 — 화면이 "경호·보안도 함께 찾았습니다" 라고
 * 적을 수 있게. 쓰이지 않은 연관어는 말하지 않는다.
 */
export function jobTermsUsed(list: Job[], q?: string): string[] {
  const words = (q ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    for (const t of expandTerms(w).slice(1)) {
      const lt = t.toLowerCase();
      if (out.includes(t)) continue;
      if (list.some((j) => { const h = hayOf(j); return h.includes(lt) && !h.includes(w); })) out.push(t);
    }
  }
  return out.slice(0, 6);
}

