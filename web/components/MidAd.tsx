import AdBox, { adReady } from "./AdBox";
import HouseBanner from "./HouseBanner";
import type { PromoContext } from "@/lib/promo";
import { getSiteConfig, type AdSlotName } from "@/lib/settings";

/**
 * 본문 중간의 지면. 관리자가 광고를 켜 두면 그것을, 아니면 우리 사이트
 * 배너를 보인다. 빈 채로 두지 않는다 — 자리가 있으면 무언가를 알린다.
 */
export default async function MidAd({
  name, context = "general", seed, className = "my-10",
}: {
  name: AdSlotName;
  context?: PromoContext;
  seed: string;
  className?: string;
}) {
  const { ads } = await getSiteConfig();
  const s = ads[name];
  if (adReady(s)) return <AdBox cfg={s} className={className} />;
  return <HouseBanner context={context} placement={name} seed={seed} className={className} />;
}
