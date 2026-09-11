import { callOpenApiXml } from "./openapi";
import { applyStatus, type ApplyStatus } from "./db";

/**
 * 해외취업 우수일자리 (한국산업인력공단 월드잡플러스, worldjob30).
 *
 * 공단이 우수일자리로 고른 해외 채용 공고다. 국가·직종·공고명으로 검색을
 * 받으므로 국가는 서버에 맡기고, 나머지는 몇 쪽을 받아 화면에서 거른다.
 * SSL 을 지원하지 않아 http 다 — 서버에서만 부른다. 항목 태그가 대문자
 * ITEM 이고 결과 코드가 ERR_CD 인 점이 다른 포털 서비스와 다르다.
 */

const URL = "http://apis.data.go.kr/B490007/worldjob30/openApi30";
const ROWS = 100;
const PAGES = 5;

export type OverseasJob = {
  id: string;
  title: string;
  company: string | null;
  nation: string | null;
  job: string | null;
  industry: string | null;
  career: string | null;
  lang: string | null;
  visa: string | null;
  headcount: string | null;
  start: string | null;
  end: string | null;
  agency: string | null;
  status: ApplyStatus;
};

const s = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
const iso = (v: string | null) => {
  const m = v?.match(/(\d{4})[.\-/]?(\d{2})[.\-/]?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

function toJob(r: Record<string, string>): OverseasJob | null {
  const title = s(r.rctntcSj);
  if (!title) return null;
  const start = iso(s(r.rctntcBgnDe));
  const end = iso(s(r.rctntcEndDe));
  return {
    id: `${title}|${s(r.entNm) ?? ""}|${start ?? ""}`,
    title,
    company: s(r.entNm),
    nation: s(r.rctntcNationNm),
    job: s(r.rctntcKscoNm),
    industry: s(r.lplcKscoNm),
    career: s(r.careerStleNm),
    lang: s(r.rctntcLang),
    visa: s(r.rctntcVisaNm),
    headcount: s(r.rctntcNmprCo),
    start,
    end,
    agency: s(r.rctntcOriginNm),
    status: applyStatus({ apply_start: start, apply_end: end, is_always_on: false }),
  };
}

export type OverseasBoard = { ok: boolean; reason: string | null; jobs: OverseasJob[]; total: number };

export async function getOverseasJobs(nation?: string, q?: string): Promise<OverseasBoard> {
  const params: Record<string, string | number> = { numOfRows: ROWS, pageNo: 1 };
  if (nation) params.searchNationNm = nation;
  if (q) params.searchRctntcSj = q;
  const first = await callOpenApiXml(URL, params, 21600, { itemTag: "ITEM" });
  if (!first.ok) return { ok: false, reason: first.reason, jobs: [], total: 0 };

  const rows = [...first.rows];
  const pages = Math.min(PAGES, Math.ceil(first.total / ROWS));
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
      callOpenApiXml(URL, { ...params, pageNo: i + 2 }, 21600, { itemTag: "ITEM" }),
    ),
  );
  for (const r of rest) if (r.ok) rows.push(...r.rows);

  const seen = new Set<string>();
  const jobs: OverseasJob[] = [];
  for (const r of rows) {
    const j = toJob(r);
    if (!j || seen.has(j.id)) continue;
    seen.add(j.id);
    jobs.push(j);
  }
  const rank: Record<ApplyStatus, number> = { ongoing: 0, always: 0, upcoming: 1, closed: 2 };
  jobs.sort((a, b) => rank[a.status] - rank[b.status] || (a.end ?? "9999").localeCompare(b.end ?? "9999"));
  return { ok: jobs.length > 0, reason: jobs.length ? null : "조회 결과가 비어 있습니다.", jobs, total: first.total };
}

export function nationFacet(jobs: OverseasJob[]) {
  const m = new Map<string, number>();
  for (const j of jobs) if (j.nation) m.set(j.nation, (m.get(j.nation) ?? 0) + 1);
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ v, n }));
}
