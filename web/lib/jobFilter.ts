import type { Job } from "./pubJobs";
import { SIDO_SHORT, normSido } from "./geo";
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
    .map((w) => Array.from(new Set([...expandTerms(w), ...placeStems(w)].map((t) => t.toLowerCase()))));
}

/**
 * "남동구" 로 찾으면 "남동" 도 함께 본다. 공고는 "인천남동우체국" 처럼 시·군·구를
 * 떼고 적는 일이 많다 — 정책지도가 이 공고를 남동구에 놓는 것도 그 줄기로 찾아서다.
 * 지도에서 "이 지역 1건 모두 보기" 를 눌렀는데 0건이 나오던 것이 이것이다(2026-10-07).
 * 두 글자 줄기만("구리시" → "구리"). 한 글자("중구" → "중")는 아무 데나 걸린다.
 */
function placeStems(w: string): string[] {
  const m = /^(.{2,})(시|군|구)$/.exec(w);
  return m ? [m[1]] : [];
}

/**
 * 지역 조건. 공고의 절반은 region 칸이 비어 있다(중앙부처·우체국·학교). 그런 공고는
 * 기관명·제목에 시·도 이름("인천", "인천광역시")이 있으면 그 지역으로 본다.
 * 통합 검색(lib/search.ts)과 정책지도(lib/geo locateJob)가 이미 그렇게 하므로 목록만 다르면
 * 지도에서 넘어온 공고가 목록에서 사라진다.
 */
function regionMatches(j: Job, region: string): boolean {
  const toks = regionTokens(j.region);
  if (toks.length) return toks.some((t) => t.startsWith(region) || region.startsWith(t));
  const sido = normSido(region) ?? region;
  const names = [sido, ...(SIDO_SHORT[sido] ?? "").split("·")].filter((t) => t.length >= 2);
  const text = `${j.title} ${j.org ?? ""}`;
  return names.some((n) => text.includes(n));
}

export function filterJobs(jobs: Job[], f: JobFilter) {
  const groups = termGroups(f.q);
  return jobs.filter((j) => {
    if (f.open && (j.status === "closed")) return false;
    if (f.region && !regionMatches(j, f.region)) return false;
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

