import type { AdSlotCfg } from "@/lib/settings";

/** 광고 하나를 그린다. 관리자가 넣은 HTML 이거나 이미지 배너. */
export default function AdBox({ cfg, className = "" }: { cfg: AdSlotCfg; className?: string }) {
  return (
    <aside className={`ad-slot ${className}`} aria-label="광고">
      <span className="ad-tag">광고</span>
      {cfg.kind === "image" ? (
        <a href={cfg.href || "#"} target="_blank" rel="noopener noreferrer sponsored" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cfg.img} alt={cfg.alt || "광고"} className="mx-auto max-h-[140px] w-auto max-w-full" loading="lazy" />
        </a>
      ) : (
        <div className="ad-html" dangerouslySetInnerHTML={{ __html: cfg.html }} />
      )}
    </aside>
  );
}

export const adReady = (cfg: AdSlotCfg | undefined) =>
  !!cfg?.on && (cfg.kind === "image" ? !!cfg.img : !!cfg.html.trim());
