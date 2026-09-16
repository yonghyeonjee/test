import AdHtml from "./AdHtml";
import type { AdSlotCfg } from "@/lib/settings";

/**
 * 광고 하나를 그린다. 관리자가 넣은 HTML 이거나 이미지 배너.
 *
 * tall: 높이를 막지 않는다. 멀티플렉스처럼 카드가 여러 줄로 깔리는
 * 광고는 200px 에 자르면 윗줄만 보이고 잘린다.
 */
export default function AdBox({ cfg, className = "", tall = false }: {
  cfg: AdSlotCfg; className?: string; tall?: boolean;
}) {
  return (
    <aside className={`ad-slot ${tall ? "ad-tall" : ""} ${className}`} aria-label="광고">
      <span className="ad-tag">광고</span>
      {cfg.kind === "image" ? (
        <a href={cfg.href || "#"} target="_blank" rel="noopener noreferrer sponsored" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cfg.img} alt={cfg.alt || "광고"}
               className={`mx-auto w-auto max-w-full ${tall ? "" : "max-h-[140px]"}`} loading="lazy" />
        </a>
      ) : (
        <AdHtml html={cfg.html} />
      )}
    </aside>
  );
}

export const adReady = (cfg: AdSlotCfg | undefined) =>
  !!cfg?.on && (cfg.kind === "image" ? !!cfg.img : !!cfg.html.trim());
