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
    <section className="mt-10 sm:mt-16">
      <h2 className="text-[1.0625rem] font-bold">무료로 더 보기</h2>
      <p className="mb-3 mt-1 text-[13px] text-muted sm:text-sm">
        {SITE_NAME}과 같이 운영하는 자료입니다. 모두 무료이고 회원가입이 없습니다.
      </p>
      {/* 목록은 한 번만 그린다. 전에는 휴대폰용·넓은 화면용을 둘 다 HTML 에 실어 같은 바깥 링크가 모든 쪽에
          두 번씩 들어갔다(2026-10-30 점검). 같이 운영하는 사이트로 가는 홍보 링크라 nofollow 를 단다 —
          사이트 전체에 깔린 바깥 링크로 평가를 넘기지 않는다. */}
      <ul className="card divide-y divide-line sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {links.map((l) => (
          <li key={l.slug}>
            <a href={withUtm(l.href, l.slug, placement)} target="_blank" rel="nofollow noopener noreferrer"
               className="flex items-center gap-2.5 px-4 py-3 sm:block sm:p-5">
              <span className="badge badge-quiet shrink-0">{l.tag}</span>
              <span className="min-w-0 flex-1 sm:mt-2.5 sm:block">
                <b className="block truncate text-[14px] sm:text-[15px]">{l.title}</b>
                <span className="block truncate text-[12px] text-muted sm:mt-1 sm:whitespace-normal sm:text-sm sm:leading-relaxed">{l.desc}</span>
              </span>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-faint sm:hidden" fill="none" stroke="currentColor"
                   strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
