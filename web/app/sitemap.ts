import type { MetadataRoute } from "next";
import { getAreas, getTopSourceIds } from "@/lib/db";
import { getJobHires, getJobRegions, getTopJobIds, getTopOrgs } from "@/lib/pubJobs";
import { POSTS } from "@/lib/posts";
import { getLicenses } from "@/lib/qnet";
import { TOPICS } from "@/lib/topics";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://jiwon.knowhow-it.com";

export const revalidate = 86400;

async function buildData(): Promise<
  [Awaited<ReturnType<typeof getAreas>>, Awaited<ReturnType<typeof getTopSourceIds>>]
> {
  try {
    return await Promise.all([getAreas(), getTopSourceIds(400)]);
  } catch (e) {
    console.warn("[sitemap] DB 를 읽지 못해 고정 경로만 내보낸다:", e);
    return [[], []];
  }
}

/** 자격 종목 상세. API 가 죽어 있으면 빈 목록 — 사이트맵은 그대로 나간다. */
async function licenseCodes(): Promise<string[]> {
  try {
    const b = await getLicenses();
    return b.all.filter((l) => l.code).map((l) => l.code);
  } catch {
    return [];
  }
}

/**
 * <lastmod> 에 넣을 날짜.
 *
 * 이게 없으면 검색엔진은 460개 주소 가운데 무엇이 새로 바뀌었는지 알 수
 * 없다. 그래서 다시 기어오는 순서를 정하지 못하고, 새 글이 늦게 잡힌다.
 * 값이 없거나 이상하면 아예 안 적는다 — 틀린 날짜는 없는 것만 못하다.
 */
function day(v: string | null | undefined): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v.length <= 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 사이트맵 하나 때문에 배포 전체가 실패하면 안 된다. DB 를 못 읽으면
  // 고정 경로만 내보내고, 다음 revalidate 때 다시 채운다.
  const [areas, ids] = await buildData();
  const codes = await licenseCodes();
  // 채용은 공고 수가 수만 건이 될 수 있다. 최근 것 400건과 지역 목차만 올린다.
  // 기관 쪽은 공고 여덟 건 이상인 곳만, 위에서부터 300곳.
  const [jobRegions, jobIds, jobOrgs, jobHires] = await Promise.all([
    getJobRegions(),
    getTopJobIds(400),
    getTopOrgs(300),
    getJobHires(),
  ]);

  // 자동 생성 페이지를 한 번에 수천 개 올리면 품질 평가에서 통째로 걸릴 수 있다.
  // 색인 상태를 보며 단계적으로 늘린다. 지금은 지역 + 상위 400건.
  return [
    { url: SITE, changeFrequency: "daily" as const, priority: 1 },
    { url: `${SITE}/?tab=business`, changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${SITE}/policies`, changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${SITE}/topic`, changeFrequency: "weekly" as const, priority: 0.8 },
    ...TOPICS.map((t) => ({ url: `${SITE}/topic/${t.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    { url: `${SITE}/money`, changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${SITE}/money/jeonse`, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${SITE}/money/student-loan`, changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${SITE}/license`, changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${SITE}/license/pro`, changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${SITE}/license/schedule`, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${SITE}/jobs`, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${SITE}/jobs/region`, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${SITE}/jobs/org`, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${SITE}/jobs/overseas`, changeFrequency: "daily" as const, priority: 0.7 },
    { url: `${SITE}/jobs/majors`, changeFrequency: "yearly" as const, priority: 0.7 },
    { url: `${SITE}/agency`, changeFrequency: "daily" as const, priority: 0.8 },
    { url: `${SITE}/agency/events`, changeFrequency: "daily" as const, priority: 0.7 },
    { url: `${SITE}/agency/facilities`, changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${SITE}/free`, changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${SITE}/about`, changeFrequency: "monthly" as const, priority: 0.7 },
    { url: `${SITE}/blog`, changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${SITE}/blog/income`, changeFrequency: "monthly" as const, priority: 0.8 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly" as const, priority: 0.2 },
    ...POSTS.map((p) => ({
      url: `${SITE}/blog/${p.slug}`,
      lastModified: day(p.updated),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...areas.map((a) => ({
      url: `${SITE}/area/${encodeURIComponent(a.sido)}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    ...ids.map((p) => ({
      url: `${SITE}/p/${encodeURIComponent(p.id)}`,
      lastModified: day(p.updated),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    // 구분별 목록. 값이 넷뿐이라 전부 올린다.
    ...jobHires.map((h) => ({
      url: `${SITE}/jobs/hire/${encodeURIComponent(h.hire)}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...jobRegions.map((r) => ({
      url: `${SITE}/jobs/region/${encodeURIComponent(r.sido)}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...jobOrgs.map((o) => ({
      url: `${SITE}/jobs/org/${encodeURIComponent(o.org)}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...jobIds.map((j) => ({
      url: `${SITE}/jobs/${encodeURIComponent(j.id)}`,
      lastModified: day(j.updated),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...codes.map((c) => ({
      url: `${SITE}/license/${encodeURIComponent(c)}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
