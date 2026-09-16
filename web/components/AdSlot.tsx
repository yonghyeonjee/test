import AdBox, { adReady } from "./AdBox";
import { getSiteConfig, type AdSlotName } from "@/lib/settings";

/**
 * 광고 지면. 관리자가 켠 자리에만, 본문이 끝난 뒤에만 나온다.
 * 비어 있으면 자리 자체를 그리지 않는다.
 */
export default async function AdSlot({ name, tall = false }: { name: AdSlotName; tall?: boolean }) {
  const { ads, adsOn } = await getSiteConfig();
  const s = ads[name];
  // 전체 스위치가 내려가 있으면 켜 둔 지면이라도 그리지 않는다.
  if (!adsOn || !adReady(s)) return null;
  return <AdBox cfg={s} className="mt-12" tall={tall} />;
}
