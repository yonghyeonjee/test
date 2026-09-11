import Link from "next/link";
import { STATUS_LABEL } from "@/lib/db";
import { dot, facets, filterJobs, type JobBoard, type JobFilter } from "@/lib/pubJobs";

const BADGE: Record<string, string> = {
  ongoing: "badge-open", always: "badge-open", upcoming: "badge-soon", closed: "badge-closed",
};

function href(f: JobFilter, patch: Partial<JobFilter>) {
  const n = { ...f, ...patch };
  const p = new URLSearchParams();
  if (n.q) p.set("q", n.q);
  if (n.region) p.set("region", n.region);
  if (n.hire) p.set("hire", n.hire);
  if (n.open) p.set("open", "1");
  const s = p.toString();
  return s ? `/jobs?${s}` : "/jobs";
}

/**
 * 채용 공고 목록과 거르기.
 *
 * 걸러 주는 값은 데이터에서 뽑는다. 없는 지역을 칩으로 늘어놓으면 눌러도
 * 빈 화면만 나온다. 검색어는 서버 렌더 GET 폼이라 자바스크립트가 없어도 된다.
 */
export default function JobList({ board, filter }: { board: JobBoard; filter: JobFilter }) {
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

  const { regions, hires } = facets(board.jobs);
  const list = filterJobs(board.jobs, filter);
  const openN = board.jobs.filter((j) => j.status !== "closed").length;

  return (
    <div className="mt-6">
      <form action="/jobs" method="get" className="flex gap-2">
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
        <Link href={href(filter, { open: !filter.open })}
              className={`chip ${filter.open ? "chip-on" : ""}`}>
          접수 중만 <span className="num text-[11.5px] opacity-70">{openN}</span>
        </Link>
        {hires.slice(0, 6).map((h) => (
          <Link key={h.v} href={href(filter, { hire: filter.hire === h.v ? undefined : h.v })}
                className={`chip ${filter.hire === h.v ? "chip-on" : ""}`}>
            {h.v} <span className="num text-[11.5px] opacity-70">{h.n}</span>
          </Link>
        ))}
      </div>
      {regions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[13px]">
          {regions.slice(0, 20).map((r) => (
            <Link key={r.v}
                  href={href(filter, { region: filter.region === r.v ? undefined : r.v })}
                  className={`transition-colors hover:text-brand ${
                    filter.region === r.v ? "font-bold text-brand" : "text-muted"}`}>
              {r.v}<span className="num ml-1 text-[11px] text-faint">{r.n}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-3 mt-8 flex items-baseline justify-between">
        <h2 className="text-[1.0625rem] font-bold">
          {filter.q || filter.region || filter.hire || filter.open ? "조건에 맞는 공고" : "최근 공고"}
        </h2>
        <span className="num text-sm text-muted">{list.length}건</span>
      </div>

      {list.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="leading-relaxed text-muted">조건에 맞는 공고가 없습니다.</p>
          <Link href="/jobs" className="btn btn-ghost mt-5">조건 지우기</Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {list.map((j) => {
            const inner = (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`badge ${BADGE[j.status]}`}>{STATUS_LABEL[j.status]}</span>
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
            return (
              <li key={j.id}>
                {j.url ? (
                  <a href={j.url} target="_blank" rel="noopener noreferrer"
                     className="card card-link block p-5">{inner}</a>
                ) : (
                  <div className="card block p-5">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
