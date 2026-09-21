import AdBox, { adReady } from "./AdBox";
import { getSiteConfig } from "@/lib/settings";

/**
 * 넓은 화면 오른쪽 여백에 붙어 있는 세로 광고.
 *
 * 애드센스 자동광고의 사이드 레일이 같은 자리에 잠깐 떴다가 접히는데,
 * 그 뜨고 사라지는 시점은 구글이 정한다. 차라리 우리가 자리를 정해 두면
 * 스크롤해도 그대로 있다. 본문 기둥(64rem) 바깥 여백이 세로 단위 하나가
 * 들어갈 만큼 남는 1536px 이상에서만 보이고, 화면이 낮으면 감춘다 —
 * 오른쪽 아래 떠 있는 메뉴와 겹치면 안 된다.
 *
 * 화면 안 이동 때도 그대로 두려고 레이아웃에 둔다. 페이지마다 그리면
 * 옮길 때마다 광고가 새로 불린다.
 */
export default async function SideRailAd() {
  const { ads, adsOn } = await getSiteConfig();
  const s = ads.side_rail;
  if (!adsOn || !adReady(s)) return null;
  return (
    <div className="side-rail">
      <AdBox cfg={s} tall />
    </div>
  );
}
