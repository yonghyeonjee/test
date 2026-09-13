import type { Metadata } from "next";
import Link from "next/link";
import { ArtJobs } from "@/components/Art";
import AdSlot from "@/components/AdSlot";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import JobList from "@/components/JobList";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { getJobsByRegion } from "@/lib/pubJobs";
import { jobsRelated } from "@/lib/related";

export const dynamicParams = true;
export const revalidate = 3600;
export function generateStaticParams() {
  return [];
}

type P = { params: { sido: string }; searchParams: { [k: string]: string | string[] | undefined } };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function generateMetadata({ params }: { params: { sido: string } }): Metadata {
  const sido = decodeURIComponent(params.sido);
  return {
    title: `${sido} 공공기관 채용 공고 — 접수 중인 자리부터`,
    description:
      `${sido}에서 뽑는 공공기관·지자체 채용 공고를 모았습니다. 접수 중인 것이 앞에 오고 ` +
      "마감이 가까운 순서로 정렬합니다. 회원가입 없이 바로 볼 수 있습니다.",
    keywords: [`${sido} 채용`, `${sido} 공공기관 채용`, `${sido} 공무직`, "지자체 채용공고"],
    alternates: { canonical: `/jobs/region/${encodeURIComponent(sido)}` },
  };
}

export default async function JobsByRegion({ params, searchParams }: P) {
  const sido = decodeURIComponent(params.sido);
  const board = await getJobsByRegion(sido);
  const filter = {
    q: one(searchParams.q) || undefined,
    hire: one(searchParams.hire) || undefined,
    open: one(searchParams.open) === "1",
  };
  const openN = board.jobs.filter((j) => j.status !== "closed").length;

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow={`채용 · ${sido}`}
        title={`${sido}에서 뽑는 자리`}
        sub={`${sido}에 있는 공공기관과 지자체가 낸 채용 공고입니다. 접수 중인 것이 앞에 옵니다.`}
        art={<ArtJobs />}
      >
        {board.ok && (
          <p className="num mt-4 text-sm text-white/80">
            {board.total.toLocaleString()}건 · 접수 중 {openN.toLocaleString()}건
          </p>
        )}
      </PageBanner>

      <nav aria-label="위치" className="mt-6 text-[13px] text-muted">
        <Link href="/jobs" className="hover:text-brand">채용</Link>
        {" · "}
        <Link href="/jobs/region" className="hover:text-brand">지역별</Link>
        {" · "}
        <span className="text-ink2">{sido}</span>
      </nav>

      <JobList board={board} filter={filter} action={`/jobs/region/${encodeURIComponent(sido)}`} />

      <AdSlot name="page_bottom" />

      <section className="mt-14">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">{sido}에서 일자리 찾을 때</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            지자체가 뽑는 자리에는 거주지 제한이 붙는 경우가 있습니다. 공고일이나 접수 마감일을
            기준으로 {sido}에 주민등록이 되어 있어야 응시할 수 있다는 조건입니다. 공고문
            응시 자격란에 기준일까지 적혀 있으니 지원 전에 확인하세요. 공공기관 본사 채용은
            대개 이런 제한이 없습니다.
          </p>
          <p>
            기관 이름에 {sido}가 들어 있어도 실제 근무지는 산하 사업소나 다른 시·군일 수
            있습니다. 합격 뒤 배치로 정해지는 방식이라 목록만으로는 알 수 없습니다. 출퇴근
            거리가 중요하다면 원문의 근무 조건을 먼저 보세요.
          </p>
          <p>
            취업 준비에 드는 비용은 지자체가 지원하는 경우가 많습니다. 구직활동지원금, 면접
            정장 대여, 자격증 응시료 지원 같은 사업이 지역마다 따로 있습니다. {sido} 지원금
            목록에서 사는 곳을 고르면 시·군·구 사업까지 함께 나옵니다.
          </p>
        </div>
      </section>

      <Faq
        items={[
          {
            q: `${sido} 공고만 따로 보는 이유가 있나요?`,
            a: "출퇴근할 수 있는 자리부터 보는 게 빠르기 때문입니다. 전체 목록은 하루에도 수십 건씩 올라와서, 지역을 좁히지 않으면 볼 만한 것을 놓치기 쉽습니다.",
          },
          {
            q: "여기 없는 공고도 있나요?",
            a: "있습니다. 인사혁신처 나라일터에 올라온 것만 모읍니다. 개별 기관 홈페이지에만 올리는 공고도 있으니, 가고 싶은 기관이 정해져 있다면 그 기관 채용 게시판도 같이 보세요.",
          },
          {
            q: "얼마나 자주 새로 들어오나요?",
            a: "매일 오전 9시에 새 공고를 받아 옵니다. 접수 중인 공고가 앞에 오고, 그중에서도 마감이 가까운 것부터 보여 드립니다.",
          },
        ]}
      />

      <GuideBanner />
      <PromoBanner placement="jobs-region" context="job" />
      <RelatedLinks items={jobsRelated()} />
    </div>
  );
}
