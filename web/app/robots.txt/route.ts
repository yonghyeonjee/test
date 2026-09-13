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

export async function GET() {
  // DB 를 못 읽어도 확인 줄은 나가야 한다. 사라지면 소유 확인이 풀린다.
  const { seo } = await getSiteConfig().catch(() => ({ seo: DEFAULT_SEO }));
  const daum = (seo.daum ?? "").trim();

  const lines = [
    ...(daum ? [daum.startsWith("#") ? daum : `#DaumWebMasterTool:${daum}`] : []),
    "User-agent: *",
    // 색인을 끄면 전부 막는다. 관리자 화면은 언제나 막는다.
    ...(seo.index ? ["Allow: /", "Disallow: /admin"] : ["Disallow: /"]),
    "",
    `Sitemap: ${SITE}/sitemap.xml`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
