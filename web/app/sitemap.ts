import type { MetadataRoute } from "next";
import { getAreas, getTopSourceIds } from "@/lib/db";
import { POSTS } from "@/lib/posts";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://jiwon.knowhow-it.com";

export const revalidate = 86400;

async function buildData(): Promise<[Awaited<ReturnType<typeof getAreas>>, string[]]> {
  try {
    return await Promise.all([getAreas(), getTopSourceIds(400)]);
  } catch (e) {
    console.warn("[sitemap] DB 를 읽지 못해 고정 경로만 내보낸다:", e);
    return [[], []];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 사이트맵 하나 때문에 배포 전체가 실패하면 안 된다. DB 를 못 읽으면
  // 고정 경로만 내보내고, 다음 revalidate 때 다시 채운다.
  const [areas, ids] = await buildData();

  // 자동 생성 페이지를 한 번에 수천 개 올리면 품질 평가에서 통째로 걸릴 수 있다.
  // 색인 상태를 보며 단계적으로 늘린다. 지금은 지역 + 상위 400건.
  return [
    { url: SITE, changeFrequency: "daily" as const, priority: 1 },
    { url: `${SITE}/?tab=business`, changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${SITE}/about`, changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${SITE}/blog`, changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly" as const, priority: 0.2 },
    ...POSTS.map((p) => ({
      url: `${SITE}/blog/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
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
