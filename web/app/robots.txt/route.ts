import { DEFAULT_SEO, getSiteConfig } from "@/lib/settings";

/**
 * robots.txt 를 직접 쓴다.
 *
 * 예전에는 Next 의 MetadataRoute.Robots 로 만들었는데, 그 방식은 규칙만
 * 내보내고 주석 줄을 넣을 수가 없다. 다음(Daum) 웹마스터도구는 소유 확인을
 * meta 가 아니라 robots.txt 안의 주석 한 줄로 받는다. 그래서 직접 쓴다.
 *
 * 값은 관리자 SEO 설정에서 바꾼다 — 코드를 고치러 오지 않아도 되게.
 */
export const revalidate = 3600;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://jiwon.knowhow-it.com";

/** 색인할 쪽이 아닌 경로. 검색 결과·지도 조회는 조합이 무한해 긁게 두면 서버만 먹는다. */
const HIDDEN = ["/admin", "/account", "/api/", "/search", "/find"];

/**
 * 통째로 막는 봇(2026-10-08). 손님을 보내지 않으면서 쪽을 긁어 가는 것들 —
 * AI 학습용 수집기(GPTBot·ClaudeBot·CCBot·Bytespider·Google-Extended 등)와 SEO 업체 크롤러(Ahrefs·Semrush·MJ12 등).
 * 검색엔진(Googlebot·Yeti·Daum·bingbot)과 AdSense(Mediapartners-Google)는 건드리지 않는다.
 * robots.txt 는 지키는 봇에게만 듣는다. 안 지키는 스캐너는 Caddy 에서 따로 막아야 한다.
 */
const BLOCKED = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "CCBot", "Google-Extended",
  "Bytespider", "PetalBot", "Amazonbot", "Applebot-Extended", "meta-externalagent", "FacebookBot", "cohere-ai",
  "Diffbot", "ImagesiftBot", "Omgilibot", "Timpibot", "YouBot", "PerplexityBot",
  "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "DataForSeoBot", "BLEXBot", "serpstatbot", "Barkrowler", "ZoominfoBot",
];

export async function GET() {
  // DB 를 못 읽어도 확인 줄은 나가야 한다. 사라지면 소유 확인이 풀린다.
  const { seo } = await getSiteConfig().catch(() => ({ seo: DEFAULT_SEO }));
  const daum = (seo.daum ?? "").trim();

  const lines = [
    ...(daum ? [daum.startsWith("#") ? daum : `#DaumWebMasterTool:${daum}`] : []),
    // 검색엔진과 광고(AdSense) 봇은 들어온다. 관리자·계정·API·검색 결과·지도 조회 같은 "쪽이 아닌 것"만 막는다.
    "User-agent: *",
    ...(seo.index ? ["Allow: /", ...HIDDEN.map((p) => `Disallow: ${p}`)] : ["Disallow: /"]),
    "",
    // 글을 긁어 가기만 하고 손님을 보내지 않는 봇. 학습용 수집기와 SEO 업체 크롤러. 지키는 쪽만 막힌다.
    ...BLOCKED.flatMap((ua) => [`User-agent: ${ua}`, "Disallow: /", ""]),
    `Sitemap: ${SITE}/sitemap.xml`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
