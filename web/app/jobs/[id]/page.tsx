import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdSlot from "@/components/AdSlot";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import JsonLd from "@/components/JsonLd";
import MidAd from "@/components/MidAd";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { STATUS_LABEL } from "@/lib/db";
import { dot, getJob, getRelatedJobs, type Job } from "@/lib/pubJobs";
import { jobFaq, jobIntro, jobSummary } from "@/lib/jobText";
import { jobsRelated } from "@/lib/related";
import { pageGraph } from "@/lib/schema";
import { SITE_URL } from "@/lib/seo";

// 공고는 수만 건이라 미리 만들지 않는다. 처음 열릴 때 만들고 하루 동안 쓴다.
export const dynamicParams = true;
export const revalidate = 86400;
export function generateStaticParams() {
  return [];
}

type P = { params: { id: string } };

/** n일 전 날짜(YYYY-MM-DD). */
function ymdAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const job = await getJob(decodeURIComponent(params.id));
  if (!job) return { title: "채용 공고를 찾지 못했습니다", robots: { index: false, follow: true } };
  const where = [job.region, job.org].filter(Boolean).join(" ");
  // 2008년치까지 받아 오면 공고가 수십만 건이 된다. 오래전에 끝난 공고를
  // 전부 색인에 밀어 넣으면 검색엔진이 사이트 전체를 얕게 본다. 자료로는
  // 남겨 두되(들어오면 보인다), 1년 넘게 지난 것은 색인하지 않는다.
  const stale = Boolean(job.end && job.end < ymdAgo(365));
  return {
    ...(stale ? { robots: { index: false, follow: true } } : {}),
    title: `${job.title}${where ? ` — ${where} 채용` : " — 공공기관 채용"}`,
    description: jobSummary(job),
    keywords: [
      job.org, job.region && `${job.region} 채용`, job.hire,
      "공공기관 채용", "채용 공고", "나라일터",
    ].filter(Boolean) as string[],
    alternates: { canonical: `/jobs/${encodeURIComponent(job.id)}` },
  };
}

const Row = ({ k, v }: { k: string; v: string | null }) =>
  v ? (
    <div className="flex gap-3 border-b border-line py-2.5 last:border-b-0">
      <dt className="w-[5.5rem] shrink-0 text-[13px] text-muted">{k}</dt>
      <dd className="min-w-0 flex-1 text-[14.5px]">{v}</dd>
    </div>
  ) : null;

/**
 * 구글 채용 검색이 읽는 표시.
 *
 * 날짜와 기관만으로는 부족하다. 구글은 description 에 "직무·자격·근무조건"
 * 이 실제로 담기기를 요구하는데, 우리가 가진 것은 목록에서 긁은 몇 줄뿐이다.
 * 그래서 근무지·고용형태·모집인원 가운데 하나라도 있어 요약이 알맹이를
 * 갖출 때만 내보낸다. 빈 껍데기를 400건씩 내보내면 얻는 것보다 잃는 것이
 * 크다.
 */
function jobNode(job: Job) {
  if (!job.reg || !job.org) return null;
  if (!job.region && !job.hire && !job.headcount) return null;
  return {
    "@type": "JobPosting",
    "@id": `${SITE_URL}/jobs/${encodeURIComponent(job.id)}#posting`,
    title: job.title,
    description: jobSummary(job),
    datePosted: job.reg,
    ...(job.end ? { validThrough: job.end } : {}),
    hiringOrganization: { "@type": "Organization", name: job.org },
    ...(job.region
      ? {
          jobLocation: {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressRegion: job.region, addressCountry: "KR" },
          },
        }
      : {}),
    url: `${SITE_URL}/jobs/${encodeURIComponent(job.id)}`,
    identifier: { "@type": "PropertyValue", name: "나라일터", value: job.id },
    ...(job.headcount && /^\d+$/.test(job.headcount)
      ? { totalJobOpenings: Number(job.headcount) }
      : {}),
    // 우리 쪽에서 바로 지원할 수 없다. 원문으로 가야 한다.
    directApply: false,
  };
}

export default async function JobDetail({ params }: P) {
  const job = await getJob(decodeURIComponent(params.id));
  if (!job) notFound();
  const related = await getRelatedJobs(job);
  const ld = pageGraph({
    path: `/jobs/${encodeURIComponent(job.id)}`,
    name: job.title,
    description: jobSummary(job),
    dateModified: job.reg,
    // 화면 위 길잡이 그대로: 채용 · {지역}
    crumbs: [
      { name: "채용", path: "/jobs" },
      ...(job.region
        ? [{ name: job.region, path: `/jobs/region/${encodeURIComponent(job.region)}` }]
        : []),
      { name: job.title },
    ],
    about: jobNode(job),
  });

  return (
    <article className="pb-4">
      <JsonLd data={ld} />

      <nav aria-label="위치" className="mt-6 text-[13px] text-muted">
        <Link href="/jobs" className="hover:text-brand">채용</Link>
        {job.region && (
          <>
            {" · "}
            <Link href={`/jobs/region/${encodeURIComponent(job.region)}`} className="hover:text-brand">
              {job.region}
            </Link>
          </>
        )}
      </nav>

      <header className="mt-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {(job.start || job.end) && <span className="badge">{STATUS_LABEL[job.status]}</span>}
          {job.reg && <span className="num badge badge-quiet">{dot(job.reg)} 등록</span>}
          {job.hire && <span className="badge badge-quiet">{job.hire}</span>}
        </div>
        <h1 className="display mt-3 text-[1.5rem] leading-tight">{job.title}</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{jobSummary(job)}</p>
      </header>

      <dl className="card mt-6 p-5">
        <Row k="기관" v={job.org} />
        <Row k="근무 지역" v={job.region} />
        <Row k="고용 형태" v={job.hire} />
        <Row k="채용 구분" v={job.recruit} />
        <Row k="분야" v={job.sectors} />
        <Row k="모집 인원" v={job.headcount ? `${job.headcount}명` : null} />
        <Row k="접수 기간" v={job.start || job.end ? `${dot(job.start) ?? "—"} ~ ${dot(job.end) ?? "—"}` : null} />
        <Row k="등록일" v={dot(job.reg)} />
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={job.url ?? "https://www.gojobs.go.kr"}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary px-5 py-2.5"
        >
          {job.url ? "원문 공고 보기" : "나라일터에서 찾아보기"}
        </a>
        {job.region && (
          <Link href={`/jobs/region/${encodeURIComponent(job.region)}`} className="btn btn-ghost px-5 py-2.5">
            {job.region} 공고 더 보기
          </Link>
        )}
        {job.org && (
          <Link href={`/jobs/org/${encodeURIComponent(job.org)}`} className="btn btn-ghost px-5 py-2.5">
            {job.org} 채용 이력
          </Link>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        접수 방법·제출 서류·자격 요건은 기관이 올린 원문에만 있습니다. 마감일이 바뀌는 일도
        있으니 신청 전에 원문에서 한 번 더 확인하세요.
      </p>

      <AdSlot name="page_bottom" />

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">이 공고, 이렇게 보세요</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          {jobIntro(job).map((t) => <p key={t.slice(0, 24)}>{t}</p>)}
        </div>
      </section>

      <MidAd name="detail_mid" seed={job.id} context="job" />

      <Faq items={jobFaq(job)} />

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="sec-title text-[1.0625rem] font-extrabold">
            {job.org ? (
              <Link href={`/jobs/org/${encodeURIComponent(job.org)}`} className="hover:text-brand">
                {job.org}의 다른 공고
              </Link>
            ) : (
              "함께 보면 좋은 공고"
            )}
          </h2>
          <ul className="mt-4 grid gap-3">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={`/jobs/${encodeURIComponent(r.id)}`} className="card card-link block p-4">
                  <b className="block text-[14.5px] leading-snug">{r.title}</b>
                  <span className="mt-1 block text-[13px] text-muted">
                    {[r.org, r.region, r.end && `${dot(r.end)} 마감`].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <GuideBanner />
      <PromoBanner placement="job-detail" context="job" />
      <RelatedLinks items={jobsRelated()} />
    </article>
  );
}
