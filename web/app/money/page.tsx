import type { Metadata } from "next";
import Link from "next/link";
import { ArtJeonse, ArtMoney, ArtStudy } from "@/components/Art";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { moneyRelated } from "@/lib/related";
import { LOAN_ORGS } from "@/lib/studentLoan";

export const metadata: Metadata = {
  title: "생활금융 정보 — 전세자금대출 금리, 학자금 이자지원",
  description:
    "받는 돈만 지원이 아닙니다. 주택금융공사 보증 전세자금대출의 은행별 금리와, " +
    "학자금 대출 이자를 대신 내주는 지자체를 한자리에 정리했습니다.",
  keywords: ["전세자금대출 금리", "학자금 이자지원", "생활금융", "정부 지원 대출"],
  alternates: { canonical: "/money" },
};

const CARDS = [
  {
    href: "/money/jeonse",
    title: "전세자금대출 금리 비교",
    desc:
      "한국주택금융공사가 보증하는 전세자금 대출의 은행별 기준금리·가산금리·적용금리입니다. " +
      "공사가 하루 한 번 갱신하는 자료를 그대로 가져와 낮은 순으로 세워 둡니다.",
    Art: ArtJeonse,
    tag: "매일 갱신",
  },
  {
    href: "/money/student-loan",
    title: "지자체 학자금 이자지원",
    desc:
      `학자금 대출 이자를 지자체가 대신 내주는 제도입니다. 전국 ${LOAN_ORGS.length}개 기관이 ` +
      "한국장학재단과 협약을 맺고 있어, 사는 곳에 따라 이자를 한 푼도 안 낼 수 있습니다.",
    Art: ArtStudy,
    tag: "지역별",
  },
];

export default function MoneyIndex() {
  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="생활금융"
        title="받는 것만 지원이 아닙니다"
        sub="나가는 돈을 줄여 주는 제도가 따로 있습니다. 이자를 깎아 주거나 대신 내주는 쪽은 신청만 하면 되는데도 몰라서 그냥 내는 분이 많습니다."
        art={<ArtMoney />}
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="card card-link block p-6">
            <div className="h-20 w-28">
              <c.Art />
            </div>
            <span className="badge badge-new mt-3">{c.tag}</span>
            <h2 className="mt-2 text-[1.0625rem] font-bold leading-snug">{c.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{c.desc}</p>
          </Link>
        ))}
      </div>

      <section className="mt-14">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          왜 따로 모아 두었나
        </h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            지원금을 찾는 분들은 대부분 &lsquo;받는 돈&rsquo;부터 봅니다. 그런데 한 해 동안
            가계에서 빠져나가는 돈을 따져 보면, 새로 받는 수당보다 이미 내고 있는
            이자가 더 큰 경우가 흔합니다. 전세 보증금 대출 이자, 학자금 대출 이자가
            대표적입니다. 이 둘은 금액이 크고 매달 빠져나가서, 조건이 조금만 나아져도
            일 년치로 보면 웬만한 지원금보다 차이가 큽니다.
          </p>
          <p>
            그런데도 잘 안 보는 이유는 정보가 흩어져 있어서입니다. 전세대출 금리는
            은행마다 다르고 같은 은행 안에서도 보증 비율에 따라 갈리는데, 이걸 한자리에
            세워 놓은 곳이 마땅치 않습니다. 학자금 이자지원은 아예 지자체 공고에만
            올라와서, 내가 사는 곳이 하고 있는지조차 모르고 지나갑니다. 그래서 공공기관이
            공개한 자료를 그대로 가져와 비교할 수 있는 모양으로만 바꿔 두었습니다.
          </p>
          <p>
            여기 있는 숫자는 저희가 계산한 것이 아니라 기관이 공개한 값 그대로입니다.
            실제 적용되는 금리와 지원 여부는 은행 심사와 지자체 공고 기준에 따라 달라지니,
            표에서 후보를 좁힌 뒤 해당 기관에 한 번 더 확인하시는 것이 좋습니다.
          </p>
        </div>
      </section>

      <RelatedLinks items={moneyRelated()} />
      <PromoBanner placement="money" context="money" />
    </div>
  );
}
