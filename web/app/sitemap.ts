import type { MetadataRoute } from "next";
import { getAreas, getTopSourceIds } from "@/lib/db";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://jiwon.knowhow-it.com";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [areas, ids] = await Promise.all([getAreas(), getTopSourceIds(400)]);

  // 자동 생성 페이지를 한 번에 수천 개 올리면 품질 평가에서 통째로 걸릴 수 있다.
  // 색인 상태를 보며 단계적으로 늘린다. 지금은 지역 + 상위 400건.
  return [
    { url: SITE, changeFrequency: "daily", priority: 1 },
    ...areas.map((a) => ({
      url: `${SITE}/area/${encodeURIComponent(a.sido)}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...ids.map((id) => ({
      url: `${SITE}/p/${encodeURIComponent(id)}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
