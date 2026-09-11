import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AreaChart from "@/components/AreaChart";
import AdSlot from "@/components/AdSlot";
import GuideBanner from "@/components/GuideBanner";
import Faq from "@/components/Faq";
import MidAd from "@/components/MidAd";
import { areaFaq } from "@/lib/faq";
import ProgramEntry from "@/components/ProgramEntry";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { areaNote, govWelfare, howToApply, howToUse } from "@/lib/areaNotes";
import { areaRelated } from "@/lib/related";
import { loanBySido, productLabel } from "@/lib/studentLoan";
import { getArea, getAreas, listByArea } from "@/lib/db";

export const revalidate = 86400;
export const dynamicParams = true;

import { HOOK, SITE_URL as SITE, YEAR } from "@/lib/seo";

export async function generateStaticParams() {
  try {
    return (await getAreas()).map((a) => ({ sido: a.sido }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: { sido: string };
}): Promise<Metadata> {
  const sido = decodeURIComponent(params.sido);
  const a = await getArea(sido);
  if (!a) return { title: "찾을 수 없는 지역" };

  const title = `${sido} 청년지원금·복지서비스 ${a.n}건 총정리 (${YEAR})`;
  const description =
    `${sido} 정부 복지와 지원금 ${a.n}건을 한자리에. ` +
    `청년 ${a.youth}건, 어르신 ${a.senior}건, 저소득 ${a.low_income}건. ` +
    `${HOOK} 신청 방법과 활용 방법까지 정리했습니다.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE}/area/${encodeURIComponent(sido)}` },
    keywords: [
      `${sido} 청년지원금`,
      `${sido} 복지서비스`,
      `${sido} 정부 복지`,
      `${sido} 지원금`,
      "정부복지",
      "정부 지원금 신청 방법",
    ],
    openGraph: { title, description, type: "website" },
  };
}


/**
 * 이 지역에 학자금 대출 이자를 대신 내주는 곳이 있는지.
 *
 * 협약한 기관이 없으면 아무것도 그리지 않는다. "없습니다"만 적힌 칸은
 * 화면만 길게 만들 뿐이다.
 */
function LoanBlock({ sido }: { sido: string }) {
  const orgs = loanBySido(sido);
  if (!orgs.length) return null;
  return (
    <section className="mt-14">
      <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
        {sido} 학자금 대출 이자지원
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        한국장학재단과 협약을 맺어 학자금 대출 이자를 지자체가 대신 내주는 곳입니다.
        신청한 사람만 지원하므로, 해당되면 학기 시작 전에 공고를 챙기셔야 합니다.
      </p>
      <ul className="card mt-4 divide-y divide-line p-5">
        {orgs.map((o) => (
          <li key={o.org} className="py-3 first:pt-0 last:pb-0">
            <b className="text-sm font-bold">{o.org}</b>
            <span className="ml-2 text-xs text-muted">
              {o.sigungu ? `${o.sigungu} 단위` : "광역 단위"} · {o.ways.join("·")}
            </span>
            <span className="mt-1 block text-[13px] leading-relaxed text-muted">
              {o.products.map(productLabel).join(" · ")}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/money/student-loan"
        className="mt-3 inline-flex text-sm font-semibold text-brand hover:underline"
      >
        다른 지역까지 전부 보기 →
      </Link>
    </section>
  );
}

export default async function AreaPage({ params }: { params: { sido: string } }) {
  const sido = decodeURIComponent(params.sido);
  const [area, list, all] = await Promise.all([
    getArea(sido),
    listByArea(sido),
    getAreas(),
  ]);
  if (!area) return notFound();

  const note = areaNote(sido);
  const steps = howToUse(sido);
  const apply = howToApply(sido);

  const stats = [
    { label: "청년 대상", n: area.youth, q: "age=28" },
    { label: "어르신 대상", n: area.senior, q: "age=68" },
    { label: "저소득 가구", n: area.low_income, q: "hh=저소득" },
    { label: "장애인 가구", n: area.disabled, q: "hh=장애인" },
    { label: "임신·다자녀", n: area.family, q: "hh=다자녀" },
  ].filter((s) => s.n > 0);

  return (
    <article>
      <nav className="mb-6 text-xs text-muted">
        <Link href="/" className="hover:text-ink">지원</Link>
        {" / "}
        <span>{sido}</span>
      </nav>

      <h1 className="text-display font-extrabold leading-tight">
        {sido}에서 받을 수 있는
        <br />
        지원금과 복지서비스
      </h1>

      <p className="mt-5 max-w-[34rem] leading-relaxed">
        {sido}의 시·군·구와 중앙부처가 제공하는 복지서비스 가운데 신청 조건을
        확인할 수 있는 <span className="num font-bold">{area.n}건</span>을
        정리했습니다. 조건을 넣으면 해당될 만한 것만 추려 보여드립니다.
      </p>

      <div className="mt-8 flex flex-wrap gap-1.5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={`/?sido=${encodeURIComponent(sido)}&${s.q}`}
            className="chip"
          >
            {s.label} <span className="num font-bold">{s.n}</span>
          </Link>
        ))}
      </div>

      <AreaChart
        sido={sido}
        bars={stats.map((s) => ({
          label: s.label.replace(" 대상", "").replace(" 가구", "").replace("임신·", ""),
          full: s.label,
          n: s.n,
          href: `/?sido=${encodeURIComponent(sido)}&${s.q}`,
        }))}
      />

      <Link
        href={`/?sido=${encodeURIComponent(sido)}`}
        className="btn btn-primary mt-8 w-full py-4 text-[0.95rem]"
      >
        내 조건으로 찾아보기
      </Link>

      <MidAd name="detail_mid" context="housing" seed={sido} className="mt-12" />

      <section className="mt-16">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          {sido}에서는 누가 무엇을 찾나
        </h2>

        <p className="mt-4 leading-relaxed text-ink2">{note.intro}</p>

        <div className="mt-6 grid gap-3">
          {note.cases.map((c) => (
            <div key={c.who} className="card p-5">
              <b className="text-[15px]">{c.who}</b>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{c.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-6 border-l-[3px] border-brand pl-4 leading-relaxed text-ink2">
          {note.closing}
        </p>
      </section>

      <section className="mt-16">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          {sido} 정부 복지, 왜 여기서 찾나
        </h2>
        <p className="mt-4 leading-relaxed text-ink2">
          {govWelfare(
            sido,
            area.n,
            stats.map((s) => ({ label: s.label, n: s.n }))
          )}
        </p>
      </section>

      <section className="mt-16">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          활용 방법
        </h2>
        <ol className="mt-5 grid gap-3">
          {steps.map((st) => (
            <li key={st.step} className="card flex gap-4 p-5">
              <span
                aria-hidden
                className="num flex h-7 w-7 shrink-0 items-center justify-center
                           rounded-pill bg-brandSoft text-[13px] font-bold text-brand"
              >
                {st.step}
              </span>
              <div className="min-w-0">
                <b className="text-[15px]">{st.title}</b>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{st.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          신청 방법
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          사업마다 창구가 다릅니다. 공고문에 적힌 접수처를 따르되, 어느 쪽인지
          헷갈리면 주소지 행정복지센터에 물어보시는 것이 가장 빠릅니다.
        </p>
        <dl className="mt-5 grid gap-3">
          {apply.map((a) => (
            <div key={a.title} className="card p-5">
              <dt className="text-[15px] font-bold">{a.title}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted">{a.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <h2 className="mt-16 border-b-2 border-line2 pb-2 text-sm font-bold">
        {sido} 지원사업 목록
      </h2>
      <div className="mt-3 grid gap-3">
        {list.map((p) => (
          <ProgramEntry key={p.id} p={p} />
        ))}
      </div>

      <section className="mt-16">
        <h2 className="border-b-2 border-line2 pb-2 text-sm font-bold">다른 지역</h2>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {all
            .filter((a) => a.sido !== sido)
            .map((a) => (
              <Link
                key={a.sido}
                href={`/area/${encodeURIComponent(a.sido)}`}
                className="text-sm text-muted hover:text-ink"
              >
                {a.sido}
                <span className="num ml-1 text-xs">{a.n}</span>
              </Link>
            ))}
        </div>
      </section>

      {area && <Faq items={areaFaq(sido, area)} />}

      <LoanBlock sido={sido} />

      <AdSlot name="page_bottom" />
      <GuideBanner title="이 지역에서 같이 보면 좋은 것" />

      <RelatedLinks items={areaRelated(sido)} />

      <PromoBanner placement="area" context="housing" />
    </article>
  );
}
