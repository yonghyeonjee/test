import type { Metadata } from "next";
import { IllusJobs } from "@/components/Illus";
import { withOg } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdSlot from "@/components/AdSlot";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import JobList from "@/components/JobList";
import JobsPulse from "@/components/JobsPulse";
import JsonLd from "@/components/JsonLd";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { getJobsByRegion } from "@/lib/pubJobs";
import { normSido } from "@/lib/geo";
import { jobCanonical, jobPath, jobRobots, jobRouteLabel, peekJobRoute, readJobRoute } from "@/lib/jobRoute";
import { jobsRelated } from "@/lib/related";
import { pageGraph } from "@/lib/schema";

// /jobs/region/서울특별시 · /jobs/region/서울특별시/hire/교육/page/2
// 세 시간. 조합이 수천 개라 15분마다 새로 그리면 캐시 저장(ISR Writes)이 크게 쌓였다. 채용은 하루 다섯 번 모은다.
export const revalidate = 10800;

type P = { params: { seg: string[] } };

/**
 * 지역 목록의 "지금 숫자". 제목·설명문·머리글이 같이 쓴다 — 같은 지역 목록을 둔 다른 사이트와 제목부터 다르고,
 * 날마다 바뀌어 다시 긁을 이유가 된다(2026-10-30). getJobsByRegion 은 cache() 라 쪽 본문과 한 번만 읽는다.
 */
async function regionFacts(sido: string) {
  const board = await getJobsByRegion(sido);
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() + 9 * 3600e3 - 7 * 86400e3).toISOString().slice(0, 10);
  const open = board.jobs.filter((j) => j.status !== "closed");
  const soon = open.filter((j) => j.end && j.end >= today && j.end <= new Date(Date.parse(today) + 7 * 86400e3).toISOString().slice(0, 10)).length;
  const fresh = board.jobs.filter((j) => j.reg && j.reg >= weekAgo).length;
  const byOrg = new Map<string, number>();
  for (const j of open) if (j.org) byOrg.set(j.org, (byOrg.get(j.org) ?? 0) + 1);
  const topOrgs = [...byOrg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const byHire = new Map<string, number>();
  for (const j of open) if (j.hire) byHire.set(j.hire, (byHire.get(j.hire) ?? 0) + 1);
  const topHire = [...byHire.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  return { board, openN: open.length, soon, fresh, topOrgs, topHire };
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const r = peekJobRoute(["region"], params.seg);
  const sido = r.region!;
  const extra = jobRouteLabel(r).filter((v) => v !== sido);
  const tail = r.page > 1 ? ` (${r.page}쪽)` : "";
  const f = normSido(sido) && r.page === 1 && !extra.length ? await regionFacts(sido).catch(() => null) : null;
  const facts = f && f.openN > 0
    ? [`접수 중 ${f.openN}건`, f.soon ? `이번 주 마감 ${f.soon}건` : null, f.fresh ? `새 공고 ${f.fresh}건` : null].filter(Boolean).join(" · ")
    : null;
  const orgNote = f && f.topOrgs.length ? ` ${f.topOrgs.map(([o, n]) => `${o} ${n}건`).join(", ")} 순으로 많이 뽑고` : "";
  const hireNote = f?.topHire ? ` ${f.topHire[0]}이 ${f.topHire[1]}건으로 가장 많습니다.` : "";
  return withOg({
    title: facts
      ? `${sido} 공공기관 채용공고 — ${facts}`
      : `${sido} 공공기관 채용 공고${extra.length ? ` — ${extra.join(" · ")}` : " — 접수 중인 자리부터"}${tail}`,
    description: facts
      ? `${sido} 공공기관·지자체 채용 공고 ${facts}.${orgNote}${hireNote} 나라일터·잡알리오 공고를 하루 다섯 번 모아 마감 가까운 순으로 보여 줍니다.`
      : `${sido}에서 뽑는 공공기관·지자체 채용 공고를 모았습니다. 접수 중인 것이 앞에 오고 ` +
        "마감이 가까운 순서로 정렬합니다. 회원가입 없이 바로 볼 수 있습니다.",
    keywords: [`${sido} 채용`, `${sido} 공공기관 채용`, `${sido} 공무직`, "지자체 채용공고"],
    alternates: { canonical: jobCanonical(r) },
    robots: jobRobots(r),
  });
}

export default async function JobsByRegion({ params }: P) {
  const route = readJobRoute(["region"], params.seg);
  if (!route) notFound();
  const sido = route.region!;
  // 시·도가 아닌 이름("해외" 등)은 지역 쪽이 없다. 예전에는 두 글자로 전체를 훑어 2.5초가 걸리고 엉뚱한 공고가 나왔다.
  if (!normSido(sido)) notFound();
  const f = await regionFacts(sido);
  const { board, openN } = f;

  return (
    <div className="pb-4">
      <PageBanner tone="blue"
        eyebrow={`채용 · ${sido}`}
        title={`${sido}에서 뽑는 자리`}
        sub={`${sido}에 있는 공공기관과 지자체가 낸 채용 공고입니다. 접수 중인 것이 앞에 옵니다.`}
        art={<IllusJobs />}
      >
        {board.ok && (
          <p className="num mt-4 text-sm text-muted">
            최근 {board.total.toLocaleString()}건 · 접수 중 {openN.toLocaleString()}건
            {f.soon > 0 && <> · 이번 주 마감 {f.soon}건</>}
            {f.fresh > 0 && <> · 7일 안 새 공고 {f.fresh}건</>}
          </p>
        )}
        {/* 이 지역만의 지금 사실. 목록을 그대로 실은 사이트에는 없는 문장이라 쪽 앞머리에 둔다(2026-10-30). */}
        {board.ok && f.topOrgs.length > 0 && (
          <p className="mt-2 max-w-[40rem] text-[14px] leading-relaxed text-ink2">
            지금 {sido}에서 가장 많이 뽑는 곳은 {f.topOrgs.map(([o, n], i) => (
              <span key={o}>{i > 0 && ", "}<Link href={`/jobs/org/${encodeURIComponent(o)}`} className="font-semibold underline-offset-2 hover:underline">{o}</Link> {n}건</span>
            ))}입니다.
            {f.topHire && <> 고용 형태는 {f.topHire[0]}이 {f.topHire[1]}건으로 가장 많습니다.</>}
          </p>
        )}
      </PageBanner>

      <JsonLd
        data={pageGraph({
          path: jobPath(route),
          name: `${sido} 공공기관 채용 공고`,
          collection: true,
          crumbs: [
            { name: "채용", path: "/jobs" },
            { name: "지역별", path: "/jobs/region" },
            { name: sido },
          ],
        })}
      />
      <nav aria-label="위치" className="mt-6 text-[13px] text-muted">
        <Link href="/jobs" className="hover:text-brand">채용</Link>
        {" · "}
        <Link href="/jobs/region" className="hover:text-brand">지역별</Link>
        {" · "}
        <span className="text-ink2">{sido}</span>
      </nav>

      <JobList board={board} route={route} />
      {route.page === 1 && !route.hire && <JobsPulse jobs={board.jobs} scope={sido} />}

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
            a: "있습니다. 인사혁신처 나라일터와 잡알리오(공공기관 채용정보시스템)에 올라온 것을 모읍니다. 개별 기관 홈페이지에만 올리는 공고도 있으니, 가고 싶은 기관이 정해져 있다면 그 기관 채용 게시판도 같이 보세요.",
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
