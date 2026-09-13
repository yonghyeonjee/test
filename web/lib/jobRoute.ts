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
 * (org → region → hire → status → q → page). 다른 순서로 들어오면
 * 정한 순서로 넘긴다(301).
 */

export type JobRoute = {
  org?: string;
  region?: string;
  hire?: string;
  /** 접수 중만 보기. 경로로는 status/open. */
  open?: boolean;
  q?: string;
  /** 1부터. 1쪽은 주소에 적지 않는다. */
  page: number;
};

export const JOBS_BASE = "/jobs";

/** 한 쪽에 보여 줄 공고 수. 주소를 만들 때도 쪽 수를 세야 해서 여기 둔다. */
export const PER_PAGE = 40;

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
      case "hire":
        if (r.hire) return null;
        r.hire = val;
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

/** 정한 순서대로 주소를 만든다. 이게 정본(canonical)이다. */
export function jobPath(r: JobRoute): string {
  const p: string[] = [];
  const add = (k: string, v?: string) => {
    if (v) p.push(k, encodeURIComponent(v));
  };
  add("org", r.org);
  add("region", r.region);
  add("hire", r.hire);
  if (r.open) p.push("status", "open");
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
 */
export function jobRobots(r: JobRoute) {
  return r.q ? { index: false, follow: true } : { index: true, follow: true };
}

/**
 * 정본 주소. 접수 중만 보기는 전체 목록과 거의 같은 내용이라, 스스로를
 * 정본이라 하지 않고 조건을 뺀 쪽을 가리킨다.
 */
export function jobCanonical(r: JobRoute): string {
  return jobPath(r.open ? { ...r, open: false } : r);
}

/** 화면 맨 위에 적을 조건 이름. */
export function jobRouteLabel(r: JobRoute): string[] {
  return [
    r.org,
    r.region,
    r.hire,
    r.open ? "접수 중만" : undefined,
    r.q ? `"${r.q}"` : undefined,
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
export const JOB_KEYS = ["org", "region", "hire", "status", "q", "page"] as const;

/**
 * 들어온 그대로의 경로를 정본과 견주려고 다시 쓴 것.
 * 값만 다시 인코딩한다 — 이름 조각은 아스키라 손댈 것이 없다.
 */
export function jobPathAsGiven(segs: string[]): string {
  return segs.length
    ? `${JOBS_BASE}/${segs.map((s, i) => (i % 2 ? encodeURIComponent(dec(s)) : s)).join("/")}`
    : JOBS_BASE;
}
