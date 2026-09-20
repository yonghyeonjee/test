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
import { HIRE_TEXT, STAGE_TEXT, detailOf, detectRole, stageOf } from "@/lib/jobRole";
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
  const role = detectRole(job.title, job.org);
  const detail = detailOf(job.title);
  return {
    ...(stale ? { robots: { index: false, follow: true } } : {}),
    title: `${job.title}${where ? ` — ${where} 채용` : " — 공공기관 채용"}`,
    description: role ? `${role.name} 자리입니다. ${jobSummary(job)}` : jobSummary(job),
    keywords: [
      job.org, job.region && `${job.region} 채용`, job.hire,
      role?.name, role && `${role.name} 채용`, detail && `${detail} 채용`,
      job.region && role && `${job.region} ${role.name}`,
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
  // 합격자 발표·면접 안내는 채용 공고가 아니다. 구글에 구인으로 내보내지 않는다.
  if (stageOf(job.title) === "final" || stageOf(job.title) === "interview") return null;
  const role = detectRole(job.title, job.org);
  return {
    "@type": "JobPosting",
    "@id": `${SITE_URL}/jobs/${encodeURIComponent(job.id)}#posting`,
    title: job.title,
    description: role ? `${role.name} 자리입니다. ${role.does} ${jobSummary(job)}` : jobSummary(job),
    ...(role ? { occupationalCategory: role.name } : {}),
    ...(role?.employment ? { employmentType: role.employment } : {}),
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
  const role = detectRole(job.title, job.org);
  // "무도실무관 (무도실무관)" 처럼 괄호 안이 직무 이름 그대로면 두 번 적지 않는다.
  const rawDetail = detailOf(job.title);
  const detail = rawDetail && rawDetail !== role?.name ? rawDetail : null;
  const stage = stageOf(job.title);
  const hireText = job.hire ? HIRE_TEXT[job.hire] : undefined;
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

      {/* 모집이 아닌 공고(합격자 발표·면접 안내)는 지원할 수 없다. 제일 먼저 말한다. */}
      {stage !== "open" && (
        <div className={`mt-5 rounded-card border-l-[3px] px-4 py-3 ${
          stage === "final" || stage === "interview"
            ? "border-alert bg-alertSoft/60" : "border-brand bg-brandSoft/50"}`}>
          <b className="block text-[14px] font-bold">{STAGE_TEXT[stage].label}</b>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink2">{STAGE_TEXT[stage].body}</p>
        </div>
      )}

      {/* 이 자리가 무슨 일인지. 제목에서 읽은 직무의 통례다 — 이 공고의 사실이 아니라는 것을 매번 적는다. */}
      <section className="mt-10">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">
          {role ? `${role.name}${detail ? ` (${detail})` : ""}, 어떤 일인가` : "이 자리는 어떤 채용인가"}
        </h2>
        {role ? (
          <>
            <p className="mt-4 text-[15px] leading-[1.85] text-ink2">{role.does}</p>
            <h3 className="mt-5 text-[14px] font-bold">이런 자리에서 대개 요구하는 것</h3>
            <ul className="mt-2 space-y-1.5 text-[14.5px] leading-relaxed text-ink2">
              {role.needs.map((n) => (
                <li key={n} className="flex gap-2.5">
                  <span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
            {role.licenses && role.licenses.length > 0 && (
              <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
                관련 국가자격:{" "}
                {role.licenses.map((q, i) => (
                  <span key={q}>
                    {i > 0 && " · "}
                    <Link href={`/license?q=${encodeURIComponent(q)}`}
                          className="underline underline-offset-4 hover:text-brand">{q}</Link>
                  </span>
                ))}
              </p>
            )}
          </>
        ) : (
          <p className="mt-4 text-[15px] leading-[1.85] text-ink2">
            제목만으로는 직무를 특정하기 어려운 공고입니다. 무슨 일을 맡는지는 원문 공고문의
            담당 업무 항목에 적혀 있습니다.
          </p>
        )}
        {hireText && (
          <p className="mt-4 text-[14.5px] leading-[1.85] text-ink2">
            <b className="font-bold">{job.hire} 채용의 절차.</b> {hireText}
          </p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-faint">
          위 설명은 이 직무의 일반적인 통례입니다. 이 공고의 실제 담당 업무·자격 요건·보수는
          기관이 올린 원문에만 있습니다.
        </p>
      </section>

      <AdSlot name="page_bottom" />

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">이 공고, 이렇게 보세요</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          {jobIntro(job).map((t) => <p key={t.slice(0, 24)}>{t}</p>)}
        </div>
      </section>

      {/* 바깥으로 나가는 단추는 읽을 것을 다 읽은 뒤에. 위에 두면 읽기 전에 나간다. */}
      <div className="mt-8 flex flex-wrap gap-2">
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

      <MidAd name="detail_mid" seed={job.id} context="job" />

      <Faq items={jobFaq(job, role)} />

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

      <AdSlot name="detail_bottom" tall />

      <GuideBanner />
      <PromoBanner placement="job-detail" context="job" />
      <RelatedLinks items={jobsRelated()} />
    </article>
  );
}
