import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtJobs } from "@/components/Art";
import AdSlot from "@/components/AdSlot";
import MidAd from "@/components/MidAd";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import JobList from "@/components/JobList";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { getJobOverview, getJobs } from "@/lib/pubJobs";
import { jobCanonical, jobRobots, jobRouteLabel, readJobRoute, type JobRoute } from "@/lib/jobRoute";
import { JOBS_FAQ } from "@/lib/pageFaq";
import { jobsRelated } from "@/lib/related";

/**
 * 전체 채용 목록. /jobs 와 그 아래 거르기 주소가 모두 이 하나를 쓴다.
 *
 * /jobs · /jobs/page/2 · /jobs/hire/국가 · /jobs/status/open · /jobs/q/방호
 *
 * 지역별(/jobs/region/…)과 기관별(/jobs/org/…)은 안내 글이 달라 따로 둔다.
 */

export function jobsIndexMetadata(r: JobRoute): Metadata {
  const cond = jobRouteLabel(r);
  const tail = r.page > 1 ? ` (${r.page}쪽)` : "";
  const title = cond.length
    ? `${cond.join(" · ")} 공공기관 채용 공고${tail}`
    : `공공기관 채용정보·취업지원제도 — 지역별 채용 공고 한눈에${tail}`;
  return {
    title,
    description: cond.length
      ? `${cond.join(" · ")} 조건에 맞는 공공기관·지자체 채용 공고입니다. 접수 중인 것이 앞에 오고 ` +
        "마감이 가까운 순서로 정렬합니다."
      : "인사혁신처 나라일터에 올라온 공공기관·지자체 채용 공고를 지역과 기관 구분, 기관명으로 " +
        "걸러 봅니다. 접수 중인 공고를 마감 임박순으로 보여 드립니다.",
    keywords: [
      "취업지원제도", "구직", "공공기관 채용", "공공기관 채용정보",
      "나라일터 채용", "공무직 채용", "지자체 채용공고",
      ...cond.map((c) => `${c} 채용`),
    ],
    alternates: { canonical: jobCanonical(r) },
    robots: jobRobots(r),
  };
}

export default async function JobsIndexPage({ prefix = [], seg = [] }: { prefix?: string[]; seg?: string[] }) {
  // 미들웨어가 이미 걸렀지만, 쪽 혼자서도 옳게 답하도록 한 번 더 본다.
  const route = readJobRoute(prefix, seg);
  if (!route) notFound();
  const [board, overview] = await Promise.all([getJobs(), getJobOverview()]);
  const open = overview?.openN ?? board.jobs.filter((j) => j.status !== "closed").length;
  const orgs = overview?.orgs ?? new Set(board.jobs.map((j) => j.org).filter(Boolean)).size;

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="채용"
        title="공공기관 채용, 어디서 뽑는지 한 번에"
        sub="인사혁신처 나라일터에 올라오는 중앙부처·지자체·공공기관 채용 공고입니다. 지역과 기관 구분으로 걸러 접수 중인 것부터 봅니다."
        art={<ArtJobs />}
      >
        {board.ok && (
          <div className="mt-7 grid grid-cols-3 gap-3">
            {[
              { n: open, label: "접수 중" },
              { n: overview?.total ?? board.jobs.length, label: "모아 둔 공고" },
              { n: orgs, label: "채용 기관" },
            ].map((b) => (
              <div key={b.label} className="rounded-card bg-white/10 px-3 py-3 text-center">
                <b className="num block text-[1.35rem] font-extrabold text-white">
                  {b.n.toLocaleString()}
                </b>
                <span className="mt-0.5 block text-[11.5px] text-white/70">{b.label}</span>
              </div>
            ))}
          </div>
        )}
      </PageBanner>

      <JobList board={board} route={route} />
      <MidAd name="detail_mid" context="job" seed="jobs" className="mt-10" />

      <p className="mt-3 text-xs leading-relaxed text-muted">
        나라일터 공개 자료를 여섯 시간마다 받아 옵니다. 접수 기간과 자격 요건의 최종
        확인은 공고 원문에서 하셔야 합니다.
      </p>

      {overview && overview.total > overview.lastYear && (
        <div className="card mt-6 p-5">
          <h2 className="text-[15px] font-bold">이미 끝난 공고도 모아 두고 있습니다</h2>
          <p className="mt-2 text-[14px] leading-[1.8] text-ink2">
            위 목록은 최근 공고입니다. 그 밖에{" "}
            <b className="num">{overview.firstReg?.slice(0, 4)}년부터 지금까지 {overview.total.toLocaleString()}건</b>을
            모아 두었습니다. 마감된 공고는 지원할 수는 없지만, 어느 기관이 얼마나 자주
            뽑는지, 접수 기간이 며칠인지를 알려 줍니다
            {overview.medDays != null && (
              <> — 지금까지 모인 공고의 접수 기간은 중앙값 <b className="num">{overview.medDays}일</b>이었습니다</>
            )}
            .
          </p>
          <Link href="/jobs/org" className="btn btn-ghost mt-4">기관별 채용 이력 보기</Link>
        </div>
      )}

      <section className="mt-14">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          공공기관 채용은 이렇게 다릅니다
        </h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            공공기관 채용은 공고가 흩어져 있는 것이 가장 큰 벽입니다. 부처는 부처대로,
            지자체는 지자체대로, 산하기관은 각자 홈페이지에 올리기 때문에 한 곳만 보고
            있으면 옆 기관 공고를 놓칩니다. 나라일터는 그것을 한자리에 모으는 정부
            창구이고, 여기서는 그 자료를 지역과 기관 구분으로 다시 걸러 볼 수 있게
            두었습니다. 사는 곳을 누르면 그 지역 근무지 공고만 남습니다.
          </p>
          <p>
            고용형태는 꼭 확인하셔야 합니다. 같은 기관이라도 정규직, 무기계약직(공무직),
            기간제, 임기제가 따로 있고, 채용 절차와 이후 신분이 완전히 다릅니다. 공무직은
            공무원이 아니라 기관 소속 근로자이고, 기간제는 기간이 끝나면 계약이 끝납니다.
            공고명만 보고 지원했다가 면접장에서 알게 되는 일이 잦습니다.
          </p>
          <p>
            접수 기간이 짧습니다. 열흘 안팎이 보통이고 일주일인 곳도 많습니다. 서류를
            미리 갖춰 두지 않으면 공고를 보고도 못 냅니다. 자격증 사본, 경력증명서,
            주민등록초본 정도는 한 번 떼어 두시고, 자격 요건에 자격증이 있으면 이
            사이트의 자격증 목록에서 등급을 확인해 두시면 됩니다.
          </p>
          <p>
            취업 준비 중이시라면 채용 공고와 지원 제도를 같이 보시길 권합니다. 구직 활동
            수당, 면접 정장 대여, 자격증 응시료 지원처럼 준비 비용을 덜어 주는 사업이
            지자체마다 있습니다. 사는 곳과 나이를 넣고 조회하시면 그런 사업이 있는지
            함께 나옵니다.
          </p>
        </div>
      </section>

      <AdSlot name="page_bottom" />
      <Faq items={JOBS_FAQ} />

      <GuideBanner title="취업을 준비하신다면 이것도" />
      <RelatedLinks items={jobsRelated()} />
      <PromoBanner placement="jobs" context="job" />
    </div>
  );
}
