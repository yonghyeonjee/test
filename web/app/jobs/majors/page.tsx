import type { Metadata } from "next";
import Link from "next/link";
import { ArtStudy } from "@/components/Art";
import GuideBanner from "@/components/GuideBanner";
import JobsTabs from "@/components/JobsTabs";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RankBars from "@/components/RankBars";
import RelatedLinks from "@/components/RelatedLinks";
import {
  LATEST, MAJOR_SOURCE, MAJOR_YEARS, OVERALL, SCHOOLS, findMajors, rankedMajors,
} from "@/lib/majors";
import { jobsRelated } from "@/lib/related";

export const metadata: Metadata = {
  title: `학과별 취업률 ${LATEST} — 전공 고르기 전에 보는 졸업생 통계`,
  description:
    "대학 학과별 취업률을 3년치로 비교합니다. 졸업자 수, 취업률, 프리랜서·창업 비중까지 " +
    "교육부 취업통계 그대로 보여 드립니다. 전공을 고르거나 진로를 바꾸기 전에 한 번 보세요.",
  keywords: ["학과별 취업률", "대학 취업률", "전공별 취업률", "취업 잘 되는 학과", "대학 졸업생 취업 통계"],
  alternates: { canonical: "/jobs/majors" },
};

type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v) || "";
const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)}%`);

export default function Majors({ searchParams }: { searchParams: SP }) {
  const q = one(searchParams.q);
  const o = OVERALL[LATEST];
  const prev = OVERALL[MAJOR_YEARS[0]];
  const top = rankedMajors(30).slice(0, 20);
  const found = findMajors(q).slice(0, q ? 60 : 30);

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="취업 통계"
        title="전공을 고르기 전에, 졸업생이 어디로 갔는지"
        sub="교육부 취업통계를 학과 이름으로 묶었습니다. 취업률 숫자 하나보다 졸업자 수와 3년 흐름을 같이 보셔야 제대로 읽힙니다."
        art={<ArtStudy />}
      >
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { n: pct(o.rate), label: `${LATEST}년 취업률` },
            { n: o.grads.toLocaleString(), label: "졸업자" },
            { n: pct(o.rateM), label: "남성 취업률" },
            { n: pct(o.rateF), label: "여성 취업률" },
          ].map((b) => (
            <div key={b.label} className="rounded-card bg-white/10 px-3 py-3 text-center">
              <b className="num block text-[1.35rem] font-extrabold text-white">{b.n}</b>
              <span className="mt-0.5 block text-[11.5px] text-white/70">{b.label}</span>
            </div>
          ))}
        </div>
      </PageBanner>
      <JobsTabs active="/jobs/majors" />

      <section className="mt-8">
        <h2 className="text-[1.0625rem] font-bold">3년 흐름</h2>
        <div className="card mt-3 grid grid-cols-3 divide-x divide-line p-5 text-center">
          {MAJOR_YEARS.map((y) => (
            <div key={y}>
              <span className="block text-xs text-muted">{y}년</span>
              <b className="num block text-[1.25rem] font-extrabold text-brand">{pct(OVERALL[y].rate)}</b>
              <span className="num block text-[11.5px] text-muted">졸업 {OVERALL[y].grads.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {MAJOR_YEARS[0]}년 {pct(prev.rate)}에서 {LATEST}년 {pct(o.rate)}로 내려왔습니다.
          같은 해 졸업자 가운데 프리랜서 {o.free.toLocaleString()}명, 1인 창업 {o.solo.toLocaleString()}명,
          대학원 진학 {o.further.toLocaleString()}명, 해외취업 {o.abroad.toLocaleString()}명입니다.
        </p>
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[1.0625rem] font-bold">취업률이 높은 학과 20</h2>
          <span className="text-xs text-muted">{LATEST}년 · 분모 30명 이상</span>
        </div>
        <div className="card mt-3 p-5">
          <RankBars bars={top.map((m) => ({
            label: m.name, value: m.y[LATEST].rate ?? 0,
            note: `졸업 ${m.y[LATEST].grads}명 · ${m.schools}개교`,
          }))} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          간호·보건 계열이 위에 몰리는 것은 전국 통계와 같습니다. 국가고시가 곧 자격이고 자격이
          곧 취업이라서입니다. 졸업자가 적은 학과는 순위에서 뺐습니다.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-[1.0625rem] font-bold">학과 이름으로 찾기</h2>
        <form action="/jobs/majors" method="get" className="mt-3 flex gap-2">
          <input name="q" defaultValue={q} placeholder="예: 경영, 간호, 컴퓨터"
                 className="field min-w-0 flex-1" aria-label="학과 이름" />
          <button type="submit" className="btn btn-primary shrink-0 px-5 py-2.5">찾기</button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="num w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-line2 text-left text-[13px] text-muted">
                <th className="py-2 pr-3 font-semibold">학과</th>
                <th className="py-2 pr-3 text-right font-semibold">학교 수</th>
                {MAJOR_YEARS.map((y) => (
                  <th key={y} className="py-2 pr-3 text-right font-semibold">{y}</th>
                ))}
                <th className="py-2 text-right font-semibold">{LATEST} 졸업</th>
              </tr>
            </thead>
            <tbody>
              {found.map((m) => (
                <tr key={m.name} className="border-b border-line">
                  <th scope="row" className="py-2 pr-3 text-left font-bold">{m.name}</th>
                  <td className="py-2 pr-3 text-right text-muted">{m.schools}</td>
                  {MAJOR_YEARS.map((y) => (
                    <td key={y} className={`py-2 pr-3 text-right ${y === LATEST ? "font-bold text-brand" : "text-muted"}`}>
                      {pct(m.y[y].rate)}
                    </td>
                  ))}
                  <td className="py-2 text-right text-muted">{m.y[LATEST].grads.toLocaleString()}</td>
                </tr>
              ))}
              {found.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-muted">그 이름의 학과가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {!q && (
          <p className="mt-2 text-xs text-muted">졸업자가 많은 순으로 30개입니다. 이름을 넣으면 전체에서 찾습니다.</p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-[1.0625rem] font-bold">학교별</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="num w-full min-w-[30rem] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-line2 text-left text-[13px] text-muted">
                <th className="py-2 pr-3 font-semibold">학교</th>
                <th className="py-2 pr-3 font-semibold">설립</th>
                {MAJOR_YEARS.map((y) => <th key={y} className="py-2 pr-3 text-right font-semibold">{y}</th>)}
                <th className="py-2 text-right font-semibold">{LATEST} 졸업</th>
              </tr>
            </thead>
            <tbody>
              {SCHOOLS.map((s) => (
                <tr key={s.name} className="border-b border-line">
                  <th scope="row" className="py-2 pr-3 text-left font-bold">{s.name.replace(/ _/g, " ")}</th>
                  <td className="py-2 pr-3 text-muted">{s.type}</td>
                  {MAJOR_YEARS.map((y) => (
                    <td key={y} className={`py-2 pr-3 text-right ${y === LATEST ? "font-bold text-brand" : "text-muted"}`}>{pct(s.y[y].rate)}</td>
                  ))}
                  <td className="py-2 text-right text-muted">{s.y[LATEST].grads.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        출처: {MAJOR_SOURCE}. 취업률은 졸업자에서 진학·입대·외국인 유학생 등을 뺀 수 대비
        취업자 비율이며, 취업자에는 건강보험 직장가입자 외에 프리랜서·1인 창업·해외취업이 포함됩니다.
      </p>

      <section className="mt-14">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">이 숫자를 읽는 법</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            취업률은 졸업생 전체가 아니라 &lsquo;취업할 수 있었던 사람&rsquo; 가운데 취업한 비율입니다.
            대학원에 간 사람, 군에 간 사람, 외국인 유학생은 분모에서 빠집니다. 그래서 진학이 많은
            학과는 취업률이 낮아 보이지 않고, 반대로 졸업생 대부분이 취업 대신 진학을 택한 학과는
            분모 자체가 작아집니다. 취업률 옆에 졸업자 수를 같이 둔 이유입니다.
          </p>
          <p>
            취업자에는 회사에 다니는 사람만 있는 것이 아닙니다. 프리랜서와 1인 창업이 취업자로
            잡힙니다. 예술·디자인 계열의 취업률이 겉보기보다 안정적인 이유가 이것이고, 반대로 그
            숫자가 곧 정규직 취업을 뜻하지는 않습니다. 같은 취업률이라도 학과에 따라 그 안의
            형태가 다릅니다.
          </p>
          <p>
            3년 흐름을 보시길 권합니다. 한 해 숫자는 졸업생 몇 명의 사정으로도 흔들리지만, 3년
            내내 같은 방향이면 그 학과의 시장이 그렇게 움직이는 것입니다. 전체 취업률이 3년 연속
            내려온 것도 그런 신호입니다. 학과를 고를 때는 이 표와 함께 <Link href="/license" className="underline decoration-line2 underline-offset-4 hover:text-brand">자격증 목록</Link>을,
            준비 비용이 걱정이면 <Link href="/money/student-loan" className="underline decoration-line2 underline-offset-4 hover:text-brand">학자금 이자지원</Link>을 같이 보세요.
          </p>
        </div>
      </section>

      <GuideBanner title="학생·청년이라면 이것도" />
      <RelatedLinks items={jobsRelated()} />
      <PromoBanner placement="jobs-majors" context="student" />
    </div>
  );
}
