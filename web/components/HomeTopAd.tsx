import AdBox, { adReady } from "./AdBox";
import { getSiteConfig } from "@/lib/settings";
import { promoLinks } from "@/lib/promo";

/**
 * 넓은 화면 홈 맨 위, 롤링 띠 오른쪽의 광고 지면(72px). 관리자 화면의 "홈 맨 위" 지면에서 켠다.
 * 비어 있거나 광고를 꺼 두면 같이 운영하는 무료 자료 배너가 그 자리를 채운다 — 빈 상자를 남기지 않는다.
 */
export default async function HomeTopAd({ className = "" }: { className?: string }) {
  const { ads, adsOn } = await getSiteConfig();
  const s = ads.home_top;
  if (adsOn && adReady(s)) return <AdBox cfg={s} band minWidth={1024} className={className} />;
  const l = promoLinks("general")[0];
  if (!l) return null;
  const u = new URL(l.href);
  u.searchParams.set("utm_source", "narajiwon");
  u.searchParams.set("utm_medium", "banner");
  u.searchParams.set("utm_campaign", "home_top");
  u.searchParams.set("utm_content", l.slug);
  return (
    <a href={u.toString()} target="_blank" rel="noopener noreferrer"
       className={`card card-link flex h-[72px] items-center gap-3 px-4 ${className}`}>
      <span className="badge badge-quiet shrink-0">{l.tag}</span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[14.5px]">{l.title}</b>
        <span className="block truncate text-[12.5px] text-muted">{l.desc}</span>
      </span>
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-faint" fill="none" stroke="currentColor"
           strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 17L17 7M9 7h8v8" />
      </svg>
    </a>
  );
}
