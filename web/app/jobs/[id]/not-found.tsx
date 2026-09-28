import Link from "next/link";
import { dot, getOpenJobs } from "@/lib/pubJobs";

/**
 * 없는 공고 번호로 들어왔을 때.
 *
 * 검색엔진에 남은 옛 주소나 마감돼 내려간 공고로 들어오는 사람이 꾸준히
 * 있다. "찾지 못했습니다" 한 줄로 돌려보내면 그 사람은 그냥 나간다.
 * 404 는 그대로 내되(색인에서 빠지도록), 쪽은 지금 접수 중인 공고로 채운다.
 */
export default async function JobNotFound() {
  const jobs = await getOpenJobs(10).catch(() => []);
  return (
    <div className="pb-4">
      <nav aria-label="위치" className="mt-6 text-[13px] text-muted">
        <Link href="/jobs" className="hover:text-brand">채용</Link>
      </nav>
      <h1 className="display mt-2 text-[1.5rem] leading-tight">이 채용 공고는 내려갔습니다</h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
        접수가 끝나 목록에서 빠졌거나 주소가 바뀐 공고입니다. 나라일터에는 하루에도
        수백 건이 새로 올라오니, 지금 접수 중인 공고에서 비슷한 자리를 찾아보세요.
      </p>

      <form action="/jobs/search" method="get" className="mt-5 flex gap-2">
        <input
          type="search"
          name="q"
          placeholder="기관명이나 직무로 찾기 (예: 기간제 교사, 간호사)"
          className="field min-w-0 flex-1"
          aria-label="채용 검색"
        />
        <button type="submit" className="btn btn-primary shrink-0 px-5 py-2.5">찾기</button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
        <Link href="/jobs" className="badge badge-quiet hover:text-brand">전체 공고</Link>
        <Link href="/jobs/region" className="badge badge-quiet hover:text-brand">지역별</Link>
        <Link href="/jobs/org" className="badge badge-quiet hover:text-brand">기관별</Link>
        <Link href="/jobs/status/open" className="badge badge-quiet hover:text-brand">접수 중만</Link>
        <Link href="/jobs/overseas" className="badge badge-quiet hover:text-brand">해외 채용</Link>
      </div>

      {jobs.length > 0 && (
        <section className="mt-10">
          <h2 className="sec-title text-[1.0625rem] font-extrabold">지금 접수 중인 공고</h2>
          <ul className="mt-4 grid gap-3">
            {jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/jobs/${encodeURIComponent(j.id)}`} className="card card-link block p-4">
                  <b className="block text-[14.5px] leading-snug">{j.title}</b>
                  <span className="mt-1 block text-[13px] text-muted">
                    {[j.org, j.region, j.end && `${dot(j.end)} 마감`].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/jobs/status/open"
            className="mt-5 inline-block border-b-2 border-line pb-0.5 text-sm font-bold hover:border-ink"
          >
            접수 중인 공고 전체 보기
          </Link>
        </section>
      )}
    </div>
  );
}
