import type { Metadata } from "next";
import AgencyList from "@/components/AgencyList";
import { ArtAgency } from "@/components/Art";
import GuideBanner from "@/components/GuideBanner";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { FCLT_CATE, SIDO_SHORT, callAlio, toFacility } from "@/lib/alioplus";
import { agencyRelated } from "@/lib/related";
import { AgencyTabs } from "../page";

export const metadata: Metadata = {
  title: "공공기관 시설 이용 — 지역별 체육시설, 회의실, 강당 예약",
  description:
    "공공기관이 개방하는 체육시설, 문화시설, 회의실, 강당을 지역과 종류로 걸러 봅니다. " +
    "예약 가능 여부와 유무료를 함께 표시합니다.",
  keywords: ["공공기관 시설 대관", "공공 체육시설", "회의실 대여 무료", "강당 대관", "공공시설 예약"],
  alternates: { canonical: "/agency/facilities" },
};

type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function AgencyFacilities({ searchParams }: { searchParams: SP }) {
  const current = { sido: one(searchParams.sido), cate: one(searchParams.cate), q: one(searchParams.q) };
  const res = await callAlio("facility", {
    schSiNa: current.sido ?? "", schFstCateCd: current.cate ?? "", schFacltNa: current.q ?? "",
  });
  const items = res.ok ? res.rows.map(toFacility).filter((x): x is NonNullable<typeof x> => !!x) : [];

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="공공기관"
        title="공공기관 시설, 국민도 쓸 수 있습니다"
        sub="체육관, 강당, 회의실, 주차장. 공공기관 시설 상당수가 개방되어 있고 무료거나 매우 쌉니다. 어디가 열려 있는지 지역별로 봅니다."
        art={<ArtAgency />}
      />
      <AgencyTabs active="/agency/facilities" />
      <AgencyList
        base="/agency/facilities" items={items} ok={res.ok} reason={res.ok ? null : res.reason}
        facets={[
          { name: "sido", label: "지역", options: SIDO_SHORT.map((s) => ({ code: s, label: s })) },
          { name: "cate", label: "종류", options: FCLT_CATE },
        ]}
        current={current} qName="q"
        empty="조건에 맞는 시설이 없습니다. 종류를 넓혀 보세요."
        external={{ href: "https://www.alioplus.go.kr", label: "알리오 플러스에서 직접 보기" }}
      />
      <p className="mt-3 text-xs leading-relaxed text-muted">
        기획재정부 알리오 플러스 공개 자료를 여섯 시간마다 받아 옵니다. 개방 시간과 예약 방법은
        각 기관 안내에서 확인하세요.
      </p>
      <GuideBanner />
      <RelatedLinks items={agencyRelated()} />
      <PromoBanner placement="agency-facilities" context="general" />
    </div>
  );
}
