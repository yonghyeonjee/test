import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import { IllusJobs } from "@/components/Illus";
import JsonLd from "@/components/JsonLd";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { getGuides, guidePath } from "@/lib/guides";
import { jobsRelated } from "@/lib/related";
import { pageGraph } from "@/lib/schema";
import { brandKeys, withOg } from "@/lib/seo";

/**
 * 기관별 자기소개서·직무수행계획서 작성 가이드 목차.
 * "OO공사 자소서", "OO 직무수행계획서" 로 들어오는 사람이 기관을 고르는 곳.
 */
export const revalidate = 3600;

export const metadata: Metadata = withOg({
  title: "공공기관 자기소개서·직무수행계획서 작성법 — 기관별 인재상, 문항, 전형 절차",
  description:
    "공공기관·정부기관별로 공식 누리집과 공고에서 밝힌 인재상·전형 절차·자기소개서 문항을 모으고, 최근 3년 공고의 접수 기간과 자리 구성에 맞춰 자기소개서와 직무수행계획서 쓰는 순서를 정리합니다.",
  keywords: [...brandKeys("자기소개서", "직무수행계획서"), "공공기관 자기소개서 작성법", "직무수행계획서 작성법", "공기업 자소서 문항", "임기제공무원 직무수행계획서", "NCS 자기소개서"],
  alternates: { canonical: "/jobs/guide" },
});

export default async function GuideIndex() {
  const guides = await getGuides(300);
  const ld = pageGraph({
    path: "/jobs/guide", name: "공공기관 자기소개서·직무수행계획서 작성법", collection: true,
    description: "기관별 인재상·문항·전형 절차와 작성 순서",
    crumbs: [{ name: "채용", path: "/jobs" }, { name: "작성 가이드" }],
  });
  return (
    <div className="py-4">
      <JsonLd data={ld} />
      <nav aria-label="위치" className="text-[13px] text-muted">
        <Link href="/jobs" className="inline-block py-1 hover:text-brand">공공기관 채용</Link>{" · "}
        <span className="text-ink2">작성 가이드</span>
      </nav>
      <div className="mt-3 flex items-start justify-between gap-6">
        <div>
          <p className="eyebrow">기관별 작성 가이드</p>
          <h1 className="display mt-2 text-[1.9rem] leading-tight">자기소개서·직무수행계획서, 기관에 맞춰 쓰기</h1>
          <p className="mt-3 max-w-[36rem] leading-relaxed text-muted">
            기관이 공식 누리집과 공고에서 밝힌 인재상·전형 절차·자기소개서 문항을 찾아 두고, 최근 3년 공고의 접수 기간과
            자리 구성에 맞춰 쓰는 순서를 적습니다. 남의 합격 자소서가 아니라, 공고문과 직무기술서에서 시작하는 방법입니다.
          </p>
        </div>
        <div className="hidden h-32 w-44 shrink-0 sm:block"><IllusJobs /></div>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href="/blog/public-essay-howto" className="card card-link block p-5">
          <span className="text-[12px] font-bold text-brand">공통 안내</span>
          <b className="mt-1 block text-[15.5px] leading-snug">공공기관 자기소개서 작성법 — NCS 문항 다섯 유형과 블라인드 규칙</b>
          <span className="mt-1.5 block text-[13.5px] leading-relaxed text-muted">문항 유형별로 무엇을 고르고 어떤 순서로 쓰는지. 기관이 달라도 재료는 같습니다.</span>
        </Link>
        <Link href="/blog/job-plan-howto" className="card card-link block p-5">
          <span className="text-[12px] font-bold text-brand">공통 안내</span>
          <b className="mt-1 block text-[15.5px] leading-snug">직무수행계획서 작성법 — 임기제·개방형 직위 지원자의 여섯 칸 뼈대</b>
          <span className="mt-1.5 block text-[13.5px] leading-relaxed text-muted">직무 이해, 현황과 과제, 목표, 추진 계획, 점검 방법, 적합한 이유. 표와 일정표로.</span>
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">기관별 가이드 {guides.length ? `${guides.length}곳` : ""}</h2>
        <p className="mt-2 text-[14px] text-muted">찾는 사람이 많고 접수 중인 공고가 많은 기관부터 매일 몇 곳씩 더합니다. 없는 기관은 기관 채용 공고 쪽의 공고문에서 직접 확인하세요.</p>
        {guides.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link href={guidePath(g.slug)} className="card card-link flex items-center justify-between gap-3 px-4 py-3.5">
                  <span>
                    <b className="block text-[15px] leading-snug">{g.org}</b>
                    <span className="num mt-0.5 block text-xs text-faint">{g.updated_at.slice(0, 10)} 기준</span>
                  </span>
                  <span aria-hidden className="text-faint">›</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-card border border-line bg-surface p-5 text-[14.5px] text-muted">첫 가이드를 준비하고 있습니다. <Link href="/jobs/org" className="text-brand">기관별 채용 이력</Link>에서 공고문을 먼저 보세요.</p>
        )}
      </section>

      <AdSlot name="page_bottom" />
      <PromoBanner placement="jobs" context="job" />
      <RelatedLinks items={jobsRelated()} />
    </div>
  );
}
