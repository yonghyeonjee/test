import type { Metadata } from "next";
import { IllusMoney } from "@/components/Illus";
import Link from "next/link";

import Faq from "@/components/Faq";
import HomeLoanRates from "@/components/HomeLoanRates";
import JsonLd from "@/components/JsonLd";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { getHomeLoanRates, lowestDidimdol, monthLabel } from "@/lib/homeLoanRates";
import { housingPath } from "@/lib/housing";
import { jeonseRelated } from "@/lib/related";
import { pageGraph } from "@/lib/schema";
import { brandKeys, withOg } from "@/lib/seo";

export const revalidate = 3600;

const PATH = "/money/home-loan";

export async function generateMetadata(): Promise<Metadata> {
  const r = await getHomeLoanRates();
  const m = r ? monthLabel(r.didimdol.month ?? r.bogeumjari.month) : null;
  const low = r ? lowestDidimdol(r) : null;
  const title = `보금자리론·디딤돌대출 금리${m ? ` (${m})` : ""} — 소득·만기별 표와 우대금리`;
  return withOg({
    title,
    description:
      `주택도시기금 디딤돌대출과 주택금융공사 보금자리론의 이번 달 금리를 소득 구간·만기별로 정리했습니다.` +
      (low ? ` 디딤돌 최저 연 ${low.toFixed(2)}%(생애최초 신혼).` : "") +
      ` 신혼·다자녀·청년 우대금리와 지방 주택 차감까지 한 표로 봅니다.`,
    keywords: [
      ...brandKeys("구입자금 금리", "보금자리론", "디딤돌"),"디딤돌대출 금리", "보금자리론 금리", "주택구입자금 대출 금리", "신혼부부 디딤돌 금리", "생애최초 디딤돌 금리", "디딤돌 우대금리", "보금자리론 우대금리"],
    alternates: { canonical: PATH },
  });
}

const FAQ = [
  { q: "디딤돌과 보금자리론 중 무엇을 봐야 하나요?", a: "소득이 디딤돌 기준(부부합산 6,000만원, 생애최초 7,000만원, 신혼 8,500만원) 안이면 디딤돌이 금리가 낮습니다. 그 기준을 넘거나 집값이 디딤돌 한도(5~6억원)를 넘으면 보금자리론을 봅니다." },
  { q: "표의 금리가 그대로 적용되나요?", a: "아닙니다. 표는 기본 금리이고, 여기서 우대금리(신혼·다자녀·청년·청약저축 등)를 빼고 규제지역 가산을 더한 것이 실제 금리입니다. 디딤돌은 지방 주택이면 0.2%p 를 더 뺍니다." },
  { q: "금리는 언제 바뀌나요?", a: "두 상품 모두 매달 1일 새 금리를 공시합니다. 이 쪽은 매일 아침 누리집을 다시 읽어 공시일과 함께 보여 줍니다." },
  { q: "지자체 이자지원과 같이 받을 수 있나요?", a: "대개 가능합니다. 시·군의 '주택구입 대출이자 지원'은 이 대출을 받은 사람의 이자 일부를 대신 내주는 구조가 많습니다. 사는 곳의 사업은 주거 지원 목차에서 찾으세요." },
];

export default async function HomeLoanPage() {
  const r = await getHomeLoanRates();
  const ld = pageGraph({
    path: PATH, name: "보금자리론·디딤돌대출 금리", description: "이번 달 구입자금 정책대출 금리표",
    dateModified: r?.checked ?? null,
    crumbs: [{ name: "생활금융", path: "/money" }, { name: "구입자금 대출 금리" }],
  });
  return (
    <div className="pb-4">
      <JsonLd data={ld} />
      <PageBanner
        eyebrow="생활금융"
        title="집 살 때 정책대출 금리, 이번 달 표"
        sub="주택도시기금 디딤돌대출과 주택금융공사 보금자리론의 공시 금리를 소득 구간·만기별로 옮겨 두었습니다. 우대금리를 빼면 얼마가 되는지도 같이 봅니다."
        art={<IllusMoney />}
      />
      <div className="mt-6">
        {r ? <HomeLoanRates /> : (
          <div className="card p-6 text-center text-muted">아직 금리표를 받아 오지 못했습니다. 매일 아침 새로 받아 옵니다.</div>
        )}
      </div>

      <section className="mt-10 rounded-card border-l-[3px] border-brand bg-brandSoft/40 px-5 py-5">
        <h2 className="text-[1.0625rem] font-extrabold">누가 어떤 조건으로 받나</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink2">
          소득·주택가격·혼인 기간 같은 대상 조건과, 시·군이 이자를 대신 내주는 사업은 주거 지원 목차에 정리해 두었습니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Link href={housingPath("buy", "newlywed")} className="chip">신혼부부 주택 구입</Link>
          <Link href={housingPath("buy", "youth")} className="chip">청년 주택 구입</Link>
          <Link href={housingPath("buy", "nohouse")} className="chip">무주택 주택 구입</Link>
          <Link href="/money/jeonse" className="chip">전세대출 금리</Link>
        </div>
      </section>

      <Faq items={FAQ} />
      <PromoBanner placement="home-loan" context="general" />
      <RelatedLinks items={jeonseRelated()} />
    </div>
  );
}
