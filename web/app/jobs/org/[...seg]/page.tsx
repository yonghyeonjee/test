import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtJobs } from "@/components/Art";
import AdSlot from "@/components/AdSlot";
import GuideBanner from "@/components/GuideBanner";
import JobList from "@/components/JobList";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { dot, getJobsByOrg, getOrgStat, peakMonths } from "@/lib/pubJobs";
import { jobCanonical, jobRobots, jobRouteLabel, peekJobRoute, readJobRoute } from "@/lib/jobRoute";
import { jobsRelated } from "@/lib/related";

// /jobs/org/법무부 · /jobs/org/법무부/hire/국가/page/2
export const dynamic = "force-dynamic";

type P = { params: { seg: string[] } };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const r = peekJobRoute(["org"], params.seg);
  const org = r.org!;
  const stat = await getOrgStat(org);
  const span = stat?.firstReg && stat.lastReg
    ? `${stat.firstReg.slice(0, 4)}년부터 ${stat.n.toLocaleString()}건`
    : "지금까지 올라온 공고";
  const extra = jobRouteLabel(r).filter((v) => v !== org);
  const tail = r.page > 1 ? ` (${r.page}쪽)` : "";
  return {
    title: `${org} 채용 공고${extra.length ? ` — ${extra.join(" · ")}` : " — 지금까지 낸 공고와 접수 기간"}${tail}`,
    description:
      `${org}이(가) 나라일터에 낸 채용 공고를 모았습니다. ${span}을 등록일순으로 보고, ` +
      "접수 중인 공고와 접수 기간이 며칠이었는지를 함께 확인합니다.",
    keywords: [`${org} 채용`, `${org} 채용공고`, `${org} 공고`, "공공기관 채용", "나라일터"],
    alternates: { canonical: jobCanonical(r) },
    robots: jobRobots(r),
  };
}

/** 열두 달 막대. 값이 아니라 모양을 보여 주는 것이라 눈금은 두지 않는다. */
function MonthBars({ months }: { months: number[] }) {
  const max = Math.max(1, ...months);
  return (
    <div className="mt-3 flex items-end gap-1" aria-hidden="true">
      {months.map((n, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t bg-brand/70"
               style={{ height: `${Math.max(2, Math.round((n / max) * 44))}px` }} />
          <span className="text-[10px] text-faint">{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

export default async function JobsByOrg({ params }: P) {
  const route = readJobRoute(["org"], params.seg);
  if (!route) notFound();
  const org = route.org!;
  const [board, stat] = await Promise.all([getJobsByOrg(org), getOrgStat(org)]);
  if (!stat && !board.jobs.length) notFound();

  const peak = stat ? peakMonths(stat.months) : null;

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="채용 · 기관별"
        title={org}
        sub={`${org}이(가) 나라일터에 낸 채용 공고입니다. 접수 중인 것이 앞에 오고, 그 뒤로 지난 공고가 등록일순으로 이어집니다.`}
        art={<ArtJobs />}
      >
        {stat && (
          <p className="num mt-4 text-sm text-white/80">
            공고 {stat.n.toLocaleString()}건
            {stat.openN > 0 && ` · 접수 중 ${stat.openN}건`}
            {stat.firstReg && stat.lastReg && ` · ${dot(stat.firstReg)}~${dot(stat.lastReg)}`}
          </p>
        )}
      </PageBanner>

      <nav aria-label="위치" className="mt-6 text-[13px] text-muted">
        <Link href="/jobs" className="hover:text-brand">채용</Link>
        {" · "}
        <Link href="/jobs/org" className="hover:text-brand">기관별</Link>
        {" · "}
        <span className="text-ink2">{org}</span>
      </nav>

      {stat && (
        <section className="card mt-6 p-5">
          <h2 className="text-[15px] font-bold">지난 공고에서 읽히는 것</h2>
          <ul className="mt-3 space-y-2 text-[14px] leading-[1.75] text-ink2">
            <li>
              마지막 공고는 <b className="num">{dot(stat.lastReg) ?? "—"}</b>에 올라왔습니다.
            </li>
            {stat.avgDays != null && (
              <li>
                접수 기간은 평균 <b className="num">{stat.avgDays}일</b>이었습니다. 공고를 보고
                나서 서류를 떼면 늦을 수 있습니다.
              </li>
            )}
            {peak ? (
              <li>
                지금까지 낸 공고의 <b className="num">{peak.share}%</b>가{" "}
                <b>{peak.label}</b>에 올라왔습니다.
              </li>
            ) : (
              <li className="text-muted">
                공고가 특정 달에 몰리지는 않았습니다. 열두 달에 고르게 퍼져 있어서, 몇 월에
                뽑는다고 말하기 어렵습니다.
              </li>
            )}
          </ul>
          {stat.n >= 12 && <MonthBars months={stat.months} />}
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {stat.firstReg?.slice(0, 4)}~{stat.lastReg?.slice(0, 4)}년에 모인{" "}
            {stat.n.toLocaleString()}건을 센 것입니다. 이 기간 밖의 공고와, 나라일터에 올리지
            않은 공고는 빠져 있습니다.
          </p>
        </section>
      )}

      <JobList board={board} route={route} />

      <AdSlot name="page_bottom" />

      <section className="mt-14">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">{org} 공고를 볼 때</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            같은 기관이라도 정규직, 공무직(무기계약직), 기간제, 임기제가 따로 있습니다. 목록의
            구분 칩으로 걸러 보시면 어떤 자리를 주로 뽑는 곳인지 보입니다. 공무직은 공무원이
            아니라 기관 소속 근로자이고, 기간제는 기간이 끝나면 계약이 끝납니다.
          </p>
          <p>
            지난 공고를 열어 보시는 것도 도움이 됩니다. 요구하는 자격증과 경력 조건은 회차가
            바뀌어도 크게 달라지지 않습니다. 다음 공고를 기다리는 동안 무엇을 준비해야 할지는
            지난 공고문이 제일 정확하게 알려 줍니다.
          </p>
          <p>
            여기 있는 것이 이 기관 공고 전부는 아닙니다. 인사혁신처 나라일터에 올라온 것만
            모으고 있어서, 기관 홈페이지 채용 게시판에만 올리는 공고는 빠집니다. 가고 싶은
            기관이 정해져 있다면 그 기관 게시판도 같이 보세요.
          </p>
        </div>
      </section>

      <GuideBanner title="취업을 준비하신다면 이것도" />
      <RelatedLinks items={jobsRelated()} />
      <PromoBanner placement="jobs-org" context="job" />
    </div>
  );
}
