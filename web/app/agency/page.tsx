import type { Metadata } from "next";
import Link from "next/link";
import AgencyList from "@/components/AgencyList";
import { ArtAgency } from "@/components/Art";
import GuideBanner from "@/components/GuideBanner";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { BSN_CATE, LIFE_CYCLE, SVC_CATE, callAlio, toBusiness } from "@/lib/alioplus";
import { agencyRelated } from "@/lib/related";

export const metadata: Metadata = {
  title: "공공기관 지원사업 — 생애주기·분야별로 찾는 기관 서비스",
  description:
    "전국 공공기관이 국민에게 제공하는 사업을 생애주기(청년·중장년·어르신)와 분야(사회복지·취업·교육·건강)로 " +
    "걸러 봅니다. 기획재정부 알리오 플러스 공개 자료입니다.",
  keywords: ["공공기관 지원사업", "공공기관 서비스", "알리오플러스", "청년 공공기관 사업", "어르신 지원사업"],
  alternates: { canonical: "/agency" },
};

type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v) || undefined;

export const TABS = [
  { href: "/agency", label: "지원사업" },
  { href: "/agency/events", label: "행사·교육" },
  { href: "/agency/facilities", label: "이용 시설" },
];

export function AgencyTabs({ active }: { active: string }) {
  return (
    <nav className="mt-6 flex gap-2 border-b border-line">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
                t.href === active ? "border-brand text-brand" : "border-transparent text-muted hover:text-brand"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export default async function AgencyPage({ searchParams }: { searchParams: SP }) {
  const current = {
    life: one(searchParams.life), cate: one(searchParams.cate),
    svc: one(searchParams.svc), q: one(searchParams.q),
  };
  const res = await callAlio("business", {
    schLifeCycle: current.life ?? "", schFstCateCd: current.cate ?? "",
    schSvcCate: current.svc ?? "", schBsnNa: current.q ?? "",
  });
  const items = res.ok ? res.rows.map(toBusiness).filter((x): x is NonNullable<typeof x> => !!x) : [];

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="공공기관"
        title="공공기관이 국민에게 하는 사업, 한자리에"
        sub="장학금·직업훈련·의료지원처럼 공공기관이 직접 운영하는 사업입니다. 지자체 공고와 다른 곳에서 나와 따로 찾아야 했던 것들입니다."
        art={<ArtAgency />}
      />
      <AgencyTabs active="/agency" />
      <AgencyList
        base="/agency" items={items} ok={res.ok} reason={res.ok ? null : res.reason}
        facets={[
          { name: "life", label: "생애주기", options: LIFE_CYCLE },
          { name: "cate", label: "분야", options: BSN_CATE },
          { name: "svc", label: "형태", options: SVC_CATE },
        ]}
        current={current} qName="q"
        empty="조건에 맞는 사업이 없습니다. 분야를 넓혀 보세요."
        external={{ href: "https://www.alioplus.go.kr", label: "알리오 플러스에서 직접 보기" }}
      />
      <p className="mt-3 text-xs leading-relaxed text-muted">
        기획재정부 알리오 플러스 공개 자료를 여섯 시간마다 받아 옵니다. 신청 자격과 기간의 최종
        확인은 각 기관 안내에서 하셔야 합니다.
      </p>

      <section className="mt-14">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          지자체 공고에 안 나오는 지원이 있습니다
        </h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            지원금을 찾을 때 대부분 주민센터와 지자체 홈페이지를 봅니다. 그런데 장학재단,
            주택금융공사, 산업인력공단, 근로복지공단처럼 공공기관이 직접 운영하는 사업은
            그쪽에 올라오지 않습니다. 기관마다 자기 홈페이지에만 올리기 때문에, 알고 찾아
            들어가지 않으면 있는 줄도 모릅니다. 여기 목록은 그 사업들을 기관이 아니라
            &lsquo;누가 받나&rsquo;와 &lsquo;무슨 분야인가&rsquo;로 다시 묶은 것입니다.
          </p>
          <p>
            생애주기를 먼저 고르시면 빠릅니다. 청년을 고르면 장학금·주거·취업 훈련이,
            어르신을 고르면 건강·돌봄·여가 쪽이 남습니다. 분야는 그다음입니다. 취업·직업을
            고르면 직업훈련과 자격검정이, 사회복지를 고르면 취약계층 지원이 모입니다.
            형태에서 &lsquo;사업지원&rsquo;은 돈이나 서비스를 주는 것, &lsquo;교육/상담&rsquo;은
            배우거나 물어볼 수 있는 것, &lsquo;평가/발급&rsquo;은 증명서나 자격을 내주는 것입니다.
          </p>
          <p>
            여기 나온 사업은 조건이 상세히 적혀 있지 않은 경우가 많습니다. 기관 안내로
            들어가 대상과 기간을 확인하시고, 지자체 사업과 겹치지 않는지도 보세요. 성격이
            다르면 둘 다 받을 수 있는 경우가 흔합니다.
          </p>
        </div>
      </section>

      <GuideBanner />
      <RelatedLinks items={agencyRelated()} />
      <PromoBanner placement="agency" context="general" />
    </div>
  );
}
