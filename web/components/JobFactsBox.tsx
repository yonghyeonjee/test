import Link from "next/link";
import { shortOrg, type JobFacts } from "@/lib/jobFacts";
import type { Job } from "@/lib/pubJobs";

const MONTH = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

/**
 * "이 공고를 숫자로" — 공고 원문에는 없는, 이 사이트가 센 것만. 본문 맨 앞(기본 정보 바로 아래)에 둔다.
 * 쪽마다 다른 사실이 HTML 앞쪽에 있어야 검색엔진이 같은 틀의 복사본으로 묶지 않는다(2026-10-30).
 * 숫자가 하나도 없으면 아무것도 그리지 않는다.
 */
export default function JobFactsBox({ job, f }: { job: Job; f: JobFacts }) {
  const org = shortOrg(job.org);
  const closed = job.status === "closed";
  const tiles: { k: string; v: string; sub?: string }[] = [];

  if (f.daysLeft !== null && !closed) {
    tiles.push({ k: "접수 마감까지", v: f.daysLeft === 0 ? "오늘" : `${f.daysLeft}일`, sub: job.end ? job.end.replaceAll("-", ".") : undefined });
  }
  if (f.periodDays) {
    const cmp = f.orgAvgDays
      ? f.periodDays >= f.orgAvgDays * 1.3 ? `기관 평균 ${f.orgAvgDays}일보다 길다`
        : f.periodDays <= f.orgAvgDays * 0.7 ? `기관 평균 ${f.orgAvgDays}일보다 짧다`
        : `기관 평균 ${f.orgAvgDays}일과 비슷`
      : undefined;
    tiles.push({ k: "접수 기간", v: `${f.periodDays}일`, sub: cmp });
  }
  if (f.n12 > 0) {
    tiles.push({
      k: `${org || "이 기관"} 최근 1년 공고`, v: `${f.n12}건`,
      sub: f.rank && f.ranked ? `1년 안에 공고 낸 ${f.ranked.toLocaleString("ko-KR")}곳 중 ${f.rank}위` : f.pace ?? undefined,
    });
  } else if (f.orgTotal > 0) {
    tiles.push({ k: `${org || "이 기관"} 공고 전체`, v: `${f.orgTotal.toLocaleString("ko-KR")}건`, sub: f.orgSince ? `${f.orgSince}년부터` : undefined });
  }
  if (f.orgOpen > 0) tiles.push({ k: `${org || "이 기관"} 접수 중`, v: `${f.orgOpen}건`, sub: closed ? "이 공고 말고 지금 열린 것" : "이 공고 포함" });
  if (f.regionOpen && job.region) tiles.push({ k: `${job.region} 접수 중`, v: `${f.regionOpen.toLocaleString("ko-KR")}건`, sub: "지역 칸이 같은 공고" });

  const total = f.months.reduce((a, b) => a + b, 0);
  const max = Math.max(0, ...f.months);
  const showMonths = f.months.length === 12 && total >= 12 && max > 0;
  const thisMonth = new Date(Date.now() + 9 * 3600e3).getUTCMonth();

  if (!tiles.length && !showMonths) return null;

  return (
    <section className="card mt-5 p-5" aria-labelledby="job-facts-h">
      <h2 id="job-facts-h" className="text-[15px] font-extrabold">
        이 공고를 숫자로
        <span className="ml-2 text-[12.5px] font-normal text-muted">원문에는 없는, {`K나라지원`}이 센 것</span>
      </h2>
      {tiles.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {tiles.map((t) => (
            <div key={t.k} className="min-w-0">
              <dt className="text-[12.5px] text-muted">{t.k}</dt>
              <dd className="num text-[18px] font-extrabold leading-tight">{t.v}</dd>
              {t.sub && <dd className="mt-0.5 text-[12px] leading-snug text-muted">{t.sub}</dd>}
            </div>
          ))}
        </dl>
      )}
      {showMonths && (
        <div className="mt-4">
          <p className="text-[12.5px] text-muted">
            {org || "이 기관"} 공고가 올라오는 달{f.peak ? <> — <b className="text-ink2">{f.peak.label}</b>에 {f.peak.share}%</> : " — 연중 고르게"}
            {f.pace && <> · {f.pace}</>}
          </p>
          <ol className="mt-2 flex h-12 items-end gap-1" aria-label="월별 공고 수">
            {f.months.map((n, i) => (
              <li key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${MONTH[i]}월 ${n}건`}>
                <span
                  className={`block w-full rounded-sm ${i === thisMonth ? "bg-brand" : "bg-brandSoft"}`}
                  style={{ height: `${Math.max(2, Math.round((n / max) * 32))}px` }}
                />
                <span className="text-[10px] leading-none text-faint">{MONTH[i]}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {job.org && (
        <p className="mt-3 text-[12.5px] text-muted">
          <Link href={`/jobs/org/${encodeURIComponent(job.org)}`} className="underline-offset-2 hover:underline">
            {org || job.org} 채용 이력 전체 보기
          </Link>
        </p>
      )}
    </section>
  );
}
