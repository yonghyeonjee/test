import type { Metadata } from "next";
import Link from "next/link";
import { ArtJobs } from "@/components/Art";
import AdSlot from "@/components/AdSlot";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import PageBanner from "@/components/PageBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { dot, getJobOverview, getTopOrgs } from "@/lib/pubJobs";
import { jobsRelated } from "@/lib/related";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "기관별 공공기관 채용 이력 — 어디가 얼마나 자주 뽑나",
  description:
    "나라일터에 올라온 공공기관·지자체 채용 공고를 기관별로 모았습니다. 기관마다 지금까지 " +
    "낸 공고 수, 마지막으로 뽑은 날짜, 접수 기간이 며칠이었는지를 함께 봅니다.",
  keywords: [
    "공공기관 채용 이력",
    "기관별 채용공고",
    "공공기관 채용 주기",
    "부처별 채용",
    "나라일터 기관별",
  ],
  alternates: { canonical: "/jobs/org" },
};

export default async function JobOrgIndex() {
  const [orgs, overview] = await Promise.all([getTopOrgs(300), getJobOverview()]);

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="채용 · 기관별"
        title="어느 기관이 얼마나 자주 뽑나"
        sub="모아 둔 공고를 기관별로 묶었습니다. 이미 끝난 공고는 지원할 수 없지만, 그 기관이 얼마나 자주 뽑고 접수를 며칠 받는지는 알려 줍니다."
        art={<ArtJobs />}
      >
        {overview && (
          <p className="num mt-4 text-sm text-white/80">
            {overview.firstReg?.slice(0, 4)}~{overview.lastReg?.slice(0, 4)}년 공고{" "}
            {overview.total.toLocaleString()}건 · 기관 {overview.orgs.toLocaleString()}곳
          </p>
        )}
      </PageBanner>

      <nav aria-label="위치" className="mt-6 text-[13px] text-muted">
        <Link href="/jobs" className="hover:text-brand">채용</Link>
        {" · "}
        <span className="text-ink2">기관별</span>
      </nav>

      {orgs.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="leading-relaxed text-muted">아직 기관별로 묶을 만큼 모이지 않았습니다.</p>
          <Link href="/jobs" className="btn btn-ghost mt-5">채용 공고 보기</Link>
        </div>
      ) : (
        <>
          <p className="mt-6 text-[14px] leading-[1.8] text-ink2">
            공고를 여덟 건 이상 낸 기관만 추렸습니다. 한두 건만 낸 곳까지 넣으면 볼 것이 없는
            쪽이 수천 개 생깁니다. 숫자는 <b>지금까지 모인 공고</b> 기준이라, 나라일터에 올리지
            않고 기관 홈페이지에만 올린 공고는 빠져 있습니다.
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {orgs.map((o) => (
              <li key={o.org}>
                <Link href={`/jobs/org/${encodeURIComponent(o.org)}`}
                      className="card card-link block p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <b className="text-[15px] leading-snug">{o.org}</b>
                    <span className="num shrink-0 text-[13px] text-muted">{o.n.toLocaleString()}건</span>
                  </div>
                  <span className="mt-1.5 block text-[12.5px] text-muted">
                    {o.openN > 0 && <b className="text-brand">접수 중 {o.openN}건 · </b>}
                    마지막 공고 {dot(o.lastReg) ?? "—"}
                    {o.avgDays != null && ` · 접수 평균 ${o.avgDays}일`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <AdSlot name="page_bottom" />

      <section className="mt-14">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">마감된 공고를 왜 남겨 두나</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            끝난 공고는 지원할 수 없습니다. 그래도 남겨 두는 이유는, 한 건씩 볼 때는 안 보이던
            것이 모아 놓으면 보이기 때문입니다. 가고 싶은 기관이 정해져 있다면 그 기관이 한 해에
            몇 건을 냈는지, 마지막으로 뽑은 게 언제인지가 준비 일정을 잡는 기준이 됩니다.
          </p>
          <p>
            접수 기간은 특히 그렇습니다. 지금까지 모인 공고를 세어 보면 등록일부터 마감일까지
            중앙값이 아흐레였습니다. 어떤 기관은 닷새 만에 닫습니다. 공고를 보고 나서 서류를
            준비하면 늦는다는 뜻입니다. 자격증 사본과 경력증명서를 미리 갖춰 두시라는 말이
            여기서 나옵니다.
          </p>
          <p>
            다만 지금 모여 있는 과거 공고는 오래된 것이 많습니다. 기관 이름이 그사이 바뀐 곳도
            있고, 아예 없어진 부처도 있습니다. 그래서 기관 쪽마다 <b>언제부터 언제까지 몇 건
            기준</b>인지를 같이 적어 두었습니다. 그 기간을 보고 판단하시면 됩니다.
          </p>
        </div>
      </section>

      <Faq
        items={[
          {
            q: "여기 숫자로 다음 채용 시기를 알 수 있나요?",
            a: "정확히는 어렵습니다. 공고가 충분히 쌓인 기관은 주로 올라오는 달이 보이지만, 대부분은 열두 달에 고르게 퍼져 있습니다. 그래서 근거가 약한 기관에는 아무 말도 적지 않습니다. 확실한 것은 마지막 공고 날짜와 접수 기간뿐입니다.",
          },
          {
            q: "우리 기관이 목록에 없습니다.",
            a: "모인 공고가 여덟 건이 안 되면 목록에 넣지 않습니다. 채용 목록에서 기관 이름으로 찾으시면 공고 자체는 보입니다.",
          },
          {
            q: "건수가 실제보다 적어 보입니다.",
            a: "인사혁신처 나라일터에 올라온 공고만 셉니다. 기관 홈페이지에만 올린 공고와, 아직 받아 오지 못한 기간의 공고는 빠져 있습니다. 과거 공고는 지금도 계속 받아 오는 중이라 숫자가 늘어납니다.",
          },
        ]}
      />

      <GuideBanner title="취업을 준비하신다면 이것도" />
      <RelatedLinks items={jobsRelated()} />
    </div>
  );
}
