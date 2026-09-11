import type { Metadata } from "next";
import AgencyList from "@/components/AgencyList";
import { ArtAgency } from "@/components/Art";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { EVT_CATE, SIDO_SHORT, callAlio, toEvent } from "@/lib/alioplus";
import { EVENTS_INTRO, EVENTS_FAQ } from "@/lib/pageFaq";
import { agencyRelated } from "@/lib/related";
import { AgencyTabs } from "../page";

export const metadata: Metadata = {
  title: "공공기관 행사·교육 — 지역별 무료 강좌, 체험, 공모전",
  description:
    "전국 공공기관이 여는 교육·강연, 체험, 문화행사, 공모전을 지역과 유형으로 걸러 봅니다. " +
    "신청 가능 여부와 유무료를 함께 표시합니다.",
  keywords: ["공공기관 행사", "무료 교육 강좌", "공공기관 체험", "공모전", "지역 행사"],
  alternates: { canonical: "/agency/events" },
};

type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function AgencyEvents({ searchParams }: { searchParams: SP }) {
  const current = { sido: one(searchParams.sido), cate: one(searchParams.cate), q: one(searchParams.q) };
  const res = await callAlio("event", {
    schSiNa: current.sido ?? "", schFstCateCd: current.cate ?? "", schEvtNa: current.q ?? "",
  });
  const items = res.ok ? res.rows.map(toEvent).filter((x): x is NonNullable<typeof x> => !!x) : [];
  // 진행 중·예정을 앞에, 지난 것은 뒤로
  const today = new Date().toISOString().slice(0, 10);
  items.sort((a, b) => {
    const ap = (a.end ?? "9999") < today ? 1 : 0, bp = (b.end ?? "9999") < today ? 1 : 0;
    return ap - bp || (a.start ?? "9999").localeCompare(b.start ?? "9999");
  });

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="공공기관"
        title="공공기관이 여는 교육과 행사"
        sub="무료 강좌, 체험, 견학, 공모전. 공공기관은 국민 참여 행사를 꾸준히 열지만 기관 홈페이지에만 올라와 지나치기 쉽습니다."
        art={<ArtAgency />}
      />
      <AgencyTabs active="/agency/events" />
      <AgencyList
        base="/agency/events" items={items} ok={res.ok} reason={res.ok ? null : res.reason}
        facets={[
          { name: "sido", label: "지역", options: SIDO_SHORT.map((s) => ({ code: s, label: s })) },
          { name: "cate", label: "유형", options: EVT_CATE },
        ]}
        current={current} qName="q"
        empty="조건에 맞는 행사가 없습니다. 지역을 넓혀 보세요."
        external={{ href: "https://www.alioplus.go.kr", label: "알리오 플러스에서 직접 보기" }}
      />
      <p className="mt-3 text-xs leading-relaxed text-muted">
        기획재정부 알리오 플러스 공개 자료를 여섯 시간마다 받아 옵니다. 신청 방법과 기간은
        각 기관 안내에서 확인하세요.
      </p>
      <section className="mt-14">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">공공기관 행사, 이렇게 고르세요</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          {EVENTS_INTRO.map((t) => <p key={t.slice(0, 20)}>{t}</p>)}
        </div>
      </section>

      <Faq items={EVENTS_FAQ} />

      <GuideBanner />
      <RelatedLinks items={agencyRelated()} />
      <PromoBanner placement="agency-events" context="general" />
    </div>
  );
}
