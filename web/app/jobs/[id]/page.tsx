import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdSlot from "@/components/AdSlot";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import JobGone from "@/components/JobGone";
import JsonLd from "@/components/JsonLd";
import MidAd from "@/components/MidAd";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import RecentTracker from "@/components/RecentTracker";
import OrgMark from "@/components/OrgMark";
import Glyph, { fileGlyph } from "@/components/Glyph";
import CalendarAdd from "@/components/CalendarAdd";
import TopStripAd from "@/components/TopStripAd";
import MiniMap from "@/components/MiniMap";
import { jobEvents } from "@/lib/calEvents";
import { locateJob } from "@/lib/geo";
import { STATUS_LABEL } from "@/lib/db";
import { getGuideByOrg, guidePath } from "@/lib/guides";
import { dot, findJobSource, getJob, getJobAttach, getOrgStat, getRelatedJobs, peakMonths, type Job } from "@/lib/pubJobs";
import { jobFaq, jobIntro, jobSummary } from "@/lib/jobText";
import { HIRE_TEXT, STAGE_TEXT, detailOf, detectRole, stageOf } from "@/lib/jobRole";
import { employmentFromTitle, jobLocation } from "@/lib/jobSchema";
import { jobsRelated } from "@/lib/related";
import { pageGraph } from "@/lib/schema";
import { SITE_URL, withOg } from "@/lib/seo";
import { getStory } from "@/lib/stories";

// 공고는 수만 건이라 미리 만들지 않는다. 처음 열릴 때 만들고 하루 동안 쓴다.
export const dynamicParams = true;
// 사흘(예전 하루). 공고 수천 개를 매일 새로 그리면 캐시 저장(ISR Writes)이 무료 한도를 넘었다. 날짜는 절대 날짜로만 적는다.
export const revalidate = 259200;
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

/** "대법원 수원지방법원 안산지원" → "수원지방법원 안산지원". 상위 기관은 뺀다. */
function orgShort(org: string | null) {
  if (!org) return "";
  const t = org.trim().split(/\s+/);
  return t.length >= 3 ? t.slice(-2).join(" ") : org;
}

/**
 * 검색 결과 제목. 공고 이름을 그대로 쓰면 korea.kr·나라일터와 글자까지 같은
 * 제목이 되어 정부 사이트 아래로 밀린다. 사람이 치는 말(기관·직무·단계)로
 * 다시 짓고, 우리만 가진 것(접수 기간·다음 채용 시기)을 뒤에 붙인다.
 * 원래 공고 이름은 h1 과 설명문에 그대로 남긴다.
 */
function seoJobTitle(job: Job, role: ReturnType<typeof detectRole>, detail: string | null, stage: ReturnType<typeof stageOf>) {
  const org = orgShort(job.org);
  const subject = detail ?? role?.name ?? "";
  const kind = /공무직|무기계약/.test(job.title) ? "공무직" : /기간제/.test(job.title) ? "기간제" : /임기제/.test(job.title) ? "임기제" : /인턴/.test(job.title) ? "인턴" : "";
  const head = [org, subject, kind].filter(Boolean).join(" ");
  if (!head) return `${job.title} — 공공기관 채용`;
  const stageLabel = { final: "최종합격자 발표", interview: "면접·서류합격 안내", plan: "채용 계획", repost: "재공고", open: "채용" }[stage];
  const hook =
    stage === "final" || stage === "interview" ? "제출서류와 다음 채용 시기"
    : job.end ? `${dot(job.end)} 마감, 접수 방법과 자격`
    : job.region ? `${job.region} 공공기관 채용` : "접수 기간과 자격";
  return `${head} ${stageLabel} — ${hook}`.replace(/\s+/g, " ").trim();
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const job = await getJob(decodeURIComponent(params.id));
  // 없는 번호. 쪽은 JobGone 이 지금 접수 중인 공고로 채운다.
  if (!job) return withOg({
    title: "내려간 채용 공고 — 지금 접수 중인 공공기관 채용",
    description: "이 공고는 마감되어 목록에서 내려갔거나 주소가 바뀌었습니다. 지금 접수 중인 공공기관 채용 공고를 대신 보여 드립니다.",
    robots: { index: false, follow: true },
  });
  // 2008년치까지 받아 오면 공고가 수십만 건이 된다. 오래전에 끝난 공고를
  // 전부 색인에 밀어 넣으면 검색엔진이 사이트 전체를 얕게 본다. 자료로는
  // 남겨 두되(들어오면 보인다), 1년 넘게 지난 것은 색인하지 않는다.
  const stale = Boolean(job.end && job.end < ymdAgo(365));
  const role = detectRole(job.title, job.org);
  const rawDetail = detailOf(job.title);
  const detail = rawDetail && rawDetail !== role?.name ? rawDetail : null;
  const stage = stageOf(job.title);
  const attach = await getJobAttach(job.id);
  // 설명문은 검색 결과에 160자쯤만 보인다. 파일 이름이 길면 앞의 것만.
  const names = attach ? attach.files.slice(0, 3).map((f) => f.name.replace(/\.[a-z0-9]+$/i, "")) : [];
  const fileNote = attach && attach.files.length
    ? ` 첨부 ${attach.files.length}개: ${names.join(", ").slice(0, 90)}${attach.files.length > 3 || names.join(", ").length > 90 ? " 등" : ""}.`
    : "";
  return withOg({
    ...(stale ? { robots: { index: false, follow: true } } : {}),
    title: seoJobTitle(job, role, detail, stage),
    // 설명문은 공고 이름으로 시작한다 — 이름 그대로 치는 검색에도 걸리게.
    description: `${job.title}. ${role ? `${role.name} 자리입니다. ` : ""}${jobSummary(job)}${fileNote}`,
    keywords: [
      job.org, job.region && `${job.region} 채용`, job.hire,
      role?.name, role && `${role.name} 채용`, detail && `${detail} 채용`,
      job.region && role && `${job.region} ${role.name}`,
      "공공기관 채용", "채용 공고", "나라일터",
    ].filter(Boolean) as string[],
    alternates: { canonical: `/jobs/${encodeURIComponent(job.id)}` },
  });
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
  const employment = role?.employment ?? employmentFromTitle(job.title);
  return {
    "@type": "JobPosting",
    "@id": `${SITE_URL}/jobs/${encodeURIComponent(job.id)}#posting`,
    title: job.title,
    description: role ? `${role.name} 자리입니다. ${role.does} ${jobSummary(job)}` : jobSummary(job),
    ...(role ? { occupationalCategory: role.name } : {}),
    ...(employment ? { employmentType: employment } : {}),
    datePosted: job.reg,
    ...(job.end ? { validThrough: job.end } : {}),
    hiringOrganization: { "@type": "Organization", name: job.org },
    // 지역이 비어도 근무지를 뺄 수 없다 — 구글이 공고 자체를 무효로 친다.
    jobLocation: jobLocation(job),
    url: `${SITE_URL}/jobs/${encodeURIComponent(job.id)}`,
    identifier: { "@type": "PropertyValue", name: sourceName(job.id), value: job.id },
    ...(job.headcount && /^\d+$/.test(job.headcount)
      ? { totalJobOpenings: Number(job.headcount) }
      : {}),
    // 우리 쪽에서 바로 지원할 수 없다. 원문으로 가야 한다.
    directApply: false,
  };
}

export default async function JobDetail({ params }: P) {
  const id = decodeURIComponent(params.id);
  const job = await getJob(id);
  if (!job) {
    // 해외채용(월드잡) 번호로 들어온 것은 그쪽 목록으로. 나머지는
    // 지금 접수 중인 공고로 채운 쪽(JobGone 참고).
    const src = await findJobSource(id).catch(() => null);
    if (src === "worldjob") redirect("/jobs/overseas");
    return <JobGone />;
  }
  const [related, stat, attach, guide] = await Promise.all([
    getRelatedJobs(job),
    job.org ? getOrgStat(job.org) : Promise.resolve(null),
    getJobAttach(job.id),
    getGuideByOrg(job.org),
  ]);
  const story = job.org ? await getStory(`org-${job.org.replace(/[^0-9A-Za-z가-힣]+/g, "-").replace(/^-|-$/g, "")}`) : null;
  const peak = stat ? peakMonths(stat.months) : null;
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
      <RecentTracker kind="job" id={job.id} title={job.title} sub={orgShort(job.org) || job.region || undefined} />

      <nav aria-label="위치" className="mt-6 text-[13px] text-muted">
        <Link href="/jobs" className="inline-block py-1 hover:text-brand">채용</Link>
        {job.region && (
          <>
            {" · "}
            <Link href={`/jobs/region/${encodeURIComponent(job.region)}`} className="inline-block py-1 hover:text-brand">
              {job.region}
            </Link>
          </>
        )}
      </nav>

      <header className="mt-2 flex items-start gap-4">
        <OrgMark org={job.org} hire={job.hire} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {(job.start || job.end) && <span className="badge">{STATUS_LABEL[job.status]}</span>}
            {job.reg && <span className="num badge badge-quiet">{dot(job.reg)} 등록</span>}
            {job.hire && <span className="badge badge-quiet">{job.hire}</span>}
          </div>
          <h1 className="display mt-3 text-[1.5rem] leading-tight">{job.title}</h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{jobSummary(job)}</p>
        </div>
      </header>

      <TopStripAd className="mt-5" />

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

      {/* 접수 마감을 캘린더에, 기관 자리는 지도에. 합격자 발표·면접 공고에는 마감이 없다. */}
      {(() => {
        const events = stage === "final" || stage === "interview" ? [] : jobEvents(job);
        const place = locateJob(job);
        if (!events.length && !place) return null;
        return (
          <section className="mt-5 grid gap-3">
            {events.length > 0 && (
              <div className="card flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <span className="min-w-0 flex-1 text-[14px] leading-snug">
                  <b>{job.end ? `접수 마감 ${dot(job.end)}` : `접수 ${dot(job.start)}`}</b>
                  <span className="text-muted"> — 내 캘린더에 담아 두면 놓치지 않습니다.</span>
                </span>
                <CalendarAdd events={events} file={job.title} />
              </div>
            )}
            {place && (
              <MiniMap lat={place.lat} lng={place.lng} label={place.label} approx={place.approx}
                       query={job.org ?? job.title} kind="jobs" />
            )}
          </section>
        );
      })()}

      {/* 모집이 아닌 공고(합격자 발표·면접 안내)는 지원할 수 없다. 제일 먼저 말한다. */}
      {stage !== "open" && (
        <div className={`mt-5 rounded-card border-l-[3px] px-4 py-3 ${
          stage === "final" || stage === "interview"
            ? "border-alert bg-alertSoft/60" : "border-brand bg-brandSoft/50"}`}>
          <b className="block text-[14px] font-bold">{STAGE_TEXT[stage].label}</b>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink2">{STAGE_TEXT[stage].body}</p>
        </div>
      )}

      {/* 첨부(공고문·양식). 정책브리핑 또는 나라일터 상세에서 읽어 둔 것. 사람이 제일 먼저 찾는 것이라 위에 둔다.
          바깥으로 나가는 "원문 보기" 는 맨 아래 — 읽기 전에 나가지 않게. */}
      {attach && (attach.files.length > 0 || attach.grade || attach.workArea) && (
        <section className="card mt-6 p-5" id="files">
          <h2 className="text-[15px] font-extrabold">
            첨부파일 <span className="num ml-1 text-[13px] font-semibold text-muted">{attach.files.length}개</span>
          </h2>
          {(attach.grade || attach.workArea) && (
            <p className="mt-2 text-[13.5px] text-ink2">
              {attach.grade && <>채용직급 <b>{attach.grade}</b></>}
              {attach.grade && attach.workArea && " · "}
              {attach.workArea && <>근무지역 <b>{attach.workArea}</b></>}
            </p>
          )}
          <ol className="mt-3 divide-y divide-line">
            {attach.files.map((f, i) => (
              <li key={f.dl} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                <span className={`inline-flex h-7 items-center gap-1 rounded-[8px] px-1.5 text-[11px] font-extrabold uppercase ${
                  f.ext === "pdf" ? "bg-alertSoft text-alert" : f.ext === "hwp" || f.ext === "hwpx" ? "bg-brandSoft text-brand" : "bg-surface2 text-muted"}`}>
                  <Glyph name={fileGlyph(f.ext)} className="h-4 w-4" strokeWidth={2.2} />{f.ext || "파일"}
                </span>
                <span className="min-w-0 flex-1 break-all text-[14px] leading-snug text-ink">
                  <span className="num mr-1 text-muted">{i + 1}.</span>{f.name}
                </span>
                <span className="flex shrink-0 gap-1.5">
                  {f.view && <a href={f.view} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-ghost px-3 py-1.5 text-[13px]">바로보기</a>}
                  <a href={f.dl} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-primary px-3 py-1.5 text-[13px]">내려받기</a>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-faint">
            {attach.from === "korea" ? (
              <>파일은 <a href={attach.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-brand">대한민국 정책브리핑(korea.kr)</a>에 기관이 올린 원본으로 바로 이어집니다.</>
            ) : (
              <>파일은 <a href={attach.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-brand">나라일터 원문 공고</a>에 기관이 올린 원본으로 바로 이어집니다.</>
            )}
            {" "}HWP 는 한글 또는 한컴 뷰어로 엽니다.
          </p>
        </section>
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

      {/* 본문 중간 광고. 공고 요약·첨부·직무 설명을 읽은 다음, 읽는 길 가운데에 하나만 둔다.
          예전엔 맨 아래 광고(detail_bottom) 바로 위에 있어, 켜면 둘이 붙었다(2026-10-08 옮김). */}
      <MidAd name="detail_mid" seed={job.id} context="job" className="mt-12" />

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">이 공고, 이렇게 보세요</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          {jobIntro(job).map((t) => <p key={t.slice(0, 24)}>{t}</p>)}
        </div>
        {guide && (
          <Link href={guidePath(guide.slug)} className="card card-link mt-4 flex items-center justify-between gap-3 border-brand/30 bg-brandSoft/40 px-5 py-4">
            <span>
              <span className="text-[12px] font-bold text-brand">작성 가이드</span>
              <b className="mt-0.5 block text-[15px] leading-snug">{guide.org} 자기소개서·직무수행계획서 작성법</b>
            </span>
            <span aria-hidden className="text-faint">›</span>
          </Link>
        )}
      </section>

      {/* 이 기관이 언제·얼마나 뽑는지. 공고 원문을 그대로 실은 사이트에는 없는
          것이라 이 쪽이 따로 설 자리가 된다. 합격자 발표 쪽에서는 "다음 공고는
          언제쯤"이 곧 답이다. */}
      {stat && stat.n >= 5 && (
        <section className="mt-12">
          <h2 className="sec-title text-[1.0625rem] font-extrabold">
            {orgShort(job.org)}{stage === "final" || stage === "interview" ? ", 다음 채용은 언제쯤" : "은 얼마나 자주 뽑나"}
          </h2>
          <p className="mt-4 text-[15px] leading-[1.85] text-ink2">
            <strong>{job.org}</strong>{stat.firstReg ? `은 ${stat.firstReg.slice(0, 4)}년부터 지금까지` : "은"} 나라일터에
            공고 <strong className="num">{stat.n.toLocaleString("ko-KR")}건</strong>을 올렸습니다.
            {stat.avgDays !== null && <> 접수 기간은 평균 <strong className="num">{stat.avgDays}일</strong>입니다.</>}
            {peak ? <> 공고는 <strong>{peak.label}</strong>에 {peak.share}%가 몰립니다.</> : " 특정 달에 몰리지 않고 연중 올라옵니다."}
            {stat.openN > 0 && <> 지금 접수 중인 공고가 <strong className="num">{stat.openN}건</strong> 있습니다.</>}
            {stat.lastReg && <> 마지막 공고는 {dot(stat.lastReg)}에 올라왔습니다.</>}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/jobs/org/${encodeURIComponent(job.org!)}`} className="chip">{orgShort(job.org)} 채용 이력 전체</Link>
            {story && <Link href={`/story/${encodeURIComponent(story.slug)}`} className="chip">{orgShort(job.org)} 채용 시기 분석 글</Link>}
            {role && <Link href={`/jobs/q/${encodeURIComponent(role.name.split("·")[0])}`} className="chip">다른 기관의 {role.name} 채용</Link>}
          </div>
        </section>
      )}

      {/* 바깥으로 나가는 단추는 읽을 것을 다 읽은 뒤에. 위에 두면 읽기 전에 나간다. */}
      <div className="mt-8 flex flex-wrap gap-2">
        <a
          href={job.url ?? "https://www.gojobs.go.kr"}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary px-5 py-2.5"
        >
          {job.url ? `원문 공고 보기(${sourceName(job.id)})` : "나라일터에서 찾아보기"}
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

      <Faq items={jobFaq(job, role)} />

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="sec-title text-[1.0625rem] font-extrabold">
            {job.org ? (
              <Link href={`/jobs/org/${encodeURIComponent(job.org)}`} className="inline-block py-1 hover:text-brand">
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

/** 공고를 가져온 곳. 잡알리오 공고는 번호가 a 로 시작한다(lib/alioJobs). */
function sourceName(id: string): string {
  return id.startsWith("a") ? "잡알리오" : "나라일터";
}
