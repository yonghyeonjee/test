import type { Metadata } from "next";
import SearchView from "@/app/_search/SearchView";
import RelatedLinks from "@/components/RelatedLinks";
import { dbConfigured, getSigunguIndex } from "@/lib/db";
import { blogIndexRelated } from "@/lib/related";
import { getHotTerms } from "@/lib/hotTerms";
import { unifiedSearch } from "@/lib/search";
import { withOg } from "@/lib/seo";

/**
 * 통합 검색. 머리말 검색창과 첫 화면의 큰 검색창이 여기로 온다.
 *
 * 한 화면에 복지·기업·채용·자격증·공공기관·안내 글을 갈래별로 몇 건씩 보이고,
 * 갈래마다 "상세 검색"으로 이어 준다. 낱말은 연관어까지 넓혀 찾는다("경비" →
 * 경호·보안·방호). 몸통은 _search/SearchView — 사업자 검색(/business/search)과 같이 쓴다.
 *
 * 검색어마다 주소가 생기므로 색인은 막는다.
 */
export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v)?.trim() || "";

export function generateMetadata({ searchParams }: { searchParams: SP }): Metadata {
  const q = one(searchParams.q);
  return withOg({
    title: q ? `‘${q}’ 통합 검색` : "통합 검색",
    description: "복지·기업 지원사업, 공공기관 채용, 국가자격, 공공기관 사업, 안내 글을 한 번에 찾습니다. 연관어까지 같이 찾습니다.",
    robots: { index: false, follow: true },
  });
}

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const q = one(searchParams.q);
  const [r, idx, hot] = await Promise.all([
    unifiedSearch(q),
    dbConfigured ? getSigunguIndex().then((m) => Object.fromEntries(m)).catch(() => ({})) : Promise.resolve({}),
    getHotTerms(),
  ]);
  return (
    <>
      <SearchView
        q={q} r={r} idx={idx} scope="all" eyebrow="통합 검색"
        title={q ? <>‘{q}’ 찾은 결과</> : "무엇이든 한 줄로 찾아보세요"}
        sub="복지·기업 지원사업, 공공기관 채용, 국가자격, 공공기관 사업, 안내 글을 한 번에. 비슷한 말도 같이 찾습니다."
        hot={hot.welfare}
      />
      <RelatedLinks items={blogIndexRelated()} />
    </>
  );
}
