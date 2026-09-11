import { callOpenApiXml } from "./openapi";
import { applyStatus, type ApplyStatus } from "./db";

/**
 * 공공기관 채용정보 (인사혁신처 나라일터, PblJobService).
 *
 * 목록 조회(getList)는 페이지 넘김만 받고 조건 검색은 없다. 그래서 몇 쪽을
 * 한꺼번에 받아 둔 뒤 화면에서 지역·고용형태·검색어로 거른다. 공고는
 * 하루에 수십 건씩 바뀌므로 여섯 시간마다 다시 받는다.
 *
 * 응답 항목 이름은 명세 문서 없이 포털 안내만 보고 적은 것이라, 항목마다
 * 후보 이름을 여럿 두고 처음 걸리는 것을 쓴다. 하나도 안 걸리면 첫 건의
 * 항목 이름을 로그로 남겨 두어 Vercel 로그에서 바로잡을 수 있게 한다.
 */

const URL = "https://apis.data.go.kr/1760000/PblJobService/getList";
const ROWS = 100;
const PAGES = 5;

export type Job = {
  id: string;
  title: string;
  org: string | null;
  region: string | null;
  hire: string | null;
  recruit: string | null;
  sectors: string | null;
  headcount: string | null;
  /** ISO 날짜 (YYYY-MM-DD) */
  start: string | null;
  end: string | null;
  reg: string | null;
  url: string | null;
  status: ApplyStatus;
};

export type JobBoard = {
  ok: boolean;
  reason: string | null;
  jobs: Job[];
  total: number;
};

const ALIAS: Record<keyof Omit<Job, "status">, string[]> = {
  id: ["idx", "pbancNo", "id", "seq"],
  title: ["title", "pbancNm", "subject", "recrutPbancTtl"],
  org: ["orgName", "instNm", "ognNm", "orgNm", "instName"],
  region: ["workRegion", "workRegionNm", "region", "workRgnNm"],
  hire: ["hireType", "hireTypeNm", "emplymType", "hireTypeLst"],
  recruit: ["recruitType", "recruitTypeNm", "careerType", "recrutSe"],
  sectors: ["sectors", "ncsCdNmLst", "field", "sector"],
  headcount: ["recruitNum", "rcritNmpr", "recrutNope"],
  start: ["startDate", "pbancBgngDt", "receiptStart", "pbancBgngYmd"],
  end: ["endDate", "pbancEndDt", "receiptEnd", "pbancEndYmd"],
  reg: ["regDate", "regDt", "registDt"],
  url: ["srcUrl", "url", "detailUrl", "link", "homepage"],
};

const pick = (r: Record<string, string>, keys: string[]) => {
  for (const k of keys) {
    const v = r[k]?.trim();
    if (v) return v;
  }
  return null;
};

/** 20260912 / 2026-09-12 / 2026.09.12 / 2026-09-12 18:00 → 2026-09-12 */
export function isoDate(v: string | null) {
  if (!v) return null;
  const m = v.match(/(\d{4})[.\-/]?(\d{2})[.\-/]?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export const dot = (iso: string | null) => (iso ? iso.replaceAll("-", ".") : null);

function toJob(r: Record<string, string>): Job | null {
  const title = pick(r, ALIAS.title);
  if (!title) return null;
  const start = isoDate(pick(r, ALIAS.start));
  const end = isoDate(pick(r, ALIAS.end));
  return {
    id: pick(r, ALIAS.id) ?? title,
    title,
    org: pick(r, ALIAS.org),
    region: pick(r, ALIAS.region),
    hire: pick(r, ALIAS.hire),
    recruit: pick(r, ALIAS.recruit),
    sectors: pick(r, ALIAS.sectors),
    headcount: pick(r, ALIAS.headcount),
    start,
    end,
    reg: isoDate(pick(r, ALIAS.reg)),
    url: pick(r, ALIAS.url),
    status: applyStatus({ apply_start: start, apply_end: end, is_always_on: false }),
  };
}

export async function getJobs(): Promise<JobBoard> {
  const first = await callOpenApiXml(URL, { numOfRows: ROWS, pageNo: 1 }, 21600);
  if (!first.ok) return { ok: false, reason: first.reason, jobs: [], total: 0 };

  const rows = [...first.rows];
  const pages = Math.min(PAGES, Math.ceil(first.total / ROWS));
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      callOpenApiXml(URL, { numOfRows: ROWS, pageNo: i + 2 }, 21600),
    ),
  );
  for (const r of rest) if (r.ok) rows.push(...r.rows);

  const jobs: Job[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const j = toJob(r);
    if (!j || seen.has(j.id)) continue;
    seen.add(j.id);
    jobs.push(j);
  }
  if (!jobs.length) {
    console.warn("[pubJobs] 항목 이름이 안 맞는다. 첫 건:", Object.keys(rows[0] ?? {}));
    return { ok: false, reason: "응답 항목을 읽지 못했습니다.", jobs: [], total: first.total };
  }

  // 접수 중인 것을 마감 임박순으로 앞에, 예정·마감은 뒤로.
  const rank: Record<ApplyStatus, number> = { ongoing: 0, always: 0, upcoming: 1, closed: 2 };
  jobs.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.end ?? "9999").localeCompare(b.end ?? "9999") ||
      (b.reg ?? "").localeCompare(a.reg ?? ""),
  );
  return { ok: true, reason: null, jobs, total: first.total };
}

/** "서울,경기" / "서울 경기" / "전국" 처럼 오는 근무지를 시·도 조각으로. */
export function regionTokens(region: string | null) {
  if (!region) return [];
  return region
    .split(/[,/·\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

export type JobFilter = { q?: string; region?: string; hire?: string; open?: boolean };

export function filterJobs(jobs: Job[], f: JobFilter) {
  const q = f.q?.trim().toLowerCase();
  return jobs.filter((j) => {
    if (f.open && (j.status === "closed")) return false;
    if (f.region && !regionTokens(j.region).some((t) => t.startsWith(f.region!) || f.region!.startsWith(t)))
      return false;
    if (f.hire && j.hire !== f.hire) return false;
    if (q && !`${j.title} ${j.org ?? ""} ${j.sectors ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** 걸러 볼 수 있는 값 목록. 많이 나오는 순. */
export function facets(jobs: Job[]) {
  const count = (vals: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const v of vals) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ v, n }));
  };
  return {
    regions: count(jobs.flatMap((j) => regionTokens(j.region))),
    hires: count(jobs.map((j) => j.hire)),
  };
}
