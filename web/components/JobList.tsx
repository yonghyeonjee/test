import Link from "next/link";
import { SIDO_SHORT } from "@/lib/geo";
import { STATUS_LABEL } from "@/lib/consts";
import { dot, exactQuery, facets, filterJobs, isExactQuery, jobTermsUsed, unquoteQuery, type Job, type JobBoard } from "@/lib/pubJobs";
import MyRegionJobs from "./MyRegionJobs";
import OrgMark from "./OrgMark";
import { IllusEmpty } from "./Illus";
import RecentStrip from "./RecentStrip";
import { jobPath, jobPathPage, jobPathWith, jobRobots, multi, PER_PAGE, type JobRoute } from "@/lib/jobRoute";
import { JOB_FIELDS, JOB_GRADES, JOB_TYPES, classifyJob } from "@/lib/jobClass";
import { sortNewest } from "@/lib/jobFilter";
import FilterMenu from "./FilterMenu";
import KeepScroll from "./KeepScroll";

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
  // 합격자·시험 일정 공고는 기본 목록에서 빼고 따로 본다(2026-11-16, kind/result). 목록 위 두 칸으로 오간다.
  const filter = { q: route.q, region: route.region, hire: route.hire, open: route.open, type: route.type, grade: route.grade, field: route.field, kind: route.kind ?? ("job" as const) };
  const { regions, hires, openN, noRegionN, types, grades, fields, jobN, resultN } = facets(board.jobs, filter);
  const matched = filterJobs(board.jobs, filter);
  /** 아직 끝나지 않은 합격자·일정 공고 — 채용이 진행 중이라는 표시. 채용 공고 칸 맨 위에 짧게 보여 준다. */
  const active = route.kind ? [] : filterJobs(board.jobs, { ...filter, kind: "result" }).filter((j) => j.status !== "closed");
  const list = route.sort === "new" ? sortNewest(matched) : matched;
  const last = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const cur = Math.min(Math.max(1, route.page), last);
  const shown = list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);
  const filtered = Boolean(route.q || route.region || route.hire || route.open || route.type || route.grade || route.field);

  /**
   * 거르기(2026-11-15 다시 짬). 처음에는 항목마다 칩을 한 줄씩 늘어놓은 표였는데, 휴대폰에서 줄마다 옆으로 밀어야 하고
   * 하나만 고를 수 있었다. 채용 사이트처럼 항목마다 단추를 두고(FilterMenu), 누르면 펼쳐지는 창에서 고른다.
   * 항목마다 맞는 방식이 다르다:
   *   고용 형태·직무·급수·기관 구분 — 여럿 고르기(체크 상자 + 적용). "임기제 또는 정규직"을 한 번에 보고 싶은 사람이 많다.
   *   지역 — 하나만(누르면 바로 간다). 지역 쪽은 따로 안내 글이 있는 쪽이라 둘을 섞지 않는다.
   *   접수 중만 — 켜고 끄는 스위치. 정렬 — 마감 임박순 / 최신 등록순 두 칸.
   * 창 안의 체크 상자는 폼이라 검색 로봇이 따라가지 않는다. 한 조건짜리 쪽(/jobs/type/임기제)으로 가는 길은 아래 "분류별로 보기" 링크가 맡는다.
   */
  const pick = (patch: Partial<JobRoute>) => {
    const next = { ...route, ...patch, page: 1 };
    return { href: jobPath(next), rel: jobRobots(next).index ? undefined : "nofollow" };
  };
  type Dim = "type" | "field" | "grade" | "hire";
  /** 고른 값은 숫자가 0이어도(다른 조건과 겹치는 것이 없어도) 남겨 둬야 풀 수 있다. */
  const optsOf = (vals: { v: string; n: number }[], dim: Dim, desc?: (v: string) => string | undefined) => {
    const sel = multi(route[dim]);
    const all = [...vals, ...sel.filter((s) => !vals.some((x) => x.v === s)).map((v) => ({ v, n: 0 }))];
    return all.map((x) => ({ v: x.v, n: x.n, on: sel.includes(x.v), desc: desc?.(x.v) }));
  };
  /** 창마다 폼이 따로라, 그 창이 다루지 않는 조건은 숨은 칸으로 함께 보낸다. */
  const hiddenOf = (except: string) =>
    ([
      ["org", route.org], ["region", route.region], ["hire", route.hire], ["type", route.type], ["grade", route.grade],
      ["field", route.field], ["kind", route.kind], ["open", route.open ? "1" : undefined], ["sort", route.sort], ["q", route.q],
    ] as [string, string | undefined][]).filter((e): e is [string, string] => e[0] !== except && Boolean(e[1]));
  /** 그 조건 하나만 건 주소(분류별로 보기). */
  const onlyPath = (d: Dim, v: string) => { const r: JobRoute = { page: 1 }; r[d] = v; return jobPath(r); };
  /** 한 줄(dim)의 값만 바꾼 주소. */
  const setDim = (d: Dim, v?: string) => { const p: Partial<JobRoute> = {}; p[d] = v; return jobPathWith(route, p); };
  const summary = (dim: Dim) => { const s = multi(route[dim]); return s.length ? (s.length > 1 ? `${s[0]} 외 ${s.length - 1}` : s[0]) : undefined; };
  const menus: { dim: Dim; label: string; opts: ReturnType<typeof optsOf> }[] = [
    { dim: "type", label: "고용 형태", opts: optsOf(types, "type", (v) => JOB_TYPES.find((t) => t.v === v)?.desc) },
    { dim: "field", label: "직무", opts: optsOf(fields, "field") },
    { dim: "grade", label: "급수", opts: optsOf(grades, "grade", (v) => (v.startsWith("임기제") ? "가급이 가장 높고 마급이 가장 낮습니다." : v === "4급 이상" ? "서기관 이상" : undefined)) },
    { dim: "hire", label: "기관 구분", opts: optsOf(hires.slice(0, 8), "hire") },
  ];
  // 기관별 쪽에서는 지역을 고를 까닭이 없다(기관 하나가 곧 지역이다).
  const showRegions = !route.org && (regions.length > 0 || noRegionN > 0 || Boolean(route.region));
  const chosen: { t: string; href: string }[] = [
    route.q && { t: `"${unquoteQuery(route.q)}"${isExactQuery(route.q) ? " · 연관어 끔" : ""}`, href: jobPathWith(route, { q: undefined }) },
    route.region && !route.org && { t: route.region, href: jobPathWith(route, { region: undefined }) },
    ...(["type", "field", "grade", "hire"] as Dim[]).flatMap((d) => {
      const s = multi(route[d]);
      return s.map((v) => ({ t: v, href: setDim(d, s.filter((x) => x !== v).join(",") || undefined) }));
    }),
  ].filter((x): x is { t: string; href: string } => Boolean(x));
  // "경비" 로 찾았는데 경호·보안 공고가 같이 나왔으면 그 사실을 적는다.
  const also = route.q ? jobTermsUsed(list, route.q) : [];
  const today = todayKst();
  const exact = isExactQuery(route.q);

  return (
    // 조건을 바꿔도 보던 자리를 지킨다(2026-11-16): 폼은 KeepScroll 이 쪽을 새로 열지 않고 보내고, 조건·정렬·칸 링크는 scroll={false}.
    // 전에는 검색하거나 조건을 하나 바꿀 때마다 화면이 맨 위로 튀었다. 쪽 넘기기만 원래대로 위로 간다.
    <KeepScroll id="list" className="mt-6 scroll-mt-24">
      <RecentStrip kind="job" className="mb-6" />
      {/* 검색 조건 영역(2026-11-15): 검색어 · 거르기(접수 상태·구분·지역) · 걸린 조건 · 연관어 켜기/끄기를 한 칸에 모은다.
          전에는 검색창·칩·지역·조건 줄이 따로 흩어져 있어 "지금 무엇으로 찾고 있나"가 한눈에 안 보였다. */}
      <section aria-labelledby="jobs-cond" className="card p-4 sm:p-5">
      <h2 id="jobs-cond" className="text-[13px] font-bold text-muted">검색 조건</h2>
      {/* 찾기를 누르면 쪽이 새로 그려진다. 머리 띠를 지나 목록으로 돌아오게 #list. */}
      <form action="/jobs/search#list" method="get" role="search" className="mt-2 flex gap-2">
        {hiddenOf("q").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input
          name="q"
          defaultValue={route.q ?? ""}
          placeholder="기관명·공고명·분야로 찾기"
          className="field min-w-0 flex-1"
          aria-label="채용 공고 검색어"
        />
        <button type="submit" className="btn btn-primary shrink-0 px-5 py-2.5">찾기</button>
      </form>

      {/* 거르기 단추 줄. 휴대폰은 옆으로 밀어 보고(펼침 창은 화면 아래에서 올라온다), 넓은 화면은 줄바꿈하고 창이 단추 아래에 뜬다. */}
      <div role="group" aria-label="거르기"
           className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        {showRegions && (
          <FilterMenu label="지역" value={route.region ? SIDO_SHORT[route.region] ?? route.region : undefined} active={Boolean(route.region)}>
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <b className="text-[15px]">지역</b>
              <span className="text-[12px] text-muted">하나를 누르면 바로 바뀝니다</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
              <MyRegionJobs current={route.region} />
              <ul className="mt-1.5 grid grid-cols-3 gap-1.5">
                <li>
                  <Link scroll={false} href={jobPathWith(route, { region: undefined })} aria-current={!route.region ? "true" : undefined}
                        className={`flex items-center justify-center rounded-lg px-2.5 py-2.5 text-[13.5px] font-semibold ${!route.region ? "bg-brand text-white" : "bg-ground text-ink2 hover:text-brand"}`}>
                    전국
                  </Link>
                </li>
                {regions.slice(0, 20).map((r) => (
                  <li key={r.v}>
                    <Link scroll={false} href={jobPathWith(route, { region: r.v })} title={r.v} rel={pick({ region: r.v }).rel}
                          aria-current={route.region === r.v ? "true" : undefined}
                          className={`flex items-center justify-between gap-1 rounded-lg px-2.5 py-2.5 text-[13.5px] transition-colors ${route.region === r.v ? "bg-brand font-bold text-white" : "bg-ground text-ink2 hover:text-brand"}`}>
                      <span className="truncate">{SIDO_SHORT[r.v] ?? r.v}</span>
                      <span className="num shrink-0 text-[12px] opacity-70">{r.n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {noRegionN > 0 && (
                <p className="mt-2 text-[12px] text-faint">근무 지역이 공고에 안 적힌 것 {noRegionN.toLocaleString()}건(중앙부처 공고가 대부분)은 지역을 고르면 빠집니다.</p>
              )}
            </div>
          </FilterMenu>
        )}
        {menus.filter((m) => m.opts.length > 0).map((m) => (
          <FilterMenu key={m.dim} label={m.label} value={summary(m.dim)} active={Boolean(route[m.dim])}>
            <form action="/jobs/search#list" method="get" className="flex min-h-0 flex-1 flex-col">
              {hiddenOf(m.dim).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <div className="flex items-center justify-between px-4 pb-2 pt-3">
                <b className="text-[15px]">{m.label}</b>
                <span className="text-[12px] text-muted">여럿 고를 수 있습니다</span>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
                {m.opts.map((o) => (
                  <li key={o.v}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 hover:bg-ground">
                      <input type="checkbox" name={m.dim} value={o.v} defaultChecked={o.on} className="h-[18px] w-[18px] shrink-0 accent-brand" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-semibold text-ink">{o.v}</span>
                        {o.desc && <span className="mt-0.5 block text-[12px] leading-snug text-muted">{o.desc}</span>}
                      </span>
                      <span className="num shrink-0 text-[12.5px] text-faint">{o.n.toLocaleString()}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex shrink-0 gap-2 border-t border-line p-3">
                <Link scroll={false} href={setDim(m.dim)} rel="nofollow" className="btn btn-ghost flex-1 py-2.5">초기화</Link>
                <button type="submit" className="btn btn-primary flex-[2] py-2.5">적용</button>
              </div>
            </form>
          </FilterMenu>
        ))}
      </div>

      {chosen.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted">걸린 조건</span>
          {chosen.map((x) => (
              <Link scroll={false} key={x.t} href={x.href}
                    className="rounded-pill bg-brandSoft px-2.5 py-1 font-semibold text-brand hover:opacity-80">
                {x.t} <span aria-hidden="true">×</span>
                <span className="sr-only">조건 지우기</span>
              </Link>
            ))}
          <Link scroll={false} href={jobPath({ org: route.org, kind: route.kind, open: route.open, sort: route.sort, page: 1 })}
                className="text-muted underline underline-offset-4 hover:text-brand">
            모두 지우기
          </Link>
        </div>
      )}
      {also.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted">
          <span>연관어도 함께 찾았습니다 —</span>
          {also.map((t) => (
            <Link scroll={false} key={t} href={jobPathWith(route, { q: t, page: 1 })}
                  className="font-semibold text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand">
              {t}
            </Link>
          ))}
          {/* 연관어 끄기: 그 말이 들어간 공고만. 낱말을 따옴표로 감싼 주소로 간다(lib/jobFilter). */}
          <Link scroll={false} href={jobPathWith(route, { q: exactQuery(route.q), page: 1 })}
                className="ml-1 rounded-pill border border-line2 bg-white px-2.5 py-1 font-semibold text-ink2 hover:border-brand hover:text-brand">
            연관어 빼고 ‘{unquoteQuery(route.q)}’만 보기
          </Link>
        </p>
      )}
      {exact && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <span>‘{unquoteQuery(route.q)}’가 들어간 공고만 보고 있습니다(연관어 끔).</span>
          <Link scroll={false} href={jobPathWith(route, { q: unquoteQuery(route.q), page: 1 })}
                className="rounded-pill border border-line2 bg-white px-2.5 py-1 font-semibold text-ink2 hover:border-brand hover:text-brand">
            연관어도 함께 찾기
          </Link>
        </p>
      )}
      </section>

      {/* 목록 머리: 건수 · 접수 중만(스위치) · 정렬(두 칸). 보는 방식을 바꾸는 것이라 목록 바로 위에 둔다.
          둘 다 같은 목록을 달리 보여 주는 것이라 색인하지 않는 주소로 간다(jobRobots) — nofollow. */}
      <div className="mb-3 mt-8">
        {/* 채용 공고 / 합격자·일정 공고 두 칸(2026-11-16). 나라일터는 "서류전형 합격자 및 면접 일정 공고"도 같은 칸에 올려
            목록의 열에 하나 남짓이 지원할 수 없는 공고였다. 이미 지원한 사람은 오른쪽 칸에서 본다. 오른쪽은 색인하지 않는 쪽이라 nofollow. */}
        <nav aria-label="공고 종류" className="flex border-b border-line text-[14.5px] font-bold">
          {([[undefined, "채용 공고", jobN], ["result", "합격자·일정 공고", resultN]] as const).map(([v, t, n]) => (
            <Link scroll={false} key={t} href={jobPathWith(route, { kind: v })} rel={v ? "nofollow" : undefined} aria-current={route.kind === v ? "page" : undefined}
                  className={`-mb-px flex items-baseline gap-1.5 border-b-2 px-3 py-2.5 first:pl-1 ${route.kind === v ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {t} <span className="num text-[12.5px] font-semibold opacity-70">{n.toLocaleString()}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex items-baseline justify-between gap-3">
          <h2 className="text-[1.0625rem] font-bold">{route.kind ? "합격자·일정 공고" : filtered ? "조건에 맞는 공고" : "채용 공고"}</h2>
          <span className="num text-sm text-muted">
            {list.length.toLocaleString()}건{last > 1 && ` · ${cur}/${last}쪽`}
          </span>
        </div>
        {route.kind && <p className="mt-1 text-[12.5px] text-muted">서류전형 합격자, 면접·시험 일정, 최종 합격자처럼 이미 진행 중인 채용의 소식입니다. 제목으로 가려 몇 건은 잘못 들어올 수 있습니다.</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Link scroll={false} href={pick({ open: !route.open }).href} rel="nofollow" role="switch" aria-checked={Boolean(route.open)}
                className="flex items-center gap-2 text-[13.5px] font-semibold text-ink2">
            <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${route.open ? "bg-brand" : "bg-line2"}`} aria-hidden>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${route.open ? "left-[18px]" : "left-0.5"}`} />
            </span>
            접수 중만 보기 <span className="num text-[12.5px] font-normal text-muted">{openN.toLocaleString()}</span>
          </Link>
          <nav aria-label="정렬" className="flex rounded-pill bg-ground p-0.5 text-[13px] font-semibold">
            {([[undefined, "마감 임박순"], ["new", "최신 등록순"]] as const).map(([v, t]) => (
              <Link scroll={false} key={t} href={pick({ sort: v }).href} rel={v ? "nofollow" : undefined} aria-current={route.sort === v ? "true" : undefined}
                    className={`rounded-pill px-3 py-1.5 transition-colors ${route.sort === v ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
                {t}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* 진행 중인 채용(2026-11-16). 합격자·일정 공고를 다른 칸으로 빼자, 법무부처럼 지금 채용이 한창인 기관이
          마지막 채용 공고가 지난 것이라 "아무것도 안 뽑는 곳"처럼 보였다. 그 소식 가운데 아직 끝나지 않은 것을 1쪽 맨 위에 짧게 올린다. */}
      {!route.kind && cur === 1 && active.length > 0 && (
        <section aria-labelledby="jobs-active" className="mb-3 rounded-card bg-brandSoft/60 p-3.5 ring-1 ring-inset ring-brand/15 sm:p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 id="jobs-active" className="text-[14px] font-bold text-ink">진행 중인 채용 <span className="num text-brand">{active.length}</span></h3>
            <span className="text-[12px] text-muted">서류 합격자 발표·면접 일정 등</span>
          </div>
          <ul className="mt-2 grid gap-1">
            {active.slice(0, 4).map((j) => {
              const dd = dday(j, today);
              return (
                <li key={j.id}>
                  <Link href={`/jobs/${encodeURIComponent(j.id)}`} className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-[13.5px] hover:bg-white/70">
                    {dd && <span className={`num badge shrink-0 ${dd.cls}`}>{dd.t}</span>}
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink2">{j.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {active.length > 4 && (
            <Link href={jobPathWith(route, { kind: "result" })} rel="nofollow" className="mt-1.5 inline-block px-1 text-[13px] font-semibold text-brand hover:underline">
              {active.length}건 모두 보기 →
            </Link>
          )}
        </section>
      )}

      {list.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="mx-auto h-28 w-40"><IllusEmpty /></div>
          <p className="mt-2 leading-relaxed text-muted">조건에 맞는 공고가 없습니다.</p>
          <Link href={jobPath({ org: route.org, page: 1 })} className="btn btn-ghost mt-5">
            조건 지우기
          </Link>
        </div>
      ) : (
        <ul className="grid gap-2 sm:gap-3">
          {shown.map((j, i) => {
            const dd = dday(j, today);
            const isNew = Boolean(j.reg) && dayNo(today) - dayNo(j.reg!) <= 2 && j.status !== "closed";
            const cls = classifyJob(j);
            // 마감 임박순에서는 마감된 공고가 뒤에 몰린다. 어디부터 끝난 공고인지 줄을 긋는다.
            const firstClosed = !route.sort && j.status === "closed" && (i === 0 ? list[(cur - 1) * PER_PAGE - 1]?.status !== "closed" : shown[i - 1].status !== "closed");
            // 맨 처음부터 마감된 공고면(접수 중이 하나도 없으면) 줄 대신 그렇다고 적는다.
            const noneOpen = firstClosed && cur === 1 && i === 0;
            return (
              <li key={j.id}>
                {noneOpen ? (
                  <p className="mb-2 rounded-card bg-surface2 px-4 py-3 text-[13px] text-muted ring-1 ring-inset ring-line">
                    {!route.kind && active.length > 0
                      ? "새로 지원받는 채용 공고는 지금 없습니다. 위 '진행 중인 채용'은 접수를 마치고 전형이 이어지는 것입니다. 아래는 마감된 공고입니다."
                      : `지금 접수 중인 ${route.kind ? "소식" : "채용 공고"}는 없습니다. 아래는 마감된 것입니다.`}
                  </p>
                ) : firstClosed && (
                  <p className="mb-2 mt-3 flex items-center gap-3 text-[12.5px] font-semibold text-faint">
                    <span className="h-px flex-1 bg-line2" />여기부터 마감된 공고<span className="h-px flex-1 bg-line2" />
                  </p>
                )}
                {/* 공고마다 우리 쪽 상세 페이지를 둔다. 나라일터는 원문 주소를
                    안 주는 공고가 많아 예전에는 눌러도 아무 일이 없었다.
                    2026-11-15: 카드 한 장을 article 로, 제목을 h3 로. 맨 앞은 남은 날, 마감일은 요일까지 또렷하게.
                    2026-11-15 휴대폰에서 줄였다: 카드 한 장이 5~6줄이라 40건이면 스크롤이 끝없었다. 휴대폰은 세 줄 —
                    ① 남은 날·고용 형태·급수 ② 제목(두 줄까지) ③ 기관·지역 … 마감일. 기관 머리글자·기관 구분·모집 분야·인원·등록일은
                    넓은 화면에서만(상세 쪽에 다 있다). */}
                <article className={`card card-link flex gap-3.5 p-3.5 sm:p-5 ${j.status === "closed" ? "opacity-70" : ""}`}>
                  <span className="hidden sm:block"><OrgMark org={j.org} hire={j.hire} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      {dd ? <span className={`num badge ${dd.cls}`}>{dd.t}</span>
                          : (j.start || j.end) && <span className={`badge ${BADGE[j.status]}`}>{STATUS_LABEL[j.status]}</span>}
                      {isNew && <span className="badge badge-new">새 공고</span>}
                      {/* 고용 형태·급수를 먼저(지원 여부를 가르는 것). 기관 구분은 그 뒤. */}
                      {cls.types.slice(0, 2).map((t, i) => <span key={t} className={`badge badge-quiet font-bold text-ink2 ${i ? "max-sm:hidden" : ""}`}>{t}</span>)}
                      {cls.grades[0] && <span className="badge badge-quiet">{cls.grades.length > 1 ? `${cls.grades[0]} 외` : cls.grades[0]}</span>}
                      {j.hire && <span className="badge badge-quiet max-sm:hidden">{j.hire}</span>}
                      {j.recruit && <span className="badge badge-quiet max-sm:hidden">{j.recruit.replace(/\s*외\s*\d+$/, " 등")}</span>}
                      {j.headcount && <span className="num badge badge-quiet max-sm:hidden">{j.headcount}명</span>}
                    </p>
                    <h3 className="mt-1.5 line-clamp-2 text-[15px] font-bold leading-snug sm:mt-2 sm:text-[15.5px]">
                      {/* after: 카드 전체가 눌린다. 링크 글자는 제목 그대로라 읽어 주는 기기에도 뜻이 통한다. */}
                      <Link href={`/jobs/${encodeURIComponent(j.id)}`} className="after:absolute after:inset-0 after:content-[''] hover:text-brand">
                        {j.title}
                      </Link>
                    </h3>
                    {/* 휴대폰: 기관·지역과 마감일을 한 줄에(기관이 길면 말줄임). 넓은 화면: 예전처럼 두 줄. */}
                    <div className="mt-1 flex items-baseline gap-2 text-[13px] sm:block">
                      <p className="min-w-0 flex-1 truncate text-muted sm:whitespace-normal">
                        {[j.org, j.region].filter(Boolean).join(" · ")}
                        {j.sectors && <span className="max-sm:hidden"> · {j.sectors}</span>}
                      </p>
                      <p className="num shrink-0 sm:mt-1.5 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-2">
                        {j.end ? (
                          <span className={dd?.cls === "badge-hot" ? "font-bold text-alert" : "font-semibold text-ink2"}>
                            <time dateTime={j.end}>{shortDay(j.end)}</time> 마감
                          </span>
                        ) : (
                          <span className="text-muted"><span className="max-sm:hidden">마감일은 </span>공고문<span className="max-sm:hidden">에서</span> 확인</span>
                        )}
                        {/* 잡알리오는 접수 시작일을 주지 않아 시작 칸이 등록일이다. 등록일만 적는다. */}
                        {j.reg && <span className="text-xs text-faint max-sm:hidden"><time dateTime={j.reg}>{dot(j.reg)}</time> 등록</span>}
                        {j.id.startsWith("a") && <span className="text-xs text-faint max-sm:hidden">잡알리오</span>}
                      </p>
                    </div>
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

      {/* 분류별로 보기: 한 조건짜리 쪽(/jobs/type/임기제)으로 가는 보통 링크. 위 거르기 창은 폼이라 검색 로봇이 따라가지 않으니,
          "임기제 채용"·"7급 채용" 같은 쪽이 발견되고 색인되는 길은 여기다. 사람에게는 바로 가기. */}
      {!route.org && (
        <nav aria-labelledby="jobs-by-class" className="mt-10 rounded-card bg-ground p-4 sm:p-5">
          <h2 id="jobs-by-class" className="text-[14px] font-bold text-ink2">분류별로 보기</h2>
          {([["고용 형태", "type", JOB_TYPES.map((t) => t.v)], ["직무", "field", JOB_FIELDS], ["급수", "grade", JOB_GRADES]] as const).map(([label, key, vs]) => (
            <p key={key} className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5 text-[13px]">
              <span className="w-14 shrink-0 font-semibold text-muted">{label}</span>
              {vs.map((v) => (
                <Link key={v} href={onlyPath(key, v)} className="text-ink2 underline-offset-4 hover:text-brand hover:underline">
                  {v} 채용
                </Link>
              ))}
            </p>
          ))}
        </nav>
      )}
    </KeepScroll>
  );
}
