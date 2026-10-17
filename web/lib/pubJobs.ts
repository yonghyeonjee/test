import { cache } from "react";
import { applyStatus, db, dbConfigured, type ApplyStatus } from "./db";
import { SIDO_SHORT, normSido } from "./geo";
import { dropAlioTwins, isTwin } from "./jobTwins";
import { gojobsFileUrl, type GojobsDetail } from "./gojobsDetail";
import { filterJobs, regionTokens, type JobFilter } from "./jobFilter";
import { stageOf } from "./jobRole";
import { toLoadedSummary, type JobSummary } from "./jobSummary";

/**
 * 채용 목록이 읽는 출처. 나라일터(gojobs)와 잡알리오(alio, source_id 가 a 로 시작).
 * 2026-10-06 두 출처를 in() 으로 읽자 정렬 색인을 못 타 22만 건을 정렬하다 시간 초과가 나서 나라일터만 남겼다.
 * 2026-10-17 다시 넣었다. 그사이 두 출처용 부분 색인(job_posts_pub_reg_idx)이 생겨 목록·사이트맵·검색·지도는
 * 0.5~7ms 로 같다(쿼리마다 EXPLAIN 으로 잼). 기관(org) 조회만은 (org, reg_date) 색인이 나라일터 부분 색인이라
 * 출처마다 따로 읽어 합친다(perSource). 같은 공고가 두 곳에 다 있으면 lib/jobTwins 가 잡알리오 쪽을 뺀다.
 */
export const JOB_SOURCES = ["gojobs", "alio"];

/**
 * source 조건을 거는 법. 출처가 하나뿐일 때 in() 으로 물으면 SQL 이 source = ANY(...) 가 되고,
 * 그러면 (source, reg_date) 인덱스의 정렬을 못 써 23만 건을 다 읽고 정렬한다(0.7초, 디스크가
 * 느리면 익명 제한 3초를 넘김 — 2026-10-06 /jobs 장애의 직접 원인). 하나면 eq 로 묻는다(0.02초).
 */
export const SOURCE_OP = JOB_SOURCES.length === 1 ? "eq" : "in";
export const SOURCE_VAL = JOB_SOURCES.length === 1 ? JOB_SOURCES[0] : `(${JOB_SOURCES.join(",")})`;

/**
 * 상세 쪽(공고 한 건)이 읽는 출처. 목록(JOB_SOURCES)과 같지만 따로 둔다 — 목록에서 출처를 다시 빼는 일이
 * 있어도 브리핑 글(pipeline/blog_daily.py)과 색인 알림(pipeline/indexing.py)이 내보낸 주소는 살아 있어야 한다.
 * 상세가 나라일터만 찾자 접수 중인 잡알리오 공고가 전부 "내려간 공고"(200 + noindex)로 나갔다 —
 * 2026-10-17 서치 콘솔 noindex 목록과 서버 캐시에서 확인. 한 건 찾기는 source_id 인덱스를 타므로
 * 출처가 둘이어도 10-06 목록 장애(정렬 인덱스를 못 탐)와 달리 느려지지 않는다.
 */
export const DETAIL_SOURCES = ["gojobs", "alio"];

export { filterJobs, jobTermsUsed, regionTokens, type JobFilter } from "./jobFilter";

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
  /** DB 를 읽지 못해 비었다(없어서 빈 것과 다르다). 상세·기관 쪽은 이때 404 대신 던져 캐시에 남기지 않는다. */
  failed?: boolean;
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

/** 저장된 한 줄을 화면이 쓰는 모양으로. */
function toStoredJob(r: Stored): Job {
  return {
    id: r.source_id, title: r.title, org: r.org, region: r.region, hire: r.hire,
    recruit: r.recruit, sectors: r.sectors, headcount: r.headcount,
    start: r.start_date, end: r.end_date, reg: r.reg_date, url: r.url,
    status: applyStatus({ apply_start: r.start_date, apply_end: r.end_date, is_always_on: false }),
  };
}

/** 나라일터·잡알리오에 같이 올라온 공고는 나라일터 쪽만 남긴다(lib/jobTwins). */
const noTwins = (jobs: Job[]) => dropAlioTwins(jobs, (j) => ({ id: j.id, title: j.title, reg: j.reg, end: j.end }));

type SrcResult = { data: unknown[] | null; error: { message: string } | null; count?: number | null };

/**
 * 같은 쿼리를 출처마다 따로 돌려 등록일 최신순으로 합친다. (org, reg_date) 색인은 source='gojobs' 부분
 * 색인이라 source in (…) 으로 물으면 못 탄다 — 기관 쪽·관련 공고만 이 길로 간다. 건수는 출처별 합.
 */
async function perSource(q: (src: string) => PromiseLike<SrcResult>): Promise<{ rows: Stored[]; count: number | null; error: string | null }> {
  const res = await Promise.all(JOB_SOURCES.map((s) => q(s)));
  const err = res.find((r) => r.error)?.error ?? null;
  const rows = res.flatMap((r) => (r.data ?? []) as Stored[])
    .sort((a, b) => (b.reg_date ?? "").localeCompare(a.reg_date ?? ""));
  const count = res.every((r) => typeof r.count === "number") ? res.reduce((a, r) => a + (r.count as number), 0) : null;
  return { rows, count, error: err ? err.message : null };
}

/** PostgREST 가 한 번에 돌려주는 최대 줄 수(Supabase max_rows). .limit(3000) 을 걸어도 1,000줄만 온다. */
export const PAGE_ROWS = 1000;

/**
 * 1,000줄씩 나눠 끝까지(또는 max 줄까지) 읽는다. 쿼리는 순서가 정해져 있어야 쪽이 겹치거나 빠지지 않는다
 * (끝에 source_id 같은 유일한 열로 한 번 더 정렬). 잡알리오를 넣자 접수 중 공고가 1,033건이 되어 한 번에
 * 다 안 왔다(2026-10-17 검토).
 */
export async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  max = 5000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += PAGE_ROWS) {
    const { data, error } = await page(from, Math.min(from + PAGE_ROWS, max) - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_ROWS) break;
  }
  return out;
}

/**
 * 목록에 올릴 최근 공고 수.
 *
 * 600건이었다. 그런데 모아 둔 것이 2만 건을 넘어가면서 "수집한 것에 비해
 * 너무 적게 나온다"는 말이 나왔다 — 맞는 말이다. 다만 2만 건 전부가 지금
 * 볼 만한 것은 아니다. 대부분은 2008~2013년에 끝난 공고이고, 그건 목록이
 * 아니라 기관별 이력(/jobs/org/…)에서 봐야 한다.
 *
 * 3,000건으로 적어 두었지만 PostgREST 가 한 번에 1,000줄까지만 줘서 실제로는 늘 1,000건이었다.
 * 지금은 최근 1,000건(한 번)에 접수 중인 것 전부(나눠 읽기)를 더한다. 읽어 온 전체를 대상으로 걸러야
 * 칩에 붙는 숫자가 맞기 때문에, 쪽 나눔은 읽는 단계가 아니라 그리는 단계에서 한다.
 */
const LIST_MAX = PAGE_ROWS;

/**
 * 매일 아침 수집해 둔 표에서 최신순으로 읽는다. 표가 비어 있으면(첫 배포·
 * 수집 실패) 예전처럼 API 를 직접 부른다.
 */
async function fromStore(): Promise<JobBoard | null> {
  if (!dbConfigured) return null;
  try {
    // 최근 1,000건에 더해 접수 중인 것은 전부(1천 건 남짓, 마감일 색인, 나눠 읽기). 잡알리오가 들어오면서
    // 최근 창이 좁아져, 일찍 올라와 아직 접수 중인 공고가 목록에서 빠지던 것을 막는다. 접수 중 읽기가
    // 실패해도 목록은 최근 것으로 그린다.
    const today = new Date().toISOString().slice(0, 10);
    const [recent, open] = await Promise.all([
      db.from("job_posts")
        .select("source_id,title,org,region,hire,recruit,sectors,headcount,start_date,end_date,reg_date,url", { count: "estimated" })
        .filter("source", SOURCE_OP, SOURCE_VAL)
        .order("reg_date", { ascending: false, nullsFirst: false })
        .order("end_date", { ascending: false, nullsFirst: false })
        .limit(LIST_MAX),
      readAll<Stored>((from, to) => db.from("job_posts")
        .select("source_id,title,org,region,hire,recruit,sectors,headcount,start_date,end_date,reg_date,url")
        .filter("source", SOURCE_OP, SOURCE_VAL)
        .gte("end_date", today)
        .order("end_date", { ascending: true }).order("source_id")
        .range(from, to)).catch(() => [] as Stored[]),
    ]);
    const { data, count } = recent;
    const seen = new Set<string>();
    const rows = [...((data ?? []) as Stored[]), ...open]
      .filter((r) => (seen.has(r.source_id) ? false : (seen.add(r.source_id), true)));
    if (!rows.length) return null;
    const jobs: Job[] = noTwins(rows.map(toStoredJob));
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
    /** 지역이 적히지 않은 공고(중앙부처 공고 대부분). 지역 칩 수와 목록 수가
     *  안 맞아 보이지 않게 같이 보여 준다. */
    noRegionN: forRegion.filter((j) => regionTokens(j.region).length === 0).length,
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
export const getJob = cache(async (sourceId: string): Promise<Job | null> => {
  if (!dbConfigured) return null;
  // DB 가 잠깐 안 될 때 null 을 돌려주면 그 공고는 "내려간 공고"(200 + noindex)로 그려지고
  // ISR 에 사흘 남는다. 검색엔진은 그걸 보고 색인에서 지운다. 없는 것과 못 읽은 것은 다르다.
  // supabase-js 는 시간 초과·5xx 를 던지지 않고 { data: null, error } 로 돌려준다 — 그래서 예전의
  // try/catch 는 한 번도 돌지 않았다(2026-10-17 SEO 점검). error 를 직접 보고 던진다. 던지면 첫 렌더는
  // 500(캐시 안 됨), 재생성은 실패로 남아 이전의 멀쩡한 쪽이 계속 나간다.
  const { data, error } = await db
    .from("job_posts")
    .select("source_id,title,org,region,hire,recruit,sectors,headcount,start_date,end_date,reg_date,url")
    .in("source", DETAIL_SOURCES)
    .eq("source_id", sourceId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`[getJob ${sourceId}] ${error.message}`);
  if (!data) return null;
  return toStoredJob(data as Stored);
});

/**
 * 어떤 소스에든 이 번호가 있는지. 상세 쪽이 gojobs 에서 못 찾았을 때
 * 해외채용(worldjob) 번호면 그쪽 목록으로 보내 주려고 본다.
 */
/**
 * 첨부파일. 두 곳에서 온다.
 *  - 정책브리핑(korea.kr): pipeline/korea_attach.py 가 raw.korea 에 적는다. 바로보기 주소가 있다.
 *  - 나라일터 상세: lib/gojobsDetail 이 raw.gojobs 에 적는다. 내려받기만 된다(view 는 null).
 * 정책브리핑 것이 있으면 그것을, 없으면 나라일터 것을 준다.
 */
export type JobFile = { name: string; ext: string; dl: string; view: string | null };
export type JobAttach = {
  from: "korea" | "gojobs";
  id: string; url: string; org: string | null; reg: string | null; end: string | null; files: JobFile[];
  /** 나라일터 상세 표의 칸. 정책브리핑 것은 null. */
  grade: string | null; workArea: string | null;
};

export const getJobAttach = cache(async (sourceId: string): Promise<JobAttach | null> => {
  if (!dbConfigured) return null;
  try {
    const { data } = await db
      .from("job_posts").select("url,korea:raw->korea,gojobs:raw->gojobs")
      .in("source", DETAIL_SOURCES).eq("source_id", sourceId).limit(1).maybeSingle();
    const row = data as { url: string | null; korea?: Partial<JobAttach> | null; gojobs?: GojobsDetail | null } | null;
    const k = row?.korea;
    if (k && k.url && Array.isArray(k.files))
      return { from: "korea", id: String(k.id ?? ""), url: k.url, org: k.org ?? null, reg: k.reg ?? null, end: k.end ?? null,
               files: k.files.filter((f) => f && f.name && f.dl), grade: null, workArea: null };
    const g = row?.gojobs;
    if (g && Array.isArray(g.files) && (g.files.length || g.grade || g.workArea))
      return { from: "gojobs", id: sourceId, url: row?.url ?? "https://www.gojobs.go.kr", org: null, reg: null, end: null,
               files: g.files.filter((f) => f && f.name && f.uuid).map((f) => ({ name: f.name, ext: f.ext, dl: gojobsFileUrl(f), view: null })),
               grade: g.grade ?? null, workArea: g.workArea ?? null };
    return null;
  } catch {
    return null;
  }
});

export async function findJobSource(sourceId: string): Promise<string | null> {
  if (!dbConfigured) return null;
  const { data } = await db
    .from("job_posts").select("source").eq("source_id", sourceId).limit(1).maybeSingle();
  return (data as { source: string } | null)?.source ?? null;
}

/**
 * 지금 접수 중인 공고 몇 건. 내려간 공고 대신 보여 줄 때 쓴다.
 *
 * Next 는 not-found 경계를 그 구역의 모든 쪽 응답에 같이 실어 보낸다.
 * 즉 이 함수는 상세 쪽이 열릴 때마다 돈다. 목록 전체를 읽지 말고
 * 마감이 가까운 열 건만 가볍게 묻는다.
 */
export async function getOpenJobs(limit = 10): Promise<Job[]> {
  if (!dbConfigured) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from("job_posts")
    .select("source_id,title,org,region,hire,recruit,sectors,headcount,start_date,end_date,reg_date,url")
    .filter("source", SOURCE_OP, SOURCE_VAL)
    .gte("end_date", today)
    .order("end_date", { ascending: true })
    .limit(limit);
  return noTwins(((data ?? []) as Stored[]).map(toStoredJob)).filter((j) => j.status === "ongoing");
}

/** 같은 기관, 없으면 같은 지역의 다른 공고. 상세 페이지 아래에 붙인다. */
export async function getRelatedJobs(job: Job, limit = 6): Promise<Job[]> {
  if (!dbConfigured) return [];
  // 출처마다 따로 묻는다. in() 으로 물으면 (org, reg_date)·(source, region, reg_date) 색인을 못 타
  // 공고 쪽마다 0.7ms 이던 것이 8~70ms 가 됐다(2026-10-17 측정).
  const run = async (col: "org" | "region", v: string) =>
    (await perSource((src) => db
      .from("job_posts")
      .select("source_id,title,org,region,hire,recruit,sectors,headcount,start_date,end_date,reg_date,url")
      .eq("source", src).eq(col, v).neq("source_id", job.id)
      .order("reg_date", { ascending: false, nullsFirst: false })
      .limit(limit))).rows;
  let rows: Stored[] = [];
  if (job.org) rows = await run("org", job.org);
  if (rows.length < 3 && job.region) rows = rows.concat(await run("region", job.region));
  const seen = new Set<string>();
  const me = { id: job.id, title: job.title, reg: job.reg, end: job.end };
  // 지금 보는 공고의 다른 출처 쌍둥이도 뺀다(같은 공고가 "다른 공고"로 맨 위에 뜨던 것).
  return noTwins(rows
    .filter((r) => (seen.has(r.source_id) ? false : (seen.add(r.source_id), true)))
    .map(toStoredJob))
    .filter((j) => !isTwin({ id: j.id, title: j.title, reg: j.reg, end: j.end }, me))
    .slice(0, limit);
}

/** 지역 쪽이 한 시·도로 치는 이름들: 정식 이름과 줄임말("서울특별시", "서울"). getJobsByRegion 과 목차가 같이 쓴다. */
function sidoNames(sido: string): string[] {
  const safe = (w: string) => w.replace(/[,()%]/g, "").trim();
  return Array.from(new Set([sido, ...(SIDO_SHORT[sido] ?? "").split("·")].map(safe).filter((t) => t.length >= 2)));
}

/**
 * 시·도와 지금 접수 중인 공고 수. 지역별 목차와 사이트맵이 쓴다.
 *
 * 예전에는 region 칸을 순서 없이 5,000줄 읽어 세서 강원·경기 두 곳만 나왔다(2026-10-17 점검).
 * 지역 쪽(getJobsByRegion)과 같은 기준으로 센다: region 이 그 시·도이거나, 기관명·제목에 그 이름이 있으면.
 * 나라일터 공고는 region 이 빈 것이 많아(누리집에서 받은 것) 이름으로 잡는다. 두 시·도 이름이 다 들어간
 * 공고는 양쪽에 센다(지역 쪽에도 양쪽에 나온다). 시·도 목록은 고정이라 목차와 사이트맵이 흔들리지 않는다.
 */
export async function getJobRegions(): Promise<{ sido: string; n: number }[]> {
  if (!dbConfigured) return [];
  const sidos = Object.keys(SIDO_SHORT);
  const n = new Map(sidos.map((s) => [s, 0]));
  try {
    const today = new Date().toISOString().slice(0, 10);
    type R = { source_id: string; title: string; org: string | null; region: string | null; reg_date: string | null; end_date: string | null };
    const data = await readAll<R>((from, to) => db
      .from("job_posts").select("source_id,title,org,region,reg_date,end_date")
      .filter("source", SOURCE_OP, SOURCE_VAL).gte("end_date", today)
      .order("source_id").range(from, to));
    const rows = dropAlioTwins(data, (r) => ({ id: r.source_id, title: r.title, reg: r.reg_date, end: r.end_date }));
    const names = sidos.map((s) => [s, sidoNames(s)] as const);
    for (const r of rows) {
      const hay = `${r.org ?? ""} ${r.title}`;
      for (const [s, ns] of names) if (r.region === s || ns.some((t) => hay.includes(t))) n.set(s, (n.get(s) ?? 0) + 1);
    }
  } catch {
    // 숫자를 못 셌어도 시·도 목록은 그대로 낸다.
  }
  return sidos.map((sido) => ({ sido, n: n.get(sido) ?? 0 })).sort((a, b) => b.n - a.n);
}

/**
 * 한 시·도의 공고.
 *
 * region 칸만 보면 절반이 빠진다 — 나라일터 누리집에서 받은 공고는 region 이 비어 있고(2026-09 이후 전부),
 * 기관명에 "인천남동우체국" 처럼 지역이 적혀 있다. 통합 검색·정책지도·목록 거르기(lib/jobFilter)와 같은
 * 기준으로 제목·기관명의 시·도 이름("인천", "인천광역시")도 본다. 지도에서 넘어온 공고가 여기서 사라지던 일.
 */
export async function getJobsByRegion(sido: string, limit = 200): Promise<JobBoard> {
  if (!dbConfigured) return { ok: false, reason: "준비 중입니다.", jobs: [], total: 0 };
  // 시·도가 아닌 값("해외" 등)은 두 글자 ILIKE 로 22만 건을 훑는다(2.5초). 묻지 않는다.
  if (!normSido(sido)) return { ok: false, reason: "시·도 이름이 아닙니다.", jobs: [], total: 0 };
  try {
    const names = sidoNames(sido);
    const clause = [`region.eq.${sido.replace(/[,()%]/g, "").trim()}`, ...names.flatMap((t) => [`org.ilike.%${t}%`, `title.ilike.%${t}%`])].join(",");
    const today = new Date().toISOString().slice(0, 10);
    // 건수(count)는 묻지 않는다. PostgREST 가 같은 조건으로 한 번 더 세는데, 두 글자 ILIKE 라 매번 전체를 훑어
    // 평균 1.2초, 길게는 3초 제한에 걸렸다(2026-10-17 pg_stat_statements). 화면은 읽어 온 건수만 쓴다.
    // 최근 200건에 더해 접수 중인 것은 전부(마감일 색인, 시·도마다 많아야 수백 건). 잡알리오가 최근 창의
    // 3분의 1을 차지해 접수 중 공고가 빠지던 것(서울 194건 중 133건만 보임)을 막는다.
    const [recent, open] = await Promise.all([
      db.from("job_posts")
        .select("source_id,title,org,region,hire,recruit,sectors,headcount,start_date,end_date,reg_date,url")
        .filter("source", SOURCE_OP, SOURCE_VAL).or(clause)
        .order("reg_date", { ascending: false, nullsFirst: false })
        .limit(limit),
      db.from("job_posts")
        .select("source_id,title,org,region,hire,recruit,sectors,headcount,start_date,end_date,reg_date,url")
        .filter("source", SOURCE_OP, SOURCE_VAL).or(clause).gte("end_date", today)
        .order("end_date", { ascending: true })
        .limit(PAGE_ROWS),
    ]);
    if (recent.error) throw recent.error;
    const seen = new Set<string>();
    const rows = [...((recent.data ?? []) as Stored[]), ...((open.data ?? []) as Stored[])]
      .filter((r) => (seen.has(r.source_id) ? false : (seen.add(r.source_id), true)));
    const jobs: Job[] = noTwins(rows.map(toStoredJob));
    return {
      ok: jobs.length > 0,
      reason: jobs.length ? null : "아직 이 지역 공고를 받아오지 못했습니다.",
      jobs: sortJobs(jobs), total: jobs.length,
    };
  } catch {
    return { ok: false, reason: "목록을 읽지 못했습니다.", jobs: [], total: 0 };
  }
}

/**
 * 사이트맵에 올릴 공고. 색인하는 것(app/jobs/[id] 의 robots 규칙)만 올린다.
 *
 * 2026-10-17 서치 콘솔에서 사이트맵 표본 60쪽 중 색인 0. 접수 중 나라일터·잡알리오 전부(1천 건 남짓)에
 * 마감 공고까지 채워 넣던 것을, 공고 쪽에서 noindex 로 돌린 것(잡알리오, 합격자 발표·면접 안내·채용 계획,
 * 마감 공고)을 빼고 접수 중인 나라일터 모집 공고만 남긴다. 첨부 공고문 요약이 붙은 것을 앞에, 그다음
 * 나머지. 각 묶음 안은 등록 최신순, 같은 날은 번호순이라 빌드마다 순서가 바뀌지 않는다.
 * 요약을 못 읽으면 순서만 못 가를 뿐 목록은 그대로 낸다(요약이 없어도 접수 중 모집 공고는 색인한다).
 */
export async function getTopJobIds(limit = 1200): Promise<{ id: string; updated: string | null }[]> {
  if (!dbConfigured) return [];
  const yearAgo = new Date();
  yearAgo.setDate(yearAgo.getDate() - 365);
  const year = yearAgo.toISOString().slice(0, 10);
  // 한국 날짜로 센다. 공고 쪽의 "마감"(applyStatus)이 한국 날짜라, UTC 로 세면 새벽 아홉 시간 동안 어제 마감한 공고가 남는다.
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  type R = { source_id: string; title: string; reg_date: string | null };
  try {
    const data = await readAll<R>((from, to) => db
      .from("job_posts").select("source_id,title,reg_date").eq("source", "gojobs")
      .gte("end_date", today).gte("reg_date", year)
      .order("reg_date", { ascending: false, nullsFirst: false }).order("source_id")
      .range(from, to));
    const rows = data.filter((r) => { const s = stageOf(r.title); return s === "open" || s === "repost"; });
    const withSummary = new Set<string>();
    try {
      for (let i = 0; i < rows.length; i += 300) {
        const ids = rows.slice(i, i + 300).map((r) => r.source_id);
        const { data: sums, error } = await db.from("job_summaries_public").select("source_id,summary").in("source_id", ids);
        if (error) throw new Error(error.message);
        for (const s of (sums ?? []) as { source_id: string; summary: Partial<JobSummary> | null }[])
          if (toLoadedSummary(s)) withSummary.add(s.source_id);
      }
    } catch {
      withSummary.clear();
    }
    const ordered = [...rows.filter((r) => withSummary.has(r.source_id)), ...rows.filter((r) => !withSummary.has(r.source_id))];
    // 등록일을 <lastmod> 로 쓴다. 공고는 올라온 뒤 내용이 거의 안 바뀐다.
    return ordered.slice(0, limit).map((r) => ({ id: r.source_id, updated: r.reg_date }));
  } catch {
    return [];
  }
}

// ── 마감된 공고에서 뽑아 쓰는 것 ─────────────────────────────

/**
 * 모아 둔 공고 2만여 건 가운데 지금 접수 중인 것은 수백 건뿐이다. 나머지는
 * 이미 끝난 공고다. 목록에 늘어놓아 봐야 쓸모가 없지만, 모아 놓고 보면
 * 목록으로는 알 수 없는 것이 나온다.
 *
 *  - 접수 기간이 며칠인지. 전체 중앙값 9일. 기관에 따라 5일도 있다.
 *  - 어떤 기관이 얼마나 자주 뽑는지, 마지막으로 뽑은 게 언제인지.
 *  - 그 기관 공고가 주로 몇 월에 올라오는지.
 *
 * 세는 일은 데이터베이스가 한다(job_overview·job_org_stats 뷰). 2만 건을
 * 화면으로 끌어와 세면 그것만으로 몇 초가 간다.
 *
 * 다만 지금 모여 있는 과거분은 2008~2013년이 대부분이다. 그때 자료로
 * "이 기관은 5월에 뽑습니다" 하고 말하면 거짓말에 가깝다. 그래서 화면에는
 * 항상 "언제부터 언제까지 몇 건 기준"인지를 같이 적는다.
 */
export type JobOverview = {
  total: number;
  openN: number;
  orgs: number;
  lastYear: number;
  firstReg: string | null;
  lastReg: string | null;
  medDays: number | null;
};

/**
 * 잡알리오 공고 수(전체·접수 중). job_overview 는 2008년부터의 추이를 보는 나라일터 집계라 잡알리오를 넣지
 * 않는다(잡알리오는 2026-08 부터라 섞으면 월별·기관별 추이가 틀어진다). 첫 화면 숫자에만 더한다. 각 1ms 남짓.
 */
export const getAlioCounts = cache(async (): Promise<{ total: number; open: number } | null> => {
  if (!dbConfigured) return null;
  const today = new Date().toISOString().slice(0, 10);
  const [all, open] = await Promise.all([
    db.from("job_posts").select("id", { count: "exact", head: true }).eq("source", "alio"),
    db.from("job_posts").select("id", { count: "exact", head: true }).eq("source", "alio").gte("end_date", today),
  ]);
  if (all.error || open.error) return null;
  return { total: all.count ?? 0, open: open.count ?? 0 };
});

export async function getJobOverview(): Promise<JobOverview | null> {
  if (!dbConfigured) return null;
  try {
    const { data, error } = await db
      .from("job_overview")
      .select("total,open_n,orgs,last_year,first_reg,last_reg,med_days")
      .maybeSingle();
    if (error || !data) return null;
    const r = data as Record<string, number | string | null>;
    return {
      total: Number(r.total ?? 0),
      openN: Number(r.open_n ?? 0),
      orgs: Number(r.orgs ?? 0),
      lastYear: Number(r.last_year ?? 0),
      firstReg: (r.first_reg as string) ?? null,
      lastReg: (r.last_reg as string) ?? null,
      medDays: r.med_days == null ? null : Number(r.med_days),
    };
  } catch {
    return null;
  }
}

export type OrgStat = {
  org: string;
  n: number;
  openN: number;
  firstReg: string | null;
  lastReg: string | null;
  avgDays: number | null;
  /** 1월~12월 공고 수. 길이 12. */
  months: number[];
};

const toOrgStat = (r: Record<string, unknown>): OrgStat => ({
  org: String(r.org),
  n: Number(r.n ?? 0),
  openN: Number(r.open_n ?? 0),
  firstReg: (r.first_reg as string) ?? null,
  lastReg: (r.last_reg as string) ?? null,
  avgDays: r.avg_days == null ? null : Number(r.avg_days),
  months: Array.isArray(r.months) ? (r.months as number[]).map(Number) : [],
});

const ORG_COLS = "org,n,open_n,first_reg,last_reg,avg_days,months";

/** 기관 하나의 채용 이력 요약. */
export const getOrgStat = cache(async (org: string): Promise<OrgStat | null> => {
  if (!dbConfigured) return null;
  try {
    const { data } = await db.from("job_org_stats").select(ORG_COLS).eq("org", org).maybeSingle();
    return data ? toOrgStat(data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
});

/**
 * 기관 쪽(/jobs/org)이 쓰는 엄격한 판. DB 오류를 "없는 기관"으로 읽지 않고 던진다.
 * 느슨한 getOrgStat 은 오류를 null 로 삼킨다. 기관 쪽은 null 이고 목록도 비면 notFound() 를 부르고
 * 그 404 가 세 시간 캐시에 남았다(2026-10-17 점검, getJob 과 같은 결함). 공고 상세의 곁가지 통계는
 * 느슨한 판을 그대로 쓴다 — 곁가지 하나 때문에 공고 쪽 전체가 500 이 되면 안 된다.
 */
export const getOrgStatStrict = cache(async (org: string): Promise<OrgStat | null> => {
  if (!dbConfigured) return null;
  const { data, error } = await db.from("job_org_stats").select(ORG_COLS).eq("org", org).maybeSingle();
  if (error) throw new Error(`[getOrgStat ${org}] ${error.message}`);
  return data ? toOrgStat(data as Record<string, unknown>) : null;
});

/** 기관 쪽을 색인하는 최근 365일 공고 수(나라일터 + 잡알리오)의 하한. */
export const ORG_INDEX_MIN = 5;

/**
 * 기관들의 최근 365일 공고 수(나라일터 + 잡알리오). 기관 쪽의 색인 여부와 사이트맵이 쓴다(2026-10-17).
 * 나라일터는 미리 센 표 job_org_recent 의 n12(등록일이 오늘부터 365일 안)를 쓰고, 잡알리오는 그 표에
 * 없어 공고를 직접 센다 — 1년에 2천 건 남짓이라 (source, reg_date) 색인으로 몇 ms 다. 두 곳에 같이 올라온
 * 공고(lib/jobTwins)는 겹쳐 센다. 못 읽으면 던진다 — 부르는 쪽이 "못 읽음"을 "적음"으로 치지 않고 색인 쪽으로 두게.
 */
export async function getOrgRecentCounts(orgs: string[]): Promise<Map<string, number>> {
  const n = new Map(orgs.map((o) => [o, 0]));
  if (!orgs.length) return n;
  if (!dbConfigured) throw new Error("[getOrgRecentCounts] DB 가 설정되지 않아 셀 수 없다");
  const yearAgo = new Date();
  yearAgo.setDate(yearAgo.getDate() - 365);
  const year = yearAgo.toISOString().slice(0, 10);
  const chunks: string[][] = [];
  for (let i = 0; i < orgs.length; i += 50) chunks.push(orgs.slice(i, i + 50));
  await Promise.all(chunks.map(async (chunk) => {
    const [g, a] = await Promise.all([
      db.from("job_org_recent").select("org,n12").in("org", chunk),
      readAll<{ org: string }>((from, to) => db
        .from("job_posts").select("org").eq("source", "alio").gt("reg_date", year).in("org", chunk)
        .order("source_id").range(from, to)),
    ]);
    if (g.error) throw new Error(`[job_org_recent] ${g.error.message}`);
    for (const r of (g.data ?? []) as { org: string; n12: number | null }[]) n.set(r.org, (n.get(r.org) ?? 0) + Number(r.n12 ?? 0));
    for (const r of a) n.set(r.org, (n.get(r.org) ?? 0) + 1);
  }));
  return n;
}

/**
 * 공고를 많이 낸 기관 순. 기관 목차와 사이트맵이 쓴다.
 *
 * 두 건짜리 기관까지 4,564곳이 있다. 전부 페이지로 만들면 알맹이 없는
 * 쪽이 수천 개 생긴다 — 검색엔진이 싫어하는 딱 그것이다. 여덟 건 이상
 * 낸 곳만 쓴다(671곳).
 */
export async function getTopOrgs(limit = 300, minN = 8): Promise<OrgStat[]> {
  if (!dbConfigured) return [];
  try {
    const { data } = await db
      .from("job_org_stats").select(ORG_COLS)
      .gte("n", minN)
      .order("n", { ascending: false })
      .limit(limit);
    return ((data ?? []) as Record<string, unknown>[]).map(toOrgStat);
  } catch {
    return [];
  }
}

/** 한 기관의 공고 전부. 접수 중인 것이 앞, 그다음 최근 등록순. */
export async function getJobsByOrg(org: string, limit = 300): Promise<JobBoard> {
  if (!dbConfigured) return { ok: false, reason: "준비 중입니다.", jobs: [], total: 0 };
  try {
    // 출처마다 따로 읽는다(perSource). in() 으로 물으면 (org, reg_date) 색인을 못 타 1.4ms → 11~70ms.
    const read = () => perSource((src) => db
      .from("job_posts")
      .select("source_id,title,org,region,hire,recruit,sectors,headcount,start_date,end_date,reg_date,url")
      .eq("source", src).eq("org", org)
      .order("reg_date", { ascending: false, nullsFirst: false })
      .limit(limit));
    // 한 번 늦으면(공고 수집이 도는 동안 가끔) 한 번 더 읽는다.
    let res = await read();
    if (res.error) res = await read();
    if (res.error) throw new Error(res.error);
    // 건수(count)는 묻지 않는다. 기관 쪽 머리 숫자는 통계(job_org_stats)와 목록에서 센다.
    const jobs = noTwins(res.rows.map(toStoredJob)).slice(0, limit);
    return {
      ok: jobs.length > 0,
      reason: jobs.length ? null : "이 기관의 공고를 아직 받아오지 못했습니다.",
      jobs: sortJobs(jobs),
      total: jobs.length,
    };
  } catch {
    return { ok: false, reason: "목록을 읽지 못했습니다.", jobs: [], total: 0, failed: true };
  }
}

const MONTH_LABEL = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

/**
 * "주로 N월에 올라옵니다" 라고 말해도 되는지.
 *
 * 열두 달에 고르게 뿌려진 것을 두고 제일 큰 달을 집어 "이 달에 뽑는다"고
 * 하면 안 된다. 법무부는 239건인데 5월과 6월이 26건씩으로 제일 많다.
 * 고르게 나눠도 달마다 20건이니, 26건은 아무 뜻이 없다.
 *
 * 기준을 두 개 둔다 — 30건 이상 모였고, 가장 많은 두 달의 합이 전체의
 * 40%를 넘을 때만. 열두 달에 아무렇게나 뿌려도 두 달이 32% 안팎은
 * 차지하므로 40%는 넉넉한 기준은 아니지만, 지금 자료에서 149곳 중 19곳만
 * 넘는다. 나머지에는 아무 말도 하지 않는다.
 */
export function peakMonths(
  months: number[],
  minN = 30,
  minShare = 0.4,
): { label: string; share: number } | null {
  const total = months.reduce((a, b) => a + b, 0);
  if (months.length !== 12 || total < minN) return null;
  const idx = months.map((n, i) => [n, i] as const).sort((a, b) => b[0] - a[0]);
  const sum = idx[0][0] + idx[1][0];
  if (sum / total < minShare) return null;
  const two = [idx[0][1], idx[1][1]].sort((x, y) => x - y);
  return { label: two.map((i) => MONTH_LABEL[i]).join("·"), share: Math.round((sum / total) * 100) };
}

/**
 * 공고에 붙은 기관 구분과 건수. 구분별 목록과 사이트맵이 쓴다.
 *
 * 지금 값은 국가·교육·지자체·공공 넷이다. 나라일터 목록의 아이콘에서
 * 읽어 온 것이라 고용형태(정규직·기간제)가 아니라 기관 계통이다.
 */
export async function getJobHires(): Promise<{ hire: string; n: number }[]> {
  if (!dbConfigured) return [];
  try {
    const { data } = await db
      .from("job_posts").select("hire").filter("source", SOURCE_OP, SOURCE_VAL)
      .not("hire", "is", null)
      .gte("reg_date", new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10))
      .limit(5000);
    const m = new Map<string, number>();
    for (const r of (data ?? []) as { hire: string | null }[]) {
      // 값이 비었거나 "null" 이라는 글자가 그대로 들어온 줄이 있다.
      // 그대로 두면 /jobs/hire/null 같은 주소가 사이트맵에 실린다.
      const v = (r.hire ?? "").trim();
      if (!v || v === "null" || v === "undefined") continue;
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    return [...m.entries()].map(([hire, n]) => ({ hire, n })).sort((a, b) => b.n - a.n);
  } catch {
    return [];
  }
}
