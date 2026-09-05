import type { MetadataRoute } from "next";
import { getRegions } from "@/lib/db";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://jiwon.knowhow-it.com";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const regions = await getRegions();

  // 1단계에서는 지역 조건이 붙은 URL 만 올린다.
  // 자동 생성 페이지를 한 번에 수천 개 노출하면 품질 평가에서 통째로 걸릴 수 있어,
  // 색인 상태를 확인하며 단계적으로 늘린다.
  const entries: MetadataRoute.Sitemap = [
    { url: SITE, changeFrequency: "daily", priority: 1 },
  ];

  for (const r of regions) {
    entries.push({
      url: `${SITE}/?sido=${encodeURIComponent(r.sido)}`,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }
  return entries;
}
