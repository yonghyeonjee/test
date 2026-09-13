import Link from "next/link";
import { STATUS_LABEL } from "@/lib/db";
import { dot, facets, filterJobs, type JobBoard, type JobFilter } from "@/lib/pubJobs";

const BADGE: Record<string, string> = {
  ongoing: "badge-open", always: "badge-open", upcoming: "badge-soon", closed: "badge-closed",
};

function href(base: string, f: JobFilter, patch: Partial<JobFilter>) {
  const n = { ...f, ...patch };
  const p = new URLSearchParams();
  if (n.q) p.set("q", n.q);
  if (n.region) p.set("region", n.region);
  if (n.hire) p.set("hire", n.hire);
  if (n.open) p.set("open", "1");
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

/**
 * 채용 공고 목록과 거르기.
 *
 * 걸러 주는 값은 데이터에서 뽑는다. 없는 지역을 칩으로 늘어놓으면 눌러도
 * 빈 화면만 나온다. 검색어는 서버 렌더 GET 폼이라 자바스크립트가 없어도 된다.
 */
export default function JobList({ board, filter, action = "/jobs" }: {
  board: JobBoard;
  filter: JobFilter;
  /** 거르기 링크와 검색 폼이 향할 곳. 지역별 목록은 그 지역 주소를 준다. */
  action?: string;
}) {
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

  const { regions, hires, openN } = facets(board.jobs, filter);
  const list = filterJobs(board.jobs, filter);

  return (
    <div className="mt-6">
      <form action={action} method="get" className="flex gap-2">
        {filter.region && <input type="hidden" name="region" value={filter.region} />}
        {filter.hire && <input type="hidden" name="hire" value={filter.hire} />}
        {filter.open && <input type="hidden" name="open" value="1" />}
        <input
          name="q"
          defaultValue={filter.q ?? ""}
          placeholder="기관명·공고명·분야로 찾기"
          className="field min-w-0 flex-1"
          aria-label="채용 공고 검색어"
        />
        <button type="submit" className="btn btn-primary shrink-0 px-5 py-2.5">찾기</button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={href(action, filter, { open: !filter.open })}
              className={`chip ${filter.open ? "chip-on" : ""}`}>
          접수 중만 <span className="num text-[11.5px] opacity-70">{openN}</span>
        </Link>
        {hires.slice(0, 6).map((h) => (
          <Link key={h.v} href={href(action, filter, { hire: filter.hire === h.v ? undefined : h.v })}
                className={`chip ${filter.hire === h.v ? "chip-on" : ""}`}>
            {h.v} <span className="num text-[11.5px] opacity-70">{h.n}</span>
          </Link>
        ))}
      </div>
      {action === "/jobs" && regions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[13px]">
          {regions.slice(0, 20).map((r) => (
            <Link key={r.v}
                  href={href(action, filter, { region: filter.region === r.v ? undefined : r.v })}
                  className={`transition-colors hover:text-brand ${
                    filter.region === r.v ? "font-bold text-brand" : "text-muted"}`}>
              {r.v}<span className="num ml-1 text-[11px] text-faint">{r.n}</span>
            </Link>
          ))}
        </div>
      )}

      {(filter.q || filter.region || filter.hire || filter.open) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted">걸린 조건</span>
          {[filter.q && `"${filter.q}"`, filter.region, filter.hire, filter.open && "접수 중만"]
            .filter(Boolean)
            .map((t) => (
              <span key={String(t)} className="rounded-pill bg-brandSoft px-2.5 py-1 font-semibold text-brand">
                {t}
              </span>
            ))}
          <Link href={action} className="text-muted underline underline-offset-4 hover:text-brand">
            모두 지우기
          </Link>
        </div>
      )}

      <div className="mb-3 mt-8 flex items-baseline justify-between">
        <h2 className="text-[1.0625rem] font-bold">
          {filter.q || filter.region || filter.hire || filter.open
            ? "조건에 맞는 공고"
            : board.jobs.some((j) => j.reg || j.end)
              ? "최근 공고"
              : "공고 목록"}
        </h2>
        <span className="num text-sm text-muted">{list.length}건</span>
      </div>

      {list.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="leading-relaxed text-muted">조건에 맞는 공고가 없습니다.</p>
          <Link href={action} className="btn btn-ghost mt-5">조건 지우기</Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {list.map((j) => {
            const inner = (
              <>
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
              </>
            );
            // 공고마다 우리 쪽 상세 페이지를 둔다. 나라일터는 원문 주소를
            // 안 주는 공고가 많아 예전에는 눌러도 아무 일이 없었다.
            return (
              <li key={j.id}>
                <Link href={`/jobs/${encodeURIComponent(j.id)}`} className="card card-link block p-5">
                  {inner}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
