import { indexXml } from "@/lib/sitemapTree";

/** 사이트맵 색인. 갈래별 사이트맵(/sitemap/<갈래>.xml)의 목록만 낸다. 자세한 것은 lib/sitemapTree. */
export const revalidate = 86400;

export function GET() {
  return new Response(indexXml(new Date()), {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
