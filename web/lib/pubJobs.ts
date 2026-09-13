import { applyStatus, db, dbConfigured, type ApplyStatus } from "./db";

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
    // 날짜가 없는 공고는 "진행 중"이라고 단정하지 않는다
    status: start || end ? applyStatus({ apply_start: start, apply_end: end, is_always_on: false }) : "always",
  };
}

type Stored = {
  source_id: string; title: string; org: string | null; region: string | null; hire: string | null;
  recruit: string | null; sectors: string | null; headcount: string | null;
  start_date: string | null; end_date: string | null; reg_date: string | null; url: string | null;
};

/**
 * 매일 아침 수집해 둔 표에서 최신순으로 읽는다. 표가 비어 있으면(첫 배포·
 * 수집 실패) 예전처럼 API 를 직접 부른다.
 */
async function fromStore(): Promise<JobBoard | null> {
  if (!dbConfigured) return null;
  try {
    const { data, count } = await db
      .from("job_posts")
      .select("source_id,title,org,region,hire,recruit,sectors,headcount,start_date,end_date,reg_date,url", { count: "exact" })
      .eq("source", "gojobs")
      .order("reg_date", { ascending: false, nullsFirst: false })
      .order("end_date", { ascending: false, nullsFirst: false })
      .limit(600);
    const rows = (data ?? []) as Stored[];
    if (!rows.length) return null;
    const jobs: Job[] = rows.map((r) => ({
      id: r.source_id, title: r.title, org: r.org, region: r.region, hire: r.hire, recruit: r.recruit,
      sectors: r.sectors, headcount: r.headcount, start: r.start_date, end: r.end_date, reg: r.reg_date, url: r.url,
      status: applyStatus({ apply_start: r.start_date, apply_end: r.end_date, is_always_on: false }),
    }));
    return { ok: true, reason: null, jobs: sortJobs(jobs), total: count ?? jobs.length };
  } catch {
    return null;
  }
}

/**
 * 접수 중(마감 임박 순) → 예정 → 마감. 같은 묶음 안에서는 최신 등록 순.
 *
 * 날짜를 하나도 못 읽는 응답이 있다. 그때는 정렬 기준이 없으므로 받은
 * 순서를 그대로 둔다 — 부르는 쪽이 이미 최신 쪽부터 담아 놓는다.
 */
function sortJobs(jobs: Job[]) {
  const dated = jobs.some((j) => j.end || j.reg || j.start);
  if (!dated) return jobs;
  const rank: Record<ApplyStatus, number> = { ongoing: 0, always: 0, upcoming: 1, closed: 2 };
  return jobs.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.status === "closed"
        ? (b.reg ?? b.end ?? "").localeCompare(a.reg ?? a.end ?? "")
        : (a.end ?? "9999").localeCompare(b.end ?? "9999") || (b.reg ?? "").localeCompare(a.reg ?? "")),
  );
}

/**
 * 화면은 DB 만 본다.
 *
 * 예전에는 표가 비면 여기서 API 를 직접 불렀다. 그런데 이 API 는 오래된
 * 것부터 주고 최신은 2,901쪽 뒤에 있다. 그 깊이의 쪽은 응답이 14초를
 * 넘긴다 — 그걸 여섯 쪽 부르니 화면이 30초 넘게 뼈대만 보이고 멈춰 있었다.
 * 누가 들어올 때마다 그 값을 치를 이유가 없다.
 *
 * 받아오는 일은 매일 09:00 크론과 관리자 화면이 한다. 아직 못 받았으면
 * 비었다고 솔직히 말하고 빨리 끝낸다.
 */
export async function getJobs(): Promise<JobBoard> {
  const stored = await fromStore();
  if (stored) return stored;
  return {
    ok: false,
    reason: "아직 공고를 받아오지 못했습니다. 매일 오전 9시에 새로 받아 옵니다.",
    jobs: [],
    total: 0,
  };
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
/**
 * 거르기 칩에 붙일 건수.
 *
 * 지금까지는 전체에서 셌다. 그래서 "방호"로 찾아 7건이 남았는데 칩에는
 * 서울 63 · 국가 311 이 그대로 붙어 있었다 — 누르면 7건이 아니라 63건이
 * 나온다는 뜻이니 숫자가 거짓말을 한 셈이다.
 *
 * 이제 지금 걸린 조건을 적용한 뒤에 센다. 다만 자기 자신 차원은 빼고
 * 센다 — 서울을 고른 채로 지역 칩을 셀 때 서울만 남기고 세면 다른 지역이
 * 전부 0이 되어 옮겨 갈 수가 없다. 검색 목록에서 흔히 쓰는 방식이다.
 */
export function facets(jobs: Job[], f: JobFilter = {}) {
  const count = (vals: (string | null)[]) => {
    const m = new Map<string, number>();
    for (const v of vals) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ v, n }));
  };
  // 지역 칩을 셀 때는 지역 조건을 빼고, 고용형태 칩을 셀 때는 고용형태를 뺀다.
  const forRegion = filterJobs(jobs, { ...f, region: undefined });
  const forHire = filterJobs(jobs, { ...f, hire: undefined });
  return {
    regions: count(forRegion.flatMap((j) => regionTokens(j.region))),
    hires: count(forHire.map((j) => j.hire)),
    /** "접수 중만" 칩에 붙일 수. 여기도 접수 여부를 뺀 나머지 조건 기준. */
    openN: filterJobs(jobs, { ...f, open: false }).filter((j) => j.status !== "closed").length,
  };
}

// ── 공고 하나 / 지역별 ─────────────────────────────────────

/**
 * 공고 하나. 상세 페이지가 쓴다.
 *
 * 목록에 없는 것까지 보여 주려고 raw 도 같이 읽는다. 나라일터는 항목을
 * 코드로만 주는 게 있어(areacode·type01·type02) 뜻을 아직 모른다.
 * 모르는 코드를 그럴싸한 이름인 척 보여 주지 않는다 — 안 보여 준다.
 */
export async function getJob(sourceId: string): Promise<Job | null> {
  if (!dbConfigured) return null;
  try {
    const { data } = await db
      .from("job_posts")
      .select("source_id,title,org,region,hire,recruit,sectors,headcount,start_date,end_date,reg_date,url")
      .eq("source", "gojobs")
      .eq("source_id", sourceId)
      .maybeSingle();
    if (!data) return null;
    const r = data as Stored;
    return {
      id: r.source_id, title: r.title, org: r.org, region: r.region, hire: r.hire,
      recruit: r.recruit, sectors: r.sectors, headcount: r.headcount,
      start: r.start_date, end: r.end_date, reg: r.reg_date, url: r.url,
      status: applyStatus({ apply_start: r.start_date, apply_end: r.end_date, is_always_on: false }),
    };
  } catch {
    return null;
  }
}

/** 같은 기관, 없으면 같은 지역의 다른 공고. 상세 페이지 아래에 붙인다. */
export async function getRelatedJobs(job: Job, limit = 6): Promise<Job[]> {
  if (!dbConfigured) return [];
  const run = async (col: "org" | "region", v: string) => {
    const { data } = await db
      .from("job_posts")
      .select("source_id,title,org,region,hire,recruit,sectors,headcount,start_date,end_date,reg_date,url")
      .eq("source", "gojobs").eq(col, v).neq("source_id", job.id)
      .order("reg_date", { ascending: false, nullsFirst: false })
      .limit(limit);
    return (data ?? []) as Stored[];
  };
  let rows: Stored[] = [];
  if (job.org) rows = await run("org", job.org);
  if (rows.length < 3 && job.region) rows = rows.concat(await run("region", job.region));
  const seen = new Set<string>();
  return rows
    .filter((r) => (seen.has(r.source_id) ? false : (seen.add(r.source_id), true)))
    .slice(0, limit)
    .map((r) => ({
      id: r.source_id, title: r.title, org: r.org, region: r.region, hire: r.hire,
      recruit: r.recruit, sectors: r.sectors, headcount: r.headcount,
      start: r.start_date, end: r.end_date, reg: r.reg_date, url: r.url,
      status: applyStatus({ apply_start: r.start_date, apply_end: r.end_date, is_always_on: false }),
    }));
}

/** 공고가 실제로 있는 시·도와 건수. 지역별 목차가 쓴다. */
export async function getJobRegions(): Promise<{ sido: string; n: number }[]> {
  if (!dbConfigured) return [];
  try {
    const { data } = await db
      .from("job_posts").select("region").eq("source", "gojobs").not("region", "is", null)
      .limit(5000);
    const m = new Map<string, number>();
    for (const r of (data ?? []) as { region: string }[])
      m.set(r.region, (m.get(r.region) ?? 0) + 1);
    return [...m.entries()].map(([sido, n]) => ({ sido, n })).sort((a, b) => b.n - a.n);
  } catch {
    return [];
  }
}

/** 한 시·도의 공고. */
export async function getJobsByRegion(sido: string, limit = 200): Promise<JobBoard> {
  if (!dbConfigured) return { ok: false, reason: "준비 중입니다.", jobs: [], total: 0 };
  try {
    const { data, count } = await db
      .from("job_posts")
      .select("source_id,title,org,region,hire,recruit,sectors,headcount,start_date,end_date,reg_date,url",
              { count: "exact" })
      .eq("source", "gojobs").eq("region", sido)
      .order("reg_date", { ascending: false, nullsFirst: false })
      .limit(limit);
    const rows = (data ?? []) as Stored[];
    const jobs: Job[] = rows.map((r) => ({
      id: r.source_id, title: r.title, org: r.org, region: r.region, hire: r.hire,
      recruit: r.recruit, sectors: r.sectors, headcount: r.headcount,
      start: r.start_date, end: r.end_date, reg: r.reg_date, url: r.url,
      status: applyStatus({ apply_start: r.start_date, apply_end: r.end_date, is_always_on: false }),
    }));
    return {
      ok: jobs.length > 0,
      reason: jobs.length ? null : "아직 이 지역 공고를 받아오지 못했습니다.",
      jobs: sortJobs(jobs), total: count ?? jobs.length,
    };
  } catch {
    return { ok: false, reason: "목록을 읽지 못했습니다.", jobs: [], total: 0 };
  }
}

/**
 * 사이트맵에 올릴 공고. 최근 등록순 위에서부터.
 *
 * 과거 공고를 수십만 건 받아 오므로 전부 올리면 안 된다. 오래전에 끝난
 * 공고는 사람에게도 검색엔진에도 쓸모가 없다. 최근 1년치 안에서만 고른다.
 */
export async function getTopJobIds(limit = 400): Promise<string[]> {
  if (!dbConfigured) return [];
  const yearAgo = new Date();
  yearAgo.setDate(yearAgo.getDate() - 365);
  try {
    const { data } = await db
      .from("job_posts").select("source_id").eq("source", "gojobs")
      .gte("reg_date", yearAgo.toISOString().slice(0, 10))
      .order("reg_date", { ascending: false, nullsFirst: false })
      .limit(limit);
    return ((data ?? []) as { source_id: string }[]).map((r) => r.source_id);
  } catch {
    return [];
  }
}
