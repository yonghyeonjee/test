import { promoLinks, type PromoContext, type PromoLink } from "@/lib/promo";

/**
 * 우리가 같이 운영하는 사이트를 알리는 배너. 유료 광고가 비어 있는 자리에
 * 대신 들어간다. 자리마다 다른 것이 보이도록 seed 로 돌려 가며 고른다.
 *
 * 그림은 전부 SVG 로 그린다. 사이트마다 색을 달리해 세 배너가 한눈에 갈린다.
 */

type Look = { bg: string; ink: string; soft: string; art: React.ReactNode; cta: string };

const LOOK: Record<string, Look> = {
  english: {
    bg: "linear-gradient(135deg,#1E3A8A,#3B5BDB)", ink: "#fff", soft: "rgba(255,255,255,.72)", cta: "지금 시작",
    art: (
      <svg viewBox="0 0 120 90" className="h-full w-full" aria-hidden>
        <rect x="14" y="14" width="64" height="62" rx="8" fill="#fff" fillOpacity=".12" stroke="#fff" strokeOpacity=".5" />
        <text x="46" y="58" textAnchor="middle" fontSize="34" fontWeight="800" fill="#fff" fontFamily="inherit">Aa</text>
        <circle cx="92" cy="30" r="14" fill="#F59E0B" />
        <path d="M86 30l4 4 8-8" fill="none" stroke="#1E3A8A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  marketing: {
    bg: "linear-gradient(135deg,#0F766E,#14B8A6)", ink: "#fff", soft: "rgba(255,255,255,.75)", cta: "용어 보기",
    art: (
      <svg viewBox="0 0 120 90" className="h-full w-full" aria-hidden>
        <rect x="18" y="52" width="14" height="24" rx="3" fill="#fff" fillOpacity=".55" />
        <rect x="40" y="36" width="14" height="40" rx="3" fill="#fff" fillOpacity=".75" />
        <rect x="62" y="20" width="14" height="56" rx="3" fill="#fff" />
        <path d="M18 44l26-14 24-12 30-10" fill="none" stroke="#FDE68A" strokeWidth="3" strokeLinecap="round" />
        <circle cx="98" cy="8" r="5" fill="#FDE68A" />
      </svg>
    ),
  },
  psy: {
    bg: "linear-gradient(135deg,#4C1D95,#7C3AED)", ink: "#fff", soft: "rgba(255,255,255,.72)", cta: "30초 테스트",
    art: (
      <svg viewBox="0 0 120 90" className="h-full w-full" aria-hidden>
        <path d="M60 14c-18 0-30 12-30 27 0 9 4 16 11 21v12l12-8h7c18 0 30-12 30-25S78 14 60 14z" fill="#fff" fillOpacity=".16" stroke="#fff" strokeOpacity=".7" strokeWidth="2" />
        <circle cx="48" cy="40" r="4" fill="#fff" /><circle cx="62" cy="40" r="4" fill="#fff" /><circle cx="76" cy="40" r="4" fill="#fff" />
        <path d="M96 18l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L87 25l6-1z" fill="#FBBF24" />
      </svg>
    ),
  },
};

const lookOf = (l: PromoLink): Look =>
  l.slug === "english" ? LOOK.english : l.slug === "marketing" ? LOOK.marketing : LOOK.psy;

function withUtm(href: string, slug: string, placement: string) {
  const u = new URL(href);
  u.searchParams.set("utm_source", "narajiwon");
  u.searchParams.set("utm_medium", "house");
  u.searchParams.set("utm_campaign", placement);
  u.searchParams.set("utm_content", slug);
  return u.toString();
}

/** seed 문자열을 0..n-1 로. 같은 화면에서는 늘 같은 배너가 나온다. */
function pick(seed: string, n: number) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % n;
}

export default function HouseBanner({
  context = "general", placement, seed, className = "",
}: {
  context?: PromoContext;
  placement: string;
  /** 화면을 구별하는 값(경로 등). 자리마다 다른 배너가 나오게. */
  seed: string;
  className?: string;
}) {
  const links = promoLinks(context);
  const l = links[pick(seed, links.length)];
  const look = lookOf(l);
  return (
    <a
      href={withUtm(l.href, l.slug, placement)}
      target="_blank"
      rel="noopener noreferrer"
      className={`house group flex items-center gap-4 rounded-card px-5 py-4 text-white transition
                  hover:-translate-y-0.5 hover:shadow-lift sm:gap-6 sm:px-7 ${className}`}
      style={{ background: look.bg }}
    >
      <div className="h-16 w-20 shrink-0 sm:h-20 sm:w-24">{look.art}</div>
      <div className="min-w-0 flex-1">
        <span className="text-[10.5px] font-bold uppercase tracking-[.22em]" style={{ color: look.soft }}>
          무료 · {l.tag}
        </span>
        <b className="display mt-0.5 block text-[1.05rem] leading-tight sm:text-[1.2rem]">{l.title}</b>
        <span className="mt-1 block text-[13px] leading-snug" style={{ color: look.soft }}>{l.desc}</span>
      </div>
      <span className="hidden shrink-0 rounded-pill bg-white/15 px-4 py-2 text-[13px] font-bold
                       transition-colors group-hover:bg-white group-hover:text-ink sm:inline-flex">
        {look.cta} →
      </span>
    </a>
  );
}
