import type { Metadata } from "next";
import Link from "next/link";
import { ArtJobs } from "@/components/Art";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { getJobRegions } from "@/lib/pubJobs";
import { jobsRelated } from "@/lib/related";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "지역별 공공기관 채용 — 시·도별 채용 공고 모아보기",
  description:
    "서울·경기·부산 등 시·도별로 공공기관과 지자체 채용 공고를 나눠 두었습니다. " +
    "사는 곳에서 출퇴근할 수 있는 자리부터 접수 중인 순서로 봅니다.",
  keywords: ["지역별 채용", "지자체 채용공고", "공공기관 채용 지역", "우리 지역 채용"],
  alternates: { canonical: "/jobs/region" },
};

export default async function JobRegionIndex() {
  const regions = await getJobRegions();

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="채용"
        title="사는 곳에서 다닐 수 있는 자리부터"
        sub="공공기관 채용 공고를 시·도별로 나눠 두었습니다. 근무 지역은 공고를 낸 기관 이름에서 읽어 냅니다."
        art={<ArtJobs />}
      />

      {regions.length === 0 ? (
        <div className="card mt-8 p-8 text-center">
          <p className="leading-relaxed text-muted">
            아직 공고를 받아오지 못했습니다.
            <br />
            매일 오전 9시에 새로 받아 옵니다.
          </p>
          <Link href="/jobs" className="btn btn-ghost mt-5">채용 전체 보기</Link>
        </div>
      ) : (
        <div className="card mt-8 grid grid-cols-2 gap-x-6 gap-y-1 p-5 sm:grid-cols-3">
          {regions.map((r) => (
            <Link
              key={r.sido}
              href={`/jobs/region/${encodeURIComponent(r.sido)}`}
              className="flex items-baseline justify-between rounded-[8px] px-2 py-2 text-sm
                         transition-colors hover:bg-ground hover:text-brand"
            >
              <span>{r.sido}</span>
              <span className="num text-xs text-muted">{r.n}</span>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted">
        나라일터는 근무지를 코드로만 주기 때문에, 공고를 낸 기관 이름에 적힌 시·도를 근무 지역으로
        봅니다. 본청과 근무지가 다른 공고도 있으니 원문에서 한 번 더 확인하세요.
      </p>

      <section className="mt-14">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">지역으로 찾을 때 알아 둘 것</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            공공기관 채용에서 지역은 단순히 출퇴근 거리 문제가 아닙니다. 지방자치단체가 뽑는
            자리 중에는 그 지역에 일정 기간 이상 주민등록이 되어 있어야 응시할 수 있는 것이
            있습니다. 거주지 제한이라고 부르는데, 공고문 응시 자격란에 기준일과 함께 적혀
            있습니다. 반대로 중앙부처와 공공기관 본사 채용은 대개 제한이 없습니다.
          </p>
          <p>
            근무지가 여러 곳인 공고도 흔합니다. 합격 뒤에 배치받는 곳이 정해지는 방식이라,
            지원할 때 고른 지역과 실제 근무지가 다를 수 있습니다. 이 부분은 목록만으로는 알 수
            없으니 원문의 근무 조건을 확인해야 합니다.
          </p>
          <p>
            같은 지역이라도 기관에 따라 채용 시기가 몰립니다. 지자체는 상·하반기에 한 번씩
            공고를 내는 곳이 많고, 공공기관은 결원이 생길 때 수시로 냅니다. 한 번 보고 없다고
            접기보다, 지역 목록을 즐겨찾기 해 두고 몇 주에 한 번 다시 보는 편이 낫습니다.
          </p>
        </div>
      </section>

      <Faq
        items={[
          {
            q: "근무 지역은 어떻게 정하나요?",
            a: "나라일터가 근무지를 숫자 코드로만 주기 때문에, 공고를 낸 기관 이름에 들어 있는 시·도를 근무 지역으로 봅니다. 기관 이름에 지역이 없는 공고(중앙부처 본부 등)는 지역 없이 전체 목록에만 나옵니다.",
          },
          {
            q: "거주지 제한이 있는 공고는 어떻게 알아보나요?",
            a: "공고문 응시 자격란에 적혀 있습니다. \"공고일 현재 계속하여 ○○시에 주민등록이 되어 있는 사람\" 같은 문장입니다. 기준일이 공고일인지 접수 마감일인지에 따라 결과가 갈리니 날짜까지 봐야 합니다.",
          },
          {
            q: "우리 동네 지원금도 같이 볼 수 있나요?",
            a: "네. 지역별 지원금 목록에서 시·도를 고르면 시·군·구 사업까지 함께 나옵니다. 취업 준비 중이라면 구직활동지원금이나 면접 정장 대여처럼 채용과 이어지는 사업이 지자체별로 있습니다.",
          },
        ]}
      />

      <GuideBanner />
      <PromoBanner placement="jobs-region" context="job" />
      <RelatedLinks items={jobsRelated()} />
    </div>
  );
}
