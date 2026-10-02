import AdBox, { adReady } from "./AdBox";
import { getSiteConfig } from "@/lib/settings";

/**
 * 제목 아래 작은 가로 광고 띠. 공고·채용 상세, 검색 결과, 자료 화면의 머리 띠
 * 바로 아래에 한 줄. 관리자가 켜 둔 때만, 비어 있으면 자리 자체를 그리지 않는다.
 * 채워지지 않은 광고는 css 가 상자째 감춘다.
 */
export default async function TopStripAd({ className = "mt-4" }: { className?: string }) {
  const { ads, adsOn } = await getSiteConfig();
  const s = ads.top_strip;
  if (!adsOn || !adReady(s)) return null;
  return <AdBox cfg={s} strip className={className} />;
}
