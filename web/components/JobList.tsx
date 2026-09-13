import Link from "next/link";
import { STATUS_LABEL } from "@/lib/db";
import { dot, facets, filterJobs, type JobBoard } from "@/lib/pubJobs";
import { jobPath, jobPathPage, jobPathWith, PER_PAGE, type JobRoute } from "@/lib/jobRoute";

const BADGE: Record<string, string> = {
  ongoing: "badge-open", always: "badge-open", upcoming: "badge-soon", closed: "badge-closed",
};

/**
 * 1 … 4 5 [6] 7 8 … 20 처럼 쪽 번호를 추린다. 3,000건이면 75쪽이라
 * 전부 늘어놓을 수 없다.
 */
function pageNums(cur: number, last: number) {
  const want = new Set([1, last, cur - 1, cur, cur + 1]);
  const ns = [...want].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  ns.forEach((n, i) => {
    if (i && n - ns[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

/**
 * 채용 공고 목록과 거르기.
 *
 * 걸러 주는 값은 데이터에서 뽑는다. 없는 지역을 칩으로 늘어놓으면 눌러도
 * 빈 화면만 나온다.
 *
 * 링크는 전부 경로다(/jobs/region/서울특별시/page/2). 검색 상자만은
 * 자바스크립트 없이 돌아야 해서 GET 폼으로 ?q= 를 보내는데, 받는 쪽
 * /jobs/search 가 곧바로 경로 주소로 넘긴다. 그래서 사람 눈에 남는
 * 주소에는 물음표가 없다.
 */
export default function JobList({ board, route }: { board: JobBoard; route: JobRoute }) {
  if (!board.ok) {
    return (
      <div className="card mt-6 p-8 text-center">
        <p className="leading-relaxed text-muted">
          지금은 채용 정보를 불러오지 못했습니다.
          <br />
          공공데이터 쪽이 잠시 응답하지 않는 경우가 있어, 잠시 뒤 다시 들어오시면 보입니다.
        </p>
        <a href="https://www.gojobs.go.kr" target="_blank" rel="noopener noreferrer"
           className="btn btn-ghost mt-5">
          나라일터에서 직접 보기
        </a>
      </div>
    );
  }

  // 목록 자체를 이미 기관·지역으로 좁혀 받은 경우가 있다. 그때 같은
  // 조건을 한 번 더 거는 것은 값이 없지만, 걸어도 결과는 같다.
  const filter = { q: route.q, region: route.region, hire: route.hire, open: route.open };
  const { regions, hires, openN } = facets(board.jobs, filter);
  const list = filterJobs(board.jobs, filter);
  const last = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const cur = Math.min(Math.max(1, route.page), last);
  const shown = list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);
  const filtered = Boolean(route.q || route.region || route.hire || route.open);
  // 지역 칩은 전체 목록에서만 뜻이 있다. 지역별·기관별 쪽에서는 이미
  // 좁혀져 있어 눌러 봐야 갈 데가 없다.
  const showRegions = !route.region && !route.org && regions.length > 0;

  return (
    <div className="mt-6">
      <form action="/jobs/search" method="get" className="flex gap-2">
        {route.region && <input type="hidden" name="region" value={route.region} />}
        {route.org && <input type="hidden" name="org" value={route.org} />}
        {route.hire && <input type="hidden" name="hire" value={route.hire} />}
        {route.open && <input type="hidden" name="open" value="1" />}
        <input
          name="q"
          defaultValue={route.q ?? ""}
          placeholder="기관명·공고명·분야로 찾기"
          className="field min-w-0 flex-1"
          aria-label="채용 공고 검색어"
        />
        <button type="submit" className="btn btn-primary shrink-0 px-5 py-2.5">찾기</button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={jobPathWith(route, { open: !route.open })}
              className={`chip ${route.open ? "chip-on" : ""}`}>
          접수 중만 <span className="num text-[11.5px] opacity-70">{openN}</span>
        </Link>
        {hires.slice(0, 6).map((h) => (
          <Link key={h.v} href={jobPathWith(route, { hire: route.hire === h.v ? undefined : h.v })}
                className={`chip ${route.hire === h.v ? "chip-on" : ""}`}>
            {h.v} <span className="num text-[11.5px] opacity-70">{h.n}</span>
          </Link>
        ))}
      </div>
      {showRegions && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[13px]">
          {regions.slice(0, 20).map((r) => (
            <Link key={r.v} href={jobPathWith(route, { region: r.v })}
                  className="text-muted transition-colors hover:text-brand">
              {r.v}<span className="num ml-1 text-[11px] text-faint">{r.n}</span>
            </Link>
          ))}
        </div>
      )}

      {filtered && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted">걸린 조건</span>
          {[
            route.q && { t: `"${route.q}"`, href: jobPathWith(route, { q: undefined }) },
            route.region && !route.org && { t: route.region, href: jobPathWith(route, { region: undefined }) },
            route.hire && { t: route.hire, href: jobPathWith(route, { hire: undefined }) },
            route.open && { t: "접수 중만", href: jobPathWith(route, { open: false }) },
          ]
            .filter((x): x is { t: string; href: string } => Boolean(x))
            .map((x) => (
              <Link key={x.t} href={x.href}
                    className="rounded-pill bg-brandSoft px-2.5 py-1 font-semibold text-brand hover:opacity-80">
                {x.t} <span aria-hidden="true">×</span>
                <span className="sr-only">조건 지우기</span>
              </Link>
            ))}
          <Link href={jobPath({ org: route.org, page: 1 })}
                className="text-muted underline underline-offset-4 hover:text-brand">
            모두 지우기
          </Link>
        </div>
      )}

      <div className="mb-3 mt-8 flex items-baseline justify-between">
        <h2 className="text-[1.0625rem] font-bold">
          {filtered ? "조건에 맞는 공고" : board.jobs.some((j) => j.reg || j.end) ? "최근 공고" : "공고 목록"}
        </h2>
        <span className="num text-sm text-muted">
          {list.length.toLocaleString()}건{last > 1 && ` · ${cur}/${last}쪽`}
        </span>
      </div>

      {list.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="leading-relaxed text-muted">조건에 맞는 공고가 없습니다.</p>
          <Link href={jobPath({ org: route.org, page: 1 })} className="btn btn-ghost mt-5">
            조건 지우기
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {shown.map((j) => (
            <li key={j.id}>
              {/* 공고마다 우리 쪽 상세 페이지를 둔다. 나라일터는 원문 주소를
                  안 주는 공고가 많아 예전에는 눌러도 아무 일이 없었다. */}
              <Link href={`/jobs/${encodeURIComponent(j.id)}`} className="card card-link block p-5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(j.start || j.end) && <span className={`badge ${BADGE[j.status]}`}>{STATUS_LABEL[j.status]}</span>}
                  {j.reg && <span className="num badge badge-quiet">{dot(j.reg)} 등록</span>}
                  {j.hire && <span className="badge badge-quiet">{j.hire}</span>}
                  {j.recruit && <span className="badge badge-quiet">{j.recruit}</span>}
                </div>
                <b className="mt-2 block text-[15px] leading-snug">{j.title}</b>
                <span className="mt-1 block text-[13px] text-muted">
                  {[j.org, j.region, j.sectors, j.headcount && `${j.headcount}명`]
                    .filter(Boolean).join(" · ")}
                </span>
                {(j.start || j.end) && (
                  <span className="num mt-1.5 block text-xs text-muted">
                    접수 {dot(j.start) ?? "—"} ~ {dot(j.end) ?? "—"}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {last > 1 && (
        <nav aria-label="쪽 넘기기" className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
          {cur > 1 && (
            <Link href={jobPathPage(route, cur - 1)} rel="prev" className="chip px-3 py-1.5">이전</Link>
          )}
          {pageNums(cur, last).map((n, i) =>
            n === "gap" ? (
              <span key={`gap${i}`} className="px-1 text-faint">…</span>
            ) : n === cur ? (
              <span key={n} aria-current="page" className="num chip chip-on px-3 py-1.5">{n}</span>
            ) : (
              <Link key={n} href={jobPathPage(route, n)} className="num chip px-3 py-1.5">{n}</Link>
            ),
          )}
          {cur < last && (
            <Link href={jobPathPage(route, cur + 1)} rel="next" className="chip px-3 py-1.5">다음</Link>
          )}
        </nav>
      )}
    </div>
  );
}
