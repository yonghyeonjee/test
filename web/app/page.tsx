import type { Metadata } from "next";
import Home, { homeMetadata } from "./_home/Home";

/**
 * 첫 화면. 실제 내용은 _home/Home.tsx 에 있다 — 기업 지원사업 첫 화면(/business)이
 * 같은 것을 다른 탭으로 그리기 때문이다. Next 는 page.tsx 에 default·metadata
 * 말고 다른 것을 내보내지 못하게 하므로 둘이 함께 쓰는 것은 바깥에 둔다.
 *
 * 여기서는 searchParams 를 읽지 않는다. 읽는 순간 쪽이 매 요청 동적이 되어
 * ISR(15분) 이 꺼지고, 첫 화면이 매번 DB 를 두드렸다. 조건이 붙은 주소
 * (/?sido=…)는 미들웨어가 /find 로 바꿔 보낸다(주소창은 그대로).
 */
export const revalidate = 900;

export function generateMetadata(): Promise<Metadata> {
  return homeMetadata({ searchParams: {} });
}

export default function Page() {
  return <Home searchParams={{}} />;
}
