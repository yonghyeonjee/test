import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import Faq from "@/components/Faq";
import JsonLd from "@/components/JsonLd";
import MidAd from "@/components/MidAd";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import ShareButton from "@/components/ShareButton";
import YouthSavingsCalc from "@/components/YouthSavingsCalc";
import { CompareBars, SavingsHero, Timeline } from "@/components/YouthSavingsArt";
import { manwon as mw, standardFor, tableYear } from "@/lib/medianIncome";
import { postRelated } from "@/lib/related";
import { ORG_ID, pageGraph } from "@/lib/schema";
import { SITE_URL } from "@/lib/seo";

/** 신청 기간이 걸려 있는 글이다. 하루 한 번은 새로 그린다. */
export const revalidate = 86400;

const PATH = "/blog/youth-future-savings";
const UPDATED = "2026-09-16";
const TITLE = "청년미래적금 2차 신청 — 기간, 조건, 3년 뒤 받는 돈";
const DESC =
  "청년미래적금 2차 가입 신청은 2026년 10월 7일부터 16일까지입니다. 나이·소득 조건과 " +
  "정부기여금 6%·12%의 차이, 3년 뒤 실제로 받는 금액을 계산기로 확인하세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "청년미래적금", "청년미래적금 2차", "청년미래적금 신청", "청년미래적금 조건",
    "청년미래적금 계산기", "청년미래적금 금리", "청년미래적금 우대형",
    "청년도약계좌 갈아타기", "청년 적금", "정부기여금", "청년 목돈",
  ],
  alternates: { canonical: PATH },
  openGraph: {
    type: "article",
    url: `${SITE_URL}${PATH}`,
    title: TITLE,
    description: DESC,
    publishedTime: UPDATED,
    modifiedTime: UPDATED,
  },
};

const STEPS = [
  {
    when: "10월 7일 ~ 8일",
    what: "출생연도 끝자리로 나눠 신청",
    detail: "7일은 끝자리가 홀수인 사람, 8일은 짝수인 사람이 신청합니다. 첫 이틀은 몰리기 때문에 나눠 받습니다.",
  },
  {
    when: "10월 12일 ~ 16일",
    what: "누구나 신청",
    detail: "출생연도와 상관없이 신청할 수 있습니다. 첫 이틀에 못 했다면 이때 하면 됩니다. 16일이 마지막 날입니다.",
  },
  {
    when: "10월 19일 ~ 11월 13일",
    what: "자격 심사",
    detail: "소득과 우대형 해당 여부를 심사합니다. 이 기간에는 기다리는 것 말고 할 일이 없습니다.",
  },
  {
    when: "11월 16일 ~ 27일",
    what: "계좌 개설",
    detail: "심사를 통과하면 이 기간에 은행에서 계좌를 엽니다. 이때 열지 않으면 신청이 소용없어집니다.",
  },
];

const FAQ = [
  {
    q: "청년미래적금 2차 신청은 언제까지인가요?",
    a: "2026년 10월 16일(금)까지입니다. 10월 7일과 8일은 출생연도 끝자리 홀짝으로 나눠 받고, 10월 12일부터 16일까지는 출생연도와 상관없이 누구나 신청할 수 있습니다.",
  },
  {
    q: "나이 조건이 어떻게 되나요?",
    a: "만 19세부터 34세까지입니다. 병역을 이행했다면 복무 기간을 최대 6년까지 나이 계산에서 빼 줍니다. 예를 들어 2년 복무한 만 36세는 만 34세로 보아 신청할 수 있습니다.",
  },
  {
    q: "소득이 얼마까지 되나요?",
    a: "가입 자체는 총급여 7,500만원(종합소득 6,300만원, 소상공인은 연매출 3억원) 이하이면서 가구소득이 기준 중위소득 200% 이하여야 합니다. 다만 총급여 6,000만원을 넘으면 정부기여금 없이 비과세 혜택만 받습니다.",
  },
  {
    q: "일반형과 우대형은 무엇이 다른가요?",
    a: "정부가 얹어 주는 돈의 비율이 다릅니다. 일반형은 낸 돈의 6%(월 최대 3만원), 우대형은 12%(월 최대 6만원)입니다. 3년으로 치면 108만원과 216만원 차이입니다. 우대형은 중소기업 재직자 등이 대상이고 가구소득 요건도 더 낮습니다.",
  },
  {
    q: "매달 꼭 50만원을 넣어야 하나요?",
    a: "아닙니다. 월 1,000원부터 50만원까지 자유롭게 넣습니다. 다만 정부기여금은 낸 돈에 비례하므로, 여유가 되는 만큼 넣을수록 받는 돈도 늘어납니다.",
  },
  {
    q: "청년도약계좌에 가입 중인데 갈아탈 수 있나요?",
    a: "가능합니다. 청년미래적금 심사를 통과해 계좌를 연 뒤 청년도약계좌를 특별중도해지하면, 그때까지 쌓인 기여금과 비과세 혜택을 잃지 않습니다. 순서를 바꿔 먼저 해지하면 손해를 볼 수 있으니 주의하세요.",
  },
  {
    q: "이자에 세금을 정말 안 떼나요?",
    a: "만기에 받는 이자소득에 붙는 15.4%를 떼지 않습니다. 같은 금리라면 보통 적금보다 이자를 그만큼 더 손에 쥡니다.",
  },
];

export default function YouthFutureSavingsPage() {
  const year = tableYear();
  // 가구소득 요건을 퍼센트가 아니라 금액으로. 우리 표에 든 해가 아니면 비운다.
  const rows =
    year === null
      ? []
      : [1, 2, 3, 4, 5].map((n) => ({
          n,
          m200: standardFor(n, 200, year),
          m150: standardFor(n, 150, year),
        }));

  const ld = pageGraph({
    path: PATH,
    name: TITLE,
    description: DESC,
    dateModified: UPDATED,
    crumbs: [{ name: "지원금 안내", path: "/blog" }, { name: "청년미래적금 2차" }],
    about: {
      "@type": "BlogPosting",
      "@id": `${SITE_URL}${PATH}#post`,
      headline: TITLE,
      description: DESC,
      dateModified: UPDATED,
      datePublished: UPDATED,
      inLanguage: "ko-KR",
      keywords: "청년미래적금, 청년미래적금 2차, 청년미래적금 신청, 청년미래적금 조건, 정부기여금",
      author: { "@id": ORG_ID },
      publisher: { "@id": ORG_ID },
      url: `${SITE_URL}${PATH}`,
    },
  });

  return (
    <article className="py-4">
      <JsonLd data={ld} />

      <nav aria-label="위치" className="text-[13px] text-muted">
        <Link href="/blog" className="hover:text-brand">지원금 안내</Link>
        {" · "}
        <span className="text-ink2">청년미래적금 2차</span>
      </nav>

      <header className="mt-3">
        <h1 className="display text-[1.75rem] leading-tight">
          청년미래적금 2차, 10월 16일까지 신청합니다
        </h1>
        <p className="num mt-2 text-xs text-faint">{UPDATED} 기준</p>
        <p className="mt-3 text-[15.5px] leading-[1.85] text-ink2">
          매달 최대 50만원을 3년 동안 넣으면 정부가 낸 돈의 6%나 12%를 얹어 주고, 이자에는
          세금을 떼지 않는 적금입니다. 1차 때 234만명이 몰렸던 그 상품의 두 번째 모집입니다.
          신청 기간이 열흘뿐이라 날짜부터 적어 두시는 편이 좋습니다.
        </p>
        <div className="mt-5"><SavingsHero /></div>
      </header>

      {/* 급한 사람을 위해 결론부터 */}
      <section className="mt-8">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">한눈에</h2>
        <dl className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {[
            ["신청 기간", "2026년 10월 7일(수) ~ 10월 16일(금)"],
            ["넣는 돈", "월 1,000원 ~ 50만원, 3년 만기"],
            ["정부기여금", "낸 돈의 6%(월 3만원) 또는 12%(월 6만원)"],
            ["이자", "기본 연 5% + 은행 우대금리, 이자소득 비과세"],
            ["나이", "만 19 ~ 34세 (병역 최대 6년 차감)"],
            ["소득", "총급여 7,500만원 이하 · 가구 중위소득 200% 이하"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-card bg-ground px-4 py-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 text-[14.5px] font-semibold leading-snug">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">언제 무엇을 하나</h2>
        <p className="mt-2 text-[15px] leading-[1.85] text-ink2">
          신청만 하면 끝이 아닙니다. 심사를 거쳐 정해진 기간에 계좌를 열어야 가입이
          마무리됩니다. 계좌 개설 기간을 넘기면 신청한 것이 없던 일이 됩니다.
        </p>
        <Timeline steps={STEPS} />
        <div className="mt-2 rounded-card border-l-[3px] border-brand bg-brandSoft/50 px-4 py-3">
          <p className="text-[13.5px] leading-relaxed text-ink2">
            첫 이틀의 홀짝은 <b>출생연도</b> 끝자리 기준입니다. 생일이 아니라 태어난 해입니다.
            1994년생이면 4니까 8일(짝수)에 신청합니다.
          </p>
        </div>
      </section>

      <MidAd name="detail_mid" context="money" seed="youth-savings" className="mt-10" />

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">얼마를 받나</h2>
        <p className="mt-2 text-[15px] leading-[1.85] text-ink2">
          &ldquo;연 14% 효과&rdquo; 같은 말이 기사에 많이 나오지만, 그건 정부기여금과 세금 면제를
          이자로 바꿔 계산한 숫자입니다. 통장에 찍히는 금액으로 보는 편이 빠릅니다.
        </p>
        <CompareBars />
        <YouthSavingsCalc />
      </section>

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">누가 되나</h2>
        <p className="mt-2 text-[15px] leading-[1.85] text-ink2">
          세 가지를 모두 충족해야 합니다. 하나라도 걸리면 가입이 안 되고, 소득 구간에 따라
          기여금을 받는지 비과세만 받는지가 갈립니다.
        </p>

        <div className="mt-5 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            <b className="font-bold">나이</b>는 만 19세부터 34세까지입니다. 병역을 마쳤다면
            복무 기간을 최대 6년까지 빼고 계산하므로, 만 34세가 넘었어도 신청할 수 있는
            경우가 있습니다. 나이는 신청일이 아니라 <b className="font-bold">계좌를 여는 날</b>을
            기준으로 봅니다. 2차 모집의 계좌 개설 기간이 11월 16일부터 27일까지이므로,
            그 사이에 만 19~34세인 1991년 11월 17일생부터 2007년 11월 27일생까지가
            해당합니다.
          </p>
          <p>
            <b className="font-bold">개인소득</b>은 근로자라면 총급여 7,500만원 이하,
            종합소득이 있다면 6,300만원 이하, 소상공인이라면 연매출 3억원 이하입니다.
            다만 총급여가 6,000만원을 넘으면 정부기여금 없이 비과세 혜택만 받습니다.
          </p>
          <p>
            <b className="font-bold">가구소득</b>은 기준 중위소득 200% 이하입니다. 본인과
            배우자만 있는 2인 가구는 맞벌이를 감안해 일반형 기준이 250%까지 완화됩니다.
            우대형 기여금을 받으려면 가구소득이 150% 이하여야 합니다.
          </p>
        </div>

        {rows.length > 0 && (
          <figure className="mt-6 overflow-x-auto">
            <figcaption className="text-[13.5px] font-semibold text-ink2">
              {year}년 기준 중위소득으로 본 가구소득 한도 (월)
            </figcaption>
            <table className="mt-3 w-full min-w-[22rem] border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b-2 border-line2 text-left text-[12.5px] text-muted">
                  <th className="py-2 pr-3 font-semibold">가구원 수</th>
                  <th className="py-2 pr-3 font-semibold">200% (가입 기준)</th>
                  <th className="py-2 font-semibold">150% (우대형 기준)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.n} className="border-b border-line">
                    <td className="py-2.5 pr-3 font-semibold">{r.n}인</td>
                    <td className="num py-2.5 pr-3">{r.m200 === null ? "—" : mw(r.m200)}</td>
                    <td className="num py-2.5">{r.m150 === null ? "—" : mw(r.m150)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              보건복지부 고시 기준 중위소득으로 계산한 금액입니다. 실제 심사는 건강보험료
              등으로 확인한 가구원 소득 합계를 봅니다.{" "}
              <Link href="/blog/income" className="underline underline-offset-4 hover:text-brand">
                내 소득이 몇 %인지 계산해 보기
              </Link>
            </p>
          </figure>
        )}
      </section>

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">일반형과 우대형</h2>
        <p className="mt-2 text-[15px] leading-[1.85] text-ink2">
          같은 돈을 넣어도 유형에 따라 정부가 얹어 주는 돈이 두 배 차이 납니다. 3년이면
          108만원과 216만원입니다.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b-2 border-line2 text-left text-[12.5px] text-muted">
                <th className="py-2 pr-3 font-semibold">구분</th>
                <th className="py-2 pr-3 font-semibold">개인소득</th>
                <th className="py-2 pr-3 font-semibold">가구소득</th>
                <th className="py-2 font-semibold">정부기여금</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["우대형", "총급여 3,600만원 이하 (중소기업 재직자 등)", "중위 150% 이하", "12% · 월 6만원"],
                ["일반형", "총급여 6,000만원 이하", "중위 200% 이하", "6% · 월 3만원"],
                ["비과세만", "총급여 6,000만원 초과 7,500만원 이하", "중위 200% 이하", "없음"],
              ].map((r) => (
                <tr key={r[0]} className="border-b border-line">
                  <td className="py-2.5 pr-3 font-semibold">{r[0]}</td>
                  <td className="py-2.5 pr-3 text-ink2">{r[1]}</td>
                  <td className="num py-2.5 pr-3 text-ink2">{r[2]}</td>
                  <td className="num py-2.5 font-semibold">{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          우대형 대상은 중소기업 재직자 외에도 신규 취업자와 소상공인 등이 거론됩니다. 내가
          해당되는지는 신청할 때 심사로 가려지므로, 애매하면 일단 신청해 두고 심사 결과를
          보는 편이 낫습니다.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">청년도약계좌에서 갈아타기</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            이미 청년도약계좌를 붓고 있다면 이번에 갈아탈 수 있습니다. 1차 때 놓친 사람에게도
            다시 기회가 주어집니다.
          </p>
          <p>
            <b className="font-bold">순서가 중요합니다.</b> 청년미래적금 심사를 통과해 계좌를
            먼저 연 뒤에 청년도약계좌를 특별중도해지해야 합니다. 이 순서를 지키면 그동안 쌓인
            기여금과 비과세 혜택을 잃지 않습니다. 반대로 청년도약계좌를 먼저 해지하면 일반
            중도해지가 되어 손해를 볼 수 있습니다.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">놓치기 쉬운 것</h2>
        <ul className="mt-4 space-y-3 text-[15px] leading-[1.85] text-ink2">
          {[
            "신청과 계좌 개설은 다른 절차입니다. 11월 16일부터 27일 사이에 계좌를 열지 않으면 신청이 소용없어집니다.",
            "홀짝은 생일이 아니라 출생연도 끝자리입니다. 헷갈리면 10월 12일 이후에 신청하면 됩니다.",
            "가입 한 번에 은행 한 곳입니다. 우대금리 조건은 은행마다 다르니 급여이체·카드실적 같은 조건을 미리 견줘 보세요.",
            "3년을 채우지 못하고 중도해지하면 정부기여금과 비과세가 대개 사라집니다. 매달 넣을 수 있는 금액으로 시작하는 편이 안전합니다.",
            "가구소득은 본인 소득만 보는 것이 아닙니다. 주민등록상 가구원의 소득을 합쳐 봅니다.",
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">앞으로 바뀔 수 있는 것</h2>
        <p className="mt-2 text-[15px] leading-[1.85] text-ink2">
          정부는 우대형 기여금 비율을 12%에서 15%로, 지방 중소기업 재직자는 25%까지 올리는
          안을 2027년 예산안에 담았습니다. 통과되면 이번 2차 가입자에게도 소급 적용할
          계획이라고 밝혔습니다. 다만 <b className="font-bold">국회를 통과해야 확정</b>되는
          내용이라, 지금은 12%를 기준으로 계산하시는 편이 맞습니다.
        </p>
      </section>

      <Faq items={FAQ} />

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">확인한 곳</h2>
        <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-ink2">
          {[
            ["금융위원회 보도자료", "https://www.fsc.go.kr"],
            ["서민금융진흥원 청년미래적금 안내", "https://www.kinfa.or.kr/financialProduct/youthFutureSavings.do"],
          ].map(([label, href]) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noopener noreferrer"
                 className="underline underline-offset-4 hover:text-brand">{label}</a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          이 글은 2026년 9월 16일에 공개된 내용을 정리한 것입니다. 신청 전에는 반드시 위
          기관 공고에서 최종 조건과 일정을 확인하세요. 은행별 우대금리는 상품 설명서에
          적혀 있습니다.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/?age=29&via=youth-savings" className="btn btn-primary px-5 py-3">
          내가 받을 수 있는 다른 지원금 보기
        </Link>
        <ShareButton title={TITLE} />
      </div>

      <AdSlot name="post_bottom" />

      <PromoBanner placement="youth-savings" context="money" />
      <RelatedLinks items={postRelated("youth-support")} />
    </article>
  );
}
