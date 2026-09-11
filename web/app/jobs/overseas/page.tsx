import type { Metadata } from "next";
import Link from "next/link";
import { ArtJobs } from "@/components/Art";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import JobsTabs from "@/components/JobsTabs";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { STATUS_LABEL } from "@/lib/db";
import { dot } from "@/lib/pubJobs";
import { OVERSEAS_FAQ } from "@/lib/pageFaq";
import { jobsRelated } from "@/lib/related";
import { getOverseasJobs, nationFacet } from "@/lib/worldjob";

export const metadata: Metadata = {
  title: "해외취업 우수일자리 — 국가·직종별 월드잡플러스 공고",
  description:
    "한국산업인력공단이 우수일자리로 고른 해외 채용 공고를 국가와 직종, 경력으로 걸러 봅니다. " +
    "필수 언어와 비자 종류를 함께 표시합니다.",
  keywords: ["해외취업", "해외취업 공고", "월드잡플러스", "일본 취업", "해외 우수일자리"],
  alternates: { canonical: "/jobs/overseas" },
};

type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v) || undefined;
const BADGE: Record<string, string> = {
  ongoing: "badge-open", always: "badge-open", upcoming: "badge-soon", closed: "badge-closed",
};

function href(cur: { nation?: string; q?: string; career?: string }, patch: Partial<typeof cur>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/jobs/overseas?${s}` : "/jobs/overseas";
}

export default async function Overseas({ searchParams }: { searchParams: SP }) {
  const cur = { nation: one(searchParams.nation), q: one(searchParams.q), career: one(searchParams.career) };
  // 국가 목록은 전체에서 뽑아야 한다. 국가로 거른 결과에서 뽑으면 칩이 하나만 남는다.
  const [all, board] = await Promise.all([
    getOverseasJobs(),
    cur.nation || cur.q ? getOverseasJobs(cur.nation, cur.q) : null,
  ]);
  const src = board ?? all;
  const jobs = src.jobs.filter((j) => !cur.career || j.career === cur.career);
  const nations = nationFacet(all.jobs);
  const open = all.jobs.filter((j) => j.status !== "closed").length;

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="채용"
        title="해외취업, 공단이 고른 자리부터"
        sub="한국산업인력공단이 근로조건과 비자를 확인해 우수일자리로 올린 해외 채용 공고입니다. 국가와 직종으로 걸러 보세요."
        art={<ArtJobs />}
      >
        {all.ok && (
          <div className="mt-7 grid grid-cols-3 gap-3">
            {[
              { n: open, label: "접수 중" },
              { n: all.jobs.length, label: "우수일자리" },
              { n: nations.length, label: "국가" },
            ].map((b) => (
              <div key={b.label} className="rounded-card bg-white/10 px-3 py-3 text-center">
                <b className="num block text-[1.35rem] font-extrabold text-white">{b.n.toLocaleString()}</b>
                <span className="mt-0.5 block text-[11.5px] text-white/70">{b.label}</span>
              </div>
            ))}
          </div>
        )}
      </PageBanner>
      <JobsTabs active="/jobs/overseas" />

      {!all.ok ? (
        <div className="card mt-6 p-8 text-center">
          <p className="leading-relaxed text-muted">
            지금은 해외취업 공고를 불러오지 못했습니다.
            <br />잠시 뒤 다시 들어오시면 보입니다.
          </p>
          <a href="https://www.worldjob.or.kr" target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-5">
            월드잡플러스에서 직접 보기
          </a>
        </div>
      ) : (
        <div className="mt-6">
          <form action="/jobs/overseas" method="get" className="flex gap-2">
            {cur.nation && <input type="hidden" name="nation" value={cur.nation} />}
            {cur.career && <input type="hidden" name="career" value={cur.career} />}
            <input name="q" defaultValue={cur.q ?? ""} placeholder="공고명으로 찾기 (예: 엔지니어)"
                   className="field min-w-0 flex-1" aria-label="공고명 검색어" />
            <button type="submit" className="btn btn-primary shrink-0 px-5 py-2.5">찾기</button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {["신입", "경력"].map((c) => (
              <Link key={c} href={href(cur, { career: cur.career === c ? undefined : c })}
                    className={`chip ${cur.career === c ? "chip-on" : ""}`}>{c}</Link>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-[13px]">
            {nations.slice(0, 24).map((n) => (
              <Link key={n.v} href={href(cur, { nation: cur.nation === n.v ? undefined : n.v })}
                    className={`transition-colors hover:text-brand ${cur.nation === n.v ? "font-bold text-brand" : "text-muted"}`}>
                {n.v}<span className="num ml-1 text-[11px] text-faint">{n.n}</span>
              </Link>
            ))}
          </div>

          <div className="mb-3 mt-8 flex items-baseline justify-between">
            <h2 className="text-[1.0625rem] font-bold">{cur.nation || cur.q || cur.career ? "조건에 맞는 공고" : "최근 공고"}</h2>
            <span className="num text-sm text-muted">{jobs.length}건</span>
          </div>
          {jobs.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="leading-relaxed text-muted">조건에 맞는 공고가 없습니다.</p>
              <Link href="/jobs/overseas" className="btn btn-ghost mt-5">조건 지우기</Link>
            </div>
          ) : (
            <ul className="grid gap-3">
              {jobs.map((j) => (
                <li key={j.id} className="card p-5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`badge ${BADGE[j.status]}`}>{STATUS_LABEL[j.status]}</span>
                    {j.nation && <span className="badge badge-new">{j.nation}</span>}
                    {j.career && <span className="badge badge-quiet">{j.career}</span>}
                    {j.visa && <span className="badge badge-quiet">{j.visa}</span>}
                  </div>
                  <b className="mt-2 block text-[15px] leading-snug">{j.title}</b>
                  <span className="mt-1 block text-[13px] text-muted">
                    {[j.company, j.job, j.industry, j.headcount && `${j.headcount}명`].filter(Boolean).join(" · ")}
                  </span>
                  {j.lang && <span className="mt-1 block text-[13px] text-ink2">언어 {j.lang}</span>}
                  {(j.start || j.end) && (
                    <span className="num mt-1.5 block text-xs text-muted">모집 {dot(j.start) ?? "—"} ~ {dot(j.end) ?? "—"}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted">
            공고 원문과 지원은 월드잡플러스(worldjob.or.kr)에서 공고명으로 찾으시면 됩니다.
            공단 자료를 여섯 시간마다 받아 옵니다.
          </p>
        </div>
      )}

      <section className="mt-14">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">우수일자리라는 말의 뜻</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            해외취업 공고는 인터넷에 넘치지만 근로조건이 공고와 다르거나 비자가 나오지 않는 경우가
            잦습니다. 산업인력공단은 월드잡플러스에 올라온 공고 가운데 임금·근로시간·비자 조건을
            확인한 것만 우수일자리로 따로 표시합니다. 여기 목록은 그 표시가 붙은 것만 모은 것입니다.
            공고가 적어 보이는 이유가 그것입니다.
          </p>
          <p>
            국가를 고르면 언어 요건이 보입니다. 일본은 일본어 상급을 요구하는 곳이 대부분이고,
            싱가포르·미국은 영어가 기본입니다. 비자 항목은 취업비자인지 워킹홀리데이인지를
            보여 주는데, 워킹홀리데이는 기간이 정해져 있어 장기 근무를 생각하신다면 취업비자
            공고를 보셔야 합니다.
          </p>
          <p>
            해외취업 준비 비용을 지원하는 제도가 따로 있습니다. 공단의 K-Move 스쿨은 어학과 직무
            연수를 무료로 제공하고, 취업에 성공하면 정착지원금을 주는 사업도 있습니다. 사는 곳과
            나이를 넣고 조회하시면 청년 해외취업 지원 사업이 있는지 같이 나옵니다.
          </p>
        </div>
      </section>

      <Faq items={OVERSEAS_FAQ} />

      <GuideBanner title="취업을 준비하신다면 이것도" />
      <RelatedLinks items={jobsRelated()} />
      <PromoBanner placement="jobs-overseas" context="job" />
    </div>
  );
}
