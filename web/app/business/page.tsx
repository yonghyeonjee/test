import Home, { businessMetadata } from "../_home/Home";

/**
 * 기업·소상공인 지원사업 첫 화면.
 *
 * 전에는 /?tab=business 였다. 물음표 주소는 정본(canonical)에서 물음표 뒤가
 * 떨어져 첫 화면의 복제로 보였고, 주소만 봐서는 무엇인지도 알 수 없었다.
 * 구글 SEO 시작 가이드가 말하는 "뜻이 보이는 주소"로 바꾼다. 옛 주소는
 * next.config 가 308 로 넘긴다.
 *
 * searchParams 는 읽지 않는다(읽으면 매 요청 동적). 조건이 붙은 주소는
 * 미들웨어가 /find?tab=business 로 바꿔 보낸다.
 */
// 한 시간(예전 15분). 캐시 저장(ISR Writes)을 줄인다.
export const revalidate = 3600;
export const generateMetadata = () => businessMetadata();
export default function BusinessHome() {
  return <Home searchParams={{}} forceTab="business" />;
}
