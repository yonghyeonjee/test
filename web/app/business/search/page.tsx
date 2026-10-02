import type { Metadata } from "next";
import SearchView from "@/app/_search/SearchView";
import RelatedLinks from "@/components/RelatedLinks";
import { dbConfigured, getSigunguIndex } from "@/lib/db";
import { blogIndexRelated } from "@/lib/related";
import { unifiedSearch } from "@/lib/search";
import { brandKeys, withOg } from "@/lib/seo";

/**
 * 사업자 검색. 기업 첫 화면(/business)의 큰 검색창이 여기로 온다.
 *
 * 같은 통합 검색이지만 기업·소상공인 지원사업을 앞에 세우고, 개인 복지·채용·
 * 자격증은 건수만 적는다. 검색엔진에는 "사업자 지원금 검색" 같은 말로 따로
 * 걸리게 제 주소와 제목을 둔다 — 빈 검색창 쪽(검색어 없음)만 색인하고,
 * 검색어가 붙은 결과는 통합 검색처럼 막는다.
 */
export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v)?.trim() || "";

export function generateMetadata({ searchParams }: { searchParams: SP }): Metadata {
  const q = one(searchParams.q);
  if (q) {
    return withOg({
      title: `‘${q}’ 사업자 지원사업 검색`,
      description: `‘${q}’ 에 걸리는 중소기업·소상공인·창업 지원사업과 공공기관 사업을 한 번에 찾습니다.`,
      robots: { index: false, follow: true },
    });
  }
  return withOg({
    title: "사업자 나라지원 검색 — 소상공인·중소기업·창업 지원사업 한 줄로 찾기",
    description:
      "사업자라면 여기서 찾으세요. 기업마당·소상공인24·공공기관 사업 2,800여 건을 한 줄로 검색합니다. " +
      "수출·스마트공장·인건비·폐업·특허처럼 필요한 지원을 적으면 비슷한 말까지 같이 찾고, 지역·업종·업력 조건으로 좁힙니다.",
    keywords: [
      ...brandKeys("사업자 검색", "사업자 지원금 검색"),
      "사업자 정부지원 검색", "소상공인 지원사업 검색", "중소기업 지원사업 조회", "창업 지원금 검색",
      "정부 지원사업 찾기", "기업 지원금 조회", "소상공인 정책자금 검색",
    ],
    alternates: { canonical: "/business/search" },
  });
}

export default async function BusinessSearchPage({ searchParams }: { searchParams: SP }) {
  const q = one(searchParams.q);
  const [r, idx] = await Promise.all([
    unifiedSearch(q),
    dbConfigured ? getSigunguIndex().then((m) => Object.fromEntries(m)).catch(() => ({})) : Promise.resolve({}),
  ]);
  return (
    <>
      <SearchView
        q={q} r={r} idx={idx} scope="business" eyebrow="사업자 검색"
        title={q ? <>‘{q}’ 사업자 지원사업</> : "사업자를 위한 나라지원, 한 줄로 찾기"}
        sub="기업마당·소상공인24 공고와 공공기관 사업을 한 번에. 수출·인건비·폐업처럼 필요한 지원을 적으면 비슷한 말까지 같이 찾습니다."
        placeholder="무엇이 필요하세요 — 수출 바우처, 스마트공장, 소상공인 폐업, 특허"
        placeholderNarrow="수출, 스마트공장, 폐업, 특허…"
      />
      <RelatedLinks items={blogIndexRelated()} />
    </>
  );
}
