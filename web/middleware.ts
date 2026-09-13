import { NextResponse, type NextRequest } from "next/server";
import { JOB_KEYS, JOBS_BASE, jobPath, jobPathAsGiven, parseJobPath } from "@/lib/jobRoute";

/**
 * 채용 목록 주소를 정본 하나로 모은다.
 *
 * 이 일을 왜 쪽(page.tsx) 이 아니라 미들웨어에서 하나:
 * force-dynamic 인 쪽은 응답을 흘려보내며 그린다. 그래서 그 안에서
 * redirect()·notFound() 를 불러도 이미 나간 200 을 되돌리지 못한다.
 * 실제로 /jobs/status/closed 가 404 화면을 200 으로 내보냈다 — 검색엔진이
 * 보기에는 "내용 있는 쪽"이라 없는 주소가 색인된다.
 *
 * 미들웨어는 그리기 전에 돈다. 여기서는 진짜 308 과 진짜 404 를 낼 수 있다.
 *
 * 하는 일 셋:
 *  1. 옛 주소(/jobs?region=서울&page=2) → 경로 주소로 308
 *  2. 순서가 다른 주소(/jobs/hire/국가/region/서울) → 정한 순서로 308
 *  3. 말이 안 되는 주소(/jobs/status/closed, /jobs/page/0) → 404
 */
export const config = {
  matcher: ["/jobs", "/jobs/:path*"],
};

/** 쪽 이름이 아니라 그 자체로 뜻이 있는 경로. 손대지 않는다. */
const PASS = new Set(["region", "org", "majors", "overseas", "search"]);

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const rest = url.pathname.slice(JOBS_BASE.length).replace(/^\//, "");
  const segs = rest ? rest.split("/") : [];

  // /jobs/search?q=… — 폼이 보낸 것을 경로 주소로 바꿔 준다. GET 폼은
  // 물음표로만 보낼 수 있어서, 받는 즉시 여기서 넘긴다.
  if (segs.length === 1 && segs[0] === "search") {
    return NextResponse.redirect(new URL(fromQuery(url.searchParams), req.url), 308);
  }

  // /jobs — 옛 주소로 들어온 것만 넘긴다.
  if (segs.length === 0) {
    const to = fromQuery(url.searchParams);
    return to === JOBS_BASE ? undefined : NextResponse.redirect(new URL(to, req.url), 308);
  }

  // /jobs/303444(상세) · /jobs/region(목차) · /jobs/majors … 는 그대로.
  if (segs.length === 1) return undefined;
  if (!(JOB_KEYS as readonly string[]).includes(segs[0])) {
    return PASS.has(segs[0]) ? undefined : notFound(req);
  }

  const route = parseJobPath(segs);
  if (!route) return notFound(req);

  const canonical = jobPath(route);
  if (jobPathAsGiven(segs) !== canonical) {
    return NextResponse.redirect(new URL(canonical, req.url), 308);
  }
  return undefined;
}

const one = (v: string | null) => v?.trim() || undefined;

/** 옛 ?key=value 주소를 경로 주소로. */
function fromQuery(q: URLSearchParams) {
  const page = Number(one(q.get("page")) ?? 1);
  return jobPath({
    org: one(q.get("org")),
    region: one(q.get("region")),
    hire: one(q.get("hire")),
    open: one(q.get("open")) === "1",
    q: one(q.get("q")),
    page: Number.isInteger(page) && page > 1 ? page : 1,
  });
}

/**
 * 없는 주소라고 답한다.
 *
 * 미들웨어는 화면을 그릴 수 없으니, 어느 쪽에도 걸리지 않는 주소로 넘겨
 * Next 가 제 404 화면을 제 응답 코드로 내보내게 한다. 빈 404 를 그냥
 * 돌려주면 사람에게는 흰 화면만 남는다.
 */
function notFound(req: NextRequest) {
  return NextResponse.rewrite(new URL("/_jobs-not-found", req.url), { status: 404 });
}
