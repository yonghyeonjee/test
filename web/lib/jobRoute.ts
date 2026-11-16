/**
 * 채용 목록 주소를 경로로 쓴다.
 *
 * 예전에는 /jobs?region=서울특별시&hire=국가&page=2 처럼 물음표 뒤에
 * 붙였다. 검색엔진은 물음표 뒤를 같은 쪽의 변형으로 보는 일이 잦아서,
 * 지역별·구분별 목록이 따로 색인되지 않는다. 경로로 쓰면 각각이 독립된
 * 쪽이 된다.
 *
 *   /jobs
 *   /jobs/page/2
 *   /jobs/region/서울특별시
 *   /jobs/region/서울특별시/page/2
 *   /jobs/region/서울특별시/hire/국가
 *   /jobs/hire/교육
 *   /jobs/org/법무부/page/3
 *   /jobs/status/open
 *   /jobs/q/방호
 *
 * 조각은 언제나 <이름>/<값> 짝이다. 짝이 안 맞거나 모르는 이름이 오면
 * 400 대신 404 를 낸다 — 없는 쪽이니 없다고 하는 게 맞다.
 *
 * 같은 내용이 두 주소로 나오면 안 되므로 순서를 하나로 못 박는다
 * (org → region → hire → type → grade → field → kind → status → sort → q → page). 다른 순서로 들어오면
 * 정한 순서로 넘긴다(301).
 */
import { JOB_FIELDS, JOB_GRADES, JOB_TYPES } from "./jobClass";

export type JobRoute = {
  org?: string;
  region?: string;
  hire?: string;
  /** 고용 형태·급수·직무(lib/jobClass, 2026-11-15). /jobs/type/임기제 · /jobs/grade/7급 · /jobs/field/전산·IT */
  type?: string;
  grade?: string;
  field?: string;
  /** 합격자·시험 일정 공고만(2026-11-16, lib/jobClass isResultNotice). 비우면 채용 공고만. 경로로는 kind/result. */
  kind?: "result";
  /** 접수 중만 보기. 경로로는 status/open. */
  open?: boolean;
  /** 정렬. 비우면 마감 임박순(접수 중 → 예정 → 마감). "new" 는 최신 등록순. 경로로는 sort/new. */
  sort?: "new";
  q?: string;
  /** 1부터. 1쪽은 주소에 적지 않는다. */
  page: number;
};

export const JOBS_BASE = "/jobs";

/**
 * 한 쪽에 보여 줄 공고 수. 주소를 만들 때도 쪽 수를 세야 해서 여기 둔다.
 * 2026-11-15 40 → 20. 휴대폰에서 카드를 세 줄로 줄여도 40건이면 화면 여섯 장이 넘었다. 쪽 수가 늘 뿐
 * 예전 쪽 번호(/jobs/page/N)는 모두 그대로 있으니 색인된 주소가 404 가 되지 않는다. 사이트맵은 쪽 번호를 싣지 않는다.
 */
export const PER_PAGE = 20;

const dec = (s: string) => {
  try {
    return decodeURIComponent(s).trim();
  } catch {
    return s.trim();
  }
};

/**
 * 경로 조각을 읽는다. 읽을 수 없으면 null — 부르는 쪽이 notFound() 한다.
 *
 * 값이 빈 문자열이거나 같은 이름이 두 번 나오면 못 읽은 것으로 친다.
 * 그런 주소를 200 으로 받아 주면 같은 목록이 여러 주소로 색인된다.
 */
export function parseJobPath(segs: string[]): JobRoute | null {
  const r: JobRoute = { page: 1 };
  if (segs.length % 2 !== 0) return null;

  for (let i = 0; i < segs.length; i += 2) {
    const key = segs[i];
    const val = dec(segs[i + 1]);
    if (!val) return null;

    switch (key) {
      case "org":
        if (r.org) return null;
        r.org = val;
        break;
      case "region":
        if (r.region) return null;
        r.region = val;
        break;
      // 여럿 고르기(2026-11-15): 값을 쉼표로 잇는다(/jobs/field/행정·사무,전산·IT). 같은 줄 안은 "또는".
      case "hire":
        if (r.hire || !multiOk(val)) return null;
        r.hire = val;
        break;
      // 정해 둔 값만 받는다. 아무 말이나 받으면 같은 빈 목록이 주소마다 생긴다.
      case "type":
        if (r.type || !multiOk(val, JOB_TYPES.map((t) => t.v))) return null;
        r.type = val;
        break;
      case "grade":
        if (r.grade || !multiOk(val, JOB_GRADES)) return null;
        r.grade = val;
        break;
      case "field":
        if (r.field || !multiOk(val, JOB_FIELDS)) return null;
        r.field = val;
        break;
      case "kind":
        if (val !== "result" || r.kind) return null;
        r.kind = "result";
        break;
      case "sort":
        if (val !== "new" || r.sort) return null;
        r.sort = "new";
        break;
      case "q":
        if (r.q) return null;
        r.q = val.slice(0, 60);
        break;
      case "status":
        // 지금은 open 하나뿐이다. closed 는 두지 않는다 — 끝난 공고만
        // 모아 보여 주는 쪽은 사람에게도 검색엔진에도 쓸모가 없다.
        if (val !== "open" || r.open) return null;
        r.open = true;
        break;
      case "page": {
        const n = Number(val);
        // 1쪽은 /jobs 가 정본이라 /jobs/page/1 로는 들어올 수 없다.
        if (!/^\d+$/.test(val) || n < 2 || n > 999) return null;
        r.page = n;
        break;
      }
      default:
        return null;
    }
  }
  return r;
}

/** 쉼표로 이은 값을 나눈다. 고르기 줄 하나에 여럿을 고른 것. */
export const multi = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
/** 값이 겹치지 않고, 정해 둔 목록이 있으면 그 안에 있나. 열 개 넘게는 받지 않는다. */
function multiOk(v: string, allowed?: string[]) {
  const vs = multi(v);
  return vs.length > 0 && vs.length <= 10 && new Set(vs).size === vs.length && (!allowed || vs.every((x) => allowed.includes(x)));
}
/** 같은 고르기를 한 주소로: 정해 둔 목록 순서(없으면 가나다)로 늘어놓는다. */
function multiNorm(v: string | undefined, order?: string[]) {
  const vs = Array.from(new Set(multi(v)));
  if (!vs.length) return undefined;
  return vs.sort((a, b) => (order ? order.indexOf(a) - order.indexOf(b) : a.localeCompare(b, "ko"))).join(",");
}

/** 정한 순서대로 주소를 만든다. 이게 정본(canonical)이다. */
export function jobPath(r: JobRoute): string {
  const p: string[] = [];
  const add = (k: string, v?: string) => {
    if (v) p.push(k, encodeURIComponent(v));
  };
  add("org", r.org);
  add("region", r.region);
  add("hire", multiNorm(r.hire));
  add("type", multiNorm(r.type, JOB_TYPES.map((t) => t.v)));
  add("grade", multiNorm(r.grade, JOB_GRADES));
  add("field", multiNorm(r.field, JOB_FIELDS));
  if (r.kind === "result") p.push("kind", "result");
  if (r.open) p.push("status", "open");
  if (r.sort === "new") p.push("sort", "new");
  add("q", r.q);
  if (r.page > 1) p.push("page", String(r.page));
  return p.length ? `${JOBS_BASE}/${p.join("/")}` : JOBS_BASE;
}

/** 조각 하나를 바꾼 주소. 쪽 번호는 1로 되돌린다. */
export function jobPathWith(r: JobRoute, patch: Partial<JobRoute>): string {
  return jobPath({ ...r, ...patch, page: patch.page ?? 1 });
}

/** 쪽만 옮긴 주소. */
export function jobPathPage(r: JobRoute, page: number): string {
  return jobPath({ ...r, page });
}

/**
 * 색인해도 되는 쪽인가.
 *
 * 검색어(q)로 만든 쪽은 주소가 무한히 생긴다. 그런 것을 색인시키면
 * 알맹이 없는 쪽 수천 개로 사이트 평가가 깎인다. 링크는 따라가되
 * 색인은 하지 말라고 한다.
 *
 * 2026-10-17 조건을 둘 이상 겹친 쪽(기관+지역, 기관+구분, 지역+구분)과 접수 중만 보기(status/open)도
 * 같은 이유로 색인하지 않는다. 서치 콘솔에서 사이트 거의 전체가 색인에서 빠졌고, 겹친 조건 쪽은
 * 한 조건 쪽 목록의 일부를 다시 보여 주는 것이라 거의 같은 쪽이 수천 개 생긴다. 조건 하나짜리
 * 쪽과 2쪽 이후는 그대로 색인한다. 정본(jobCanonical)은 손대지 않는다.
 */
export function jobRobots(r: JobRoute) {
  // 2026-11-15 고용 형태·급수·직무도 한 조건으로 센다. "임기제 채용", "7급 채용" 하나짜리 쪽은 색인하고, 겹친 것은 하지 않는다.
  // 여럿 고른 줄(임기제,정규직)은 값 수만큼 센다 — 조합이라 색인하지 않는다. 정렬만 바꾼 쪽도 같은 목록이라 색인하지 않는다.
  const filters = (r.org ? 1 : 0) + (r.region ? 1 : 0) + [r.hire, r.type, r.grade, r.field].reduce((n, v) => n + multi(v).length, 0);
  // 합격자·일정 공고 쪽(kind/result)은 지원할 곳을 찾는 검색에 내보낼 것이 아니라 색인하지 않는다.
  return r.q || r.open || r.sort || r.kind || filters >= 2 ? { index: false, follow: true } : { index: true, follow: true };
}

/**
 * 정본 주소. 접수 중만 보기·정렬 바꾸기는 같은 목록을 달리 보여 주는 것이라, 스스로를
 * 정본이라 하지 않고 그것을 뺀 쪽을 가리킨다.
 */
export function jobCanonical(r: JobRoute): string {
  return jobPath({ ...r, open: false, sort: undefined });
}

/** 화면 맨 위에 적을 조건 이름. */
export function jobRouteLabel(r: JobRoute): string[] {
  return [
    r.org,
    r.region,
    ...[r.hire, r.type, r.grade, r.field].map((v) => multi(v).join("·") || undefined),
    r.kind === "result" ? "합격자·일정 공고" : undefined,
    r.open ? "접수 중만" : undefined,
    // 연관어를 끈 검색어는 이미 따옴표로 감싸여 있다("홍보"). 겹치지 않게 벗기고 한 번만 씌운다.
    r.q ? `"${r.q.replace(/["“”'‘’]/g, "")}"` : undefined,
  ].filter((v): v is string => Boolean(v));
}

/**
 * 경로 조각을 읽는다. 못 읽으면 null — 부르는 쪽이 notFound() 한다.
 *
 * 라우트 파일마다 자기 앞머리(prefix)를 넘겨준다 — /jobs/region/… 을 받는
 * 파일은 ["region"] 을 준다. Next 가 주는 조각에는 그 앞머리가 빠져 있다.
 */
export function readJobRoute(prefix: string[], seg: string[] = []): JobRoute | null {
  return parseJobPath([...prefix, ...seg]);
}

/**
 * generateMetadata 전용. 못 읽어도 빈 조건을 준다.
 *
 * 제목 하나 때문에 던지지 않는다. 없는 주소인지 아닌지는 미들웨어와 본문
 * 컴포넌트가 이미 가린다.
 */
export function peekJobRoute(prefix: string[], seg: string[] = []): JobRoute {
  return readJobRoute(prefix, seg) ?? { page: 1 };
}

/** 미들웨어가 쓰는 이름표. 이 이름으로 시작하는 경로만 손댄다. */
export const JOB_KEYS = ["org", "region", "hire", "type", "grade", "field", "kind", "status", "sort", "q", "page"] as const;

/**
 * 들어온 그대로의 경로를 정본과 견주려고 다시 쓴 것.
 * 값만 다시 인코딩한다 — 이름 조각은 아스키라 손댈 것이 없다.
 */
export function jobPathAsGiven(segs: string[]): string {
  return segs.length
    ? `${JOBS_BASE}/${segs.map((s, i) => (i % 2 ? encodeURIComponent(dec(s)) : s)).join("/")}`
    : JOBS_BASE;
}
