import Link from "next/link";
import { SIDO_SHORT } from "@/lib/geo";
import { STATUS_LABEL } from "@/lib/consts";
import { dot, exactQuery, facets, filterJobs, isExactQuery, jobTermsUsed, unquoteQuery, type Job, type JobBoard } from "@/lib/pubJobs";
import MyRegionJobs from "./MyRegionJobs";
import OrgMark from "./OrgMark";
import { IllusEmpty } from "./Illus";
import RecentStrip from "./RecentStrip";
import { jobPath, jobPathPage, jobPathWith, jobRobots, PER_PAGE, type JobRoute } from "@/lib/jobRoute";
import { JOB_TYPES, classifyJob } from "@/lib/jobClass";

const BADGE: Record<string, string> = {
  ongoing: "badge-open", always: "badge-open", upcoming: "badge-soon", closed: "badge-closed",
};

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const todayKst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
const dayNo = (ymd: string) => Math.floor(Date.parse(`${ymd.slice(0, 10)}T00:00:00Z`) / 86400_000);

/**
 * 지원하려는 사람에게 가장 먼저 필요한 것은 "며칠 남았나"다(2026-11-15).
 * 전에는 모든 카드에 같은 "진행 중" 딱지가 붙고 마감일은 맨 아래 작은 회색 글씨였다.
 * 남은 날을 맨 앞 딱지로 올린다: 오늘 마감·D-3 까지는 빨강, 그 뒤는 보통, 마감·접수 예정은 제 색.
 * 목록 쪽은 캐시되므로 날짜가 바뀐 직후에는 하루 어긋날 수 있다(다음 갱신에서 맞는다).
 */
function dday(j: Job, today: string): { t: string; cls: string } | null {
  if (j.status === "closed") return { t: "마감", cls: "badge-closed" };
  if (j.status === "upcoming") return { t: "접수 예정", cls: "badge-soon" };
  if (!j.end) return j.start ? { t: "접수 중", cls: "badge-open" } : null;
  const d = dayNo(j.end) - dayNo(today);
  if (d < 0) return { t: "마감", cls: "badge-closed" };
  if (d === 0) return { t: "오늘 마감", cls: "badge-hot" };
  return { t: `D-${d}`, cls: d <= 3 ? "badge-hot" : "badge-open" };
}

/** "11.15(일)" */
function shortDay(ymd: string) {
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()}(${WD[d.getUTCDay()]})`;
}

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
  const filter = { q: route.q, region: route.region, hire: route.hire, open: route.open, type: route.type, grade: route.grade, field: route.field };
  const { regions, hires, openN, noRegionN, types, grades, fields } = facets(board.jobs, filter);
  const list = filterJobs(board.jobs, filter);
  const last = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const cur = Math.min(Math.max(1, route.page), last);
  const shown = list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);
  const filtered = Boolean(route.q || route.region || route.hire || route.open || route.type || route.grade || route.field);

  /**
   * 거르기 표(2026-11-15). 채용 사이트(사람인·잡코리아·나라일터)처럼 왼쪽에 항목 이름, 오른쪽에 고를 것을 한 줄씩.
   * 같은 줄 안에서는 하나만 고르고, 다시 누르면 풀린다. 숫자는 다른 조건을 건 채로 그것을 고르면 남는 공고 수(lib/pubJobs facets).
   * 조건을 둘 이상 겹친 쪽은 색인하지 않으므로(jobRobots) 그런 링크에는 nofollow 를 단다 — 검색 로봇이 조합을 끝없이 훑지 않게.
   */
  const pick = (patch: Partial<JobRoute>) => {
    const next = { ...route, ...patch, page: 1 };
    return { href: jobPath(next), rel: jobRobots(next).index ? undefined : "nofollow" };
  };
  type Opt = { t: string; n: number; on: boolean; title?: string } & ReturnType<typeof pick>;
  /** 고른 값은 숫자가 0이어도(다른 조건과 겹치는 것이 없어도) 남겨 둬야 풀 수 있다. */
  const opts = (vals: { v: string; n: number }[], sel: string | undefined, key: "hire" | "type" | "grade" | "field", desc?: (v: string) => string | undefined): Opt[] => {
    const all = sel && !vals.some((x) => x.v === sel) ? [...vals, { v: sel, n: 0 }] : vals;
    return all.map((x) => {
      const patch: Partial<JobRoute> = {};
      patch[key] = sel === x.v ? undefined : x.v;
      return { t: x.v, n: x.n, on: sel === x.v, title: desc?.(x.v), ...pick(patch) };
    });
  };
  const rows: { label: string; items: Opt[] }[] = [
    { label: "접수", items: [{ t: "접수 중만", n: openN, on: Boolean(route.open), ...pick({ open: !route.open }) }] },
    { label: "고용 형태", items: opts(types, route.type, "type", (v) => JOB_TYPES.find((t) => t.v === v)?.desc) },
    { label: "직무", items: opts(fields, route.field, "field") },
    { label: "급수", items: opts(grades, route.grade, "grade", (v) => (v.startsWith("임기제") ? "임기제 공무원 등급. 가급이 가장 높고 마급이 가장 낮습니다." : "공무원·임기제 자리의 급수")) },
    { label: "기관 구분", items: opts(hires.slice(0, 6), route.hire, "hire") },
  ];
  // 지역 칩은 전체 목록에서만 뜻이 있다. 지역별·기관별 쪽에서는 이미
  // 좁혀져 있어 눌러 봐야 갈 데가 없다.
  const showRegions = !route.region && !route.org && (regions.length > 0 || noRegionN > 0);
  // "경비" 로 찾았는데 경호·보안 공고가 같이 나왔으면 그 사실을 적는다.
  const also = route.q ? jobTermsUsed(list, route.q) : [];
  const today = todayKst();
  const exact = isExactQuery(route.q);

  return (
    <div id="list" className="mt-6 scroll-mt-24">
      <RecentStrip kind="job" className="mb-6" />
      {/* 검색 조건 영역(2026-11-15): 검색어 · 거르기(접수 상태·구분·지역) · 걸린 조건 · 연관어 켜기/끄기를 한 칸에 모은다.
          전에는 검색창·칩·지역·조건 줄이 따로 흩어져 있어 "지금 무엇으로 찾고 있나"가 한눈에 안 보였다. */}
      <section aria-labelledby="jobs-cond" className="card p-4 sm:p-5">
      <h2 id="jobs-cond" className="text-[13px] font-bold text-muted">검색 조건</h2>
      {/* 찾기를 누르면 쪽이 새로 그려진다. 머리 띠를 지나 목록으로 돌아오게 #list. */}
      <form action="/jobs/search#list" method="get" role="search" className="mt-2 flex gap-2">
        {route.region && <input type="hidden" name="region" value={route.region} />}
        {route.org && <input type="hidden" name="org" value={route.org} />}
        {route.hire && <input type="hidden" name="hire" value={route.hire} />}
        {route.type && <input type="hidden" name="type" value={route.type} />}
        {route.grade && <input type="hidden" name="grade" value={route.grade} />}
        {route.field && <input type="hidden" name="field" value={route.field} />}
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

      {/* 휴대폰은 줄마다 옆으로 밀어 본다(줄이 열 칸 넘게 쌓이면 공고가 화면 밖으로 밀린다). 넓은 화면은 줄바꿈. */}
      <div className="mt-4 overflow-hidden rounded-card border border-line" role="group" aria-label="거르기">
        {rows.filter((r) => r.items.length > 0).map((r) => (
          <div key={r.label} className="flex border-b border-line last:border-b-0">
            <span className="flex w-[4.5rem] shrink-0 items-center bg-ground px-3 text-[12.5px] font-bold text-ink2 sm:w-24">{r.label}</span>
            <div role="list" aria-label={r.label}
                 className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-2.5 py-2 [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden">
              {r.items.map((i) => (
                <Link key={i.t} role="listitem" href={i.href} rel={i.rel} title={i.title} aria-current={i.on ? "true" : undefined}
                      className={`chip shrink-0 !py-1 !text-[13px] ${i.on ? "chip-on" : ""}`}>
                  {i.t} <span className="num text-[12px] opacity-70">{i.n}</span>
                </Link>
              ))}
            </div>
          </div>
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
            route.q && { t: `"${unquoteQuery(route.q)}"${exact ? " · 연관어 끔" : ""}`, href: jobPathWith(route, { q: undefined }) },
            route.region && !route.org && { t: route.region, href: jobPathWith(route, { region: undefined }) },
            route.hire && { t: route.hire, href: jobPathWith(route, { hire: undefined }) },
            route.type && { t: route.type, href: jobPathWith(route, { type: undefined }) },
            route.field && { t: route.field, href: jobPathWith(route, { field: undefined }) },
            route.grade && { t: route.grade, href: jobPathWith(route, { grade: undefined }) },
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
          {/* 연관어 끄기: 그 말이 들어간 공고만. 낱말을 따옴표로 감싼 주소로 간다(lib/jobFilter). */}
          <Link href={jobPathWith(route, { q: exactQuery(route.q), page: 1 })}
                className="ml-1 rounded-pill border border-line2 bg-white px-2.5 py-1 font-semibold text-ink2 hover:border-brand hover:text-brand">
            연관어 빼고 ‘{unquoteQuery(route.q)}’만 보기
          </Link>
        </p>
      )}
      {exact && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <span>‘{unquoteQuery(route.q)}’가 들어간 공고만 보고 있습니다(연관어 끔).</span>
          <Link href={jobPathWith(route, { q: unquoteQuery(route.q), page: 1 })}
                className="rounded-pill border border-line2 bg-white px-2.5 py-1 font-semibold text-ink2 hover:border-brand hover:text-brand">
            연관어도 함께 찾기
          </Link>
        </p>
      )}
      </section>

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
          {shown.map((j) => {
            const dd = dday(j, today);
            const isNew = Boolean(j.reg) && dayNo(today) - dayNo(j.reg!) <= 2 && j.status !== "closed";
            const cls = classifyJob(j);
            return (
              <li key={j.id}>
                {/* 공고마다 우리 쪽 상세 페이지를 둔다. 나라일터는 원문 주소를
                    안 주는 공고가 많아 예전에는 눌러도 아무 일이 없었다.
                    2026-11-15: 카드 한 장을 article 로, 제목을 h3 로. 맨 앞은 남은 날, 마감일은 요일까지 또렷하게. */}
                <article className="card card-link flex gap-3.5 p-4 sm:p-5">
                  <OrgMark org={j.org} hire={j.hire} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      {dd ? <span className={`num badge ${dd.cls}`}>{dd.t}</span>
                          : (j.start || j.end) && <span className={`badge ${BADGE[j.status]}`}>{STATUS_LABEL[j.status]}</span>}
                      {isNew && <span className="badge badge-new">새 공고</span>}
                      {/* 고용 형태·급수를 먼저(지원 여부를 가르는 것). 기관 구분은 그 뒤. */}
                      {cls.types.slice(0, 2).map((t) => <span key={t} className="badge badge-quiet font-bold text-ink2">{t}</span>)}
                      {cls.grades[0] && <span className="badge badge-quiet">{cls.grades.length > 1 ? `${cls.grades[0]} 외` : cls.grades[0]}</span>}
                      {j.hire && <span className="badge badge-quiet">{j.hire}</span>}
                      {j.recruit && <span className="badge badge-quiet">{j.recruit.replace(/\s*외\s*\d+$/, " 등")}</span>}
                      {j.headcount && <span className="num badge badge-quiet">{j.headcount}명</span>}
                    </p>
                    <h3 className="mt-2 text-[15.5px] font-bold leading-snug">
                      {/* after: 카드 전체가 눌린다. 링크 글자는 제목 그대로라 읽어 주는 기기에도 뜻이 통한다. */}
                      <Link href={`/jobs/${encodeURIComponent(j.id)}`} className="after:absolute after:inset-0 after:content-[''] hover:text-brand">
                        {j.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-[13px] text-muted">
                      {[j.org, j.region, j.sectors].filter(Boolean).join(" · ")}
                    </p>
                    <p className="num mt-1.5 flex flex-wrap items-baseline gap-x-2 text-[13px]">
                      {j.end ? (
                        <span className={dd?.cls === "badge-hot" ? "font-bold text-alert" : "font-semibold text-ink2"}>
                          <time dateTime={j.end}>{shortDay(j.end)}</time> 마감
                        </span>
                      ) : (
                        <span className="text-muted">마감일은 공고문에서 확인</span>
                      )}
                      {/* 잡알리오는 접수 시작일을 주지 않아 시작 칸이 등록일이다. 등록일만 적는다. */}
                      {j.reg && <span className="text-xs text-faint"><time dateTime={j.reg}>{dot(j.reg)}</time> 등록</span>}
                      {j.id.startsWith("a") && <span className="text-xs text-faint">잡알리오</span>}
                    </p>
                  </div>
                </article>
              </li>
            );
          })}
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
