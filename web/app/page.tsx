import type { Metadata } from "next";
import Home, { homeMetadata, type SP } from "./_home/Home";

/**
 * 첫 화면. 실제 내용은 _home/Home.tsx 에 있다 — 기업 지원사업 첫 화면(/business)이
 * 같은 것을 다른 탭으로 그리기 때문이다. Next 는 page.tsx 에 default·metadata
 * 말고 다른 것을 내보내지 못하게 하므로 둘이 함께 쓰는 것은 바깥에 둔다.
 */
export const revalidate = 900;

export function generateMetadata(p: { searchParams: SP }): Promise<Metadata> {
  return homeMetadata(p);
}

export default function Page({ searchParams }: { searchParams: SP }) {
  return <Home searchParams={searchParams} />;
}
