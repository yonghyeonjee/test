import AdBox, { adReady } from "./AdBox";
import { getSiteConfig, type AdSlotName } from "@/lib/settings";

/**
 * 광고 지면. 관리자가 켠 자리에만, 본문이 끝난 뒤에만 나온다.
 * 비어 있으면 자리 자체를 그리지 않는다.
 */
export default async function AdSlot({ name }: { name: AdSlotName }) {
  const { ads } = await getSiteConfig();
  const s = ads[name];
  if (!adReady(s)) return null;
  return <AdBox cfg={s} className="mt-12" />;
}
