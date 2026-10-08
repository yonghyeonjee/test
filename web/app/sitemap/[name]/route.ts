import { SITEMAP_SECTIONS, sectionEntries, urlsetXml, type Section } from "@/lib/sitemapTree";

/** 갈래별 사이트맵. /sitemap/jobs.xml 처럼 부른다. 모르는 갈래는 404. */
export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return SITEMAP_SECTIONS.map((name) => ({ name: `${name}.xml` }));
}

export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const name = params.name.replace(/\.xml$/, "") as Section;
  if (!(SITEMAP_SECTIONS as readonly string[]).includes(name)) return new Response("없는 사이트맵", { status: 404 });
  const entries = await sectionEntries(name);
  return new Response(urlsetXml(entries), {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
