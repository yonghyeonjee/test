import { promoLinks, type PromoContext } from "@/lib/promo";
import { SITE_NAME } from "@/lib/seo";

function withUtm(href: string, slug: string, placement: string) {
  const u = new URL(href);
  u.searchParams.set("utm_source", "narajiwon");
  u.searchParams.set("utm_medium", "banner");
  u.searchParams.set("utm_campaign", placement);
  u.searchParams.set("utm_content", slug);
  return u.toString();
}

/**
 * 같이 운영하는 무료 자료들. 바깥으로 나가는 링크라 어디서 왔는지 표시해 둔다.
 * 어떤 세 개를 보여 줄지는 lib/promo.ts 가 문맥을 보고 고른다.
 */
export default function PromoBanner({
  placement = "home",
  context = "general",
}: {
  /** utm_campaign 으로 들어간다. 어느 화면의 배너가 먹히는지 나눠 보려고. */
  placement?: string;
  /** 보고 있던 것과 이어지는 자료를 고르는 단서. */
  context?: PromoContext;
}) {
  const links = promoLinks(context);
  return (
    <section className="mt-16">
      <h2 className="text-[1.0625rem] font-bold">무료로 더 보기</h2>
      <p className="mb-3 mt-1 text-sm text-muted">
        {SITE_NAME}과 같이 운영하는 자료입니다. 모두 무료이고 회원가입이 없습니다.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {links.map((l) => (
          <a
            key={l.slug}
            href={withUtm(l.href, l.slug, placement)}
            target="_blank"
            rel="noopener noreferrer"
            className="card card-link block p-5"
          >
            <span className="badge badge-quiet">{l.tag}</span>
            <b className="mt-2.5 flex items-center gap-1 text-[15px]">
              {l.title}
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 shrink-0 text-faint"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </b>
            <span className="mt-1 block text-sm leading-relaxed text-muted">
              {l.desc}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
