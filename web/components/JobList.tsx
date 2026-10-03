import Link from "next/link";
import { SIDO_SHORT } from "@/lib/geo";
import { STATUS_LABEL } from "@/lib/consts";
import { dot, facets, filterJobs, jobTermsUsed, type JobBoard } from "@/lib/pubJobs";
import MyRegionJobs from "./MyRegionJobs";
import OrgMark from "./OrgMark";
import { IllusEmpty } from "./Illus";
import RecentStrip from "./RecentStrip";
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
          공고 목록을 새로 정리하는 중입니다.
          <br />
          잠시 뒤 다시 들어오시면 보입니다. 급하시면 나라일터에서 바로 보셔도 됩니다.
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
  const { regions, hires, openN, noRegionN } = facets(board.jobs, filter);
  const list = filterJobs(board.jobs, filter);
  const last = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const cur = Math.min(Math.max(1, route.page), last);
  const shown = list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);
  const filtered = Boolean(route.q || route.region || route.hire || route.open);
  // 지역 칩은 전체 목록에서만 뜻이 있다. 지역별·기관별 쪽에서는 이미
  // 좁혀져 있어 눌러 봐야 갈 데가 없다.
  const showRegions = !route.region && !route.org && (regions.length > 0 || noRegionN > 0);
  // "경비" 로 찾았는데 경호·보안 공고가 같이 나왔으면 그 사실을 적는다.
  const also = route.q ? jobTermsUsed(list, route.q) : [];

  return (
    <div id="list" className="mt-6 scroll-mt-24">
      <RecentStrip kind="job" className="mb-6" />
      {/* 찾기를 누르면 쪽이 새로 그려진다. 머리 띠를 지나 목록으로 돌아오게 #list. */}
      <form action="/jobs/search#list" method="get" className="flex gap-2">
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
          접수 중만 <span className="num text-[12px] opacity-70">{openN}</span>
        </Link>
        {hires.slice(0, 6).map((h) => (
          <Link key={h.v} href={jobPathWith(route, { hire: route.hire === h.v ? undefined : h.v })}
                className={`chip ${route.hire === h.v ? "chip-on" : ""}`}>
            {h.v} <span className="num text-[12px] opacity-70">{h.n}</span>
          </Link>
        ))}
      </div>
      {/* 지역은 거르기(필터)다. 열일곱 줄이 결과 앞에 깔려 있으면 공고가 화면 밖으로 밀려난다.
          접어 두고 펼치면 칸으로. 자바스크립트 없이 details 로 — 링크는 접혀 있어도 문서에 있다. */}
      {showRegions && (
        <details className="group mt-3 rounded-card border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-[13.5px] [&::-webkit-details-marker]:hidden">
            <span className="font-bold text-ink2">지역별 보기</span>
            <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-muted">
              <span className="truncate">{regions.slice(0, 3).map((r) => SIDO_SHORT[r.v] ?? r.v).join(" · ")}{regions.length > 3 && ` 외 ${regions.length - 3}곳`}</span>
              <span className="shrink-0 font-semibold text-brand group-open:hidden">더보기</span>
              <span className="hidden shrink-0 font-semibold text-brand group-open:inline">접기</span>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m5 8 5 5 5-5" /></svg>
            </span>
          </summary>
          <div className="border-t border-line px-3 pb-3 pt-2.5">
            <MyRegionJobs current={route.region} />
            <ul className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-6">
              {regions.slice(0, 20).map((r) => (
                <li key={r.v}>
                  <Link href={jobPathWith(route, { region: r.v })} title={r.v}
                        className="flex items-center justify-between gap-1 rounded-lg bg-ground px-2.5 py-2 text-[13px] text-ink2 transition-colors hover:text-brand">
                    <span className="truncate">{SIDO_SHORT[r.v] ?? r.v}</span>
                    <span className="num shrink-0 text-[12px] text-faint">{r.n}</span>
                  </Link>
                </li>
              ))}
              {noRegionN > 0 && (
                <li className="flex items-center justify-between gap-1 rounded-lg px-2.5 py-2 text-[13px] text-faint"
                    title="공고에 근무 지역이 적혀 있지 않은 것. 중앙부처 공고가 대부분입니다.">
                  <span className="truncate">미표기</span><span className="num shrink-0 text-[12px]">{noRegionN}</span>
                </li>
              )}
            </ul>
          </div>
        </details>
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
      {also.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted">
          <span>연관어도 함께 찾았습니다 —</span>
          {also.map((t) => (
            <Link key={t} href={jobPathWith(route, { q: t, page: 1 })}
                  className="font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">
              {t}
            </Link>
          ))}
        </p>
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
          <div className="mx-auto h-28 w-40"><IllusEmpty /></div>
          <p className="mt-2 leading-relaxed text-muted">조건에 맞는 공고가 없습니다.</p>
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
              <Link href={`/jobs/${encodeURIComponent(j.id)}`} className="card card-link flex gap-3.5 p-4 sm:p-5">
                <OrgMark org={j.org} hire={j.hire} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {(j.start || j.end) && <span className={`badge ${BADGE[j.status]}`}>{STATUS_LABEL[j.status]}</span>}
                    {j.reg && <span className="num badge badge-quiet">{dot(j.reg)} 등록</span>}
                    {j.hire && <span className="badge badge-quiet">{j.hire}</span>}
                    {j.recruit && <span className="badge badge-quiet">{j.recruit}</span>}
                  </span>
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
                </span>
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
