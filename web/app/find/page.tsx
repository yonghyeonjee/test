import type { Metadata } from "next";
import Home, { businessMetadata, homeMetadata, type SP } from "../_home/Home";

/**
 * 조건 검색 결과. 겉으로는 /?sido=… 와 /business?target=… 주소지만, 미들웨어가
 * 여기로 바꿔 보낸다(rewrite). 첫 화면(/, /business)은 조건을 읽지 않아
 * 캐시가 되고, 조건이 있는 요청만 여기서 매번 그린다.
 */
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  return one(searchParams.tab) === "business" ? businessMetadata() : homeMetadata({ searchParams });
}

export default function Find({ searchParams }: { searchParams: SP }) {
  const biz = one(searchParams.tab) === "business";
  return <Home searchParams={searchParams} forceTab={biz ? "business" : undefined} />;
}
