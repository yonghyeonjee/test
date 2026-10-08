/**
 * 사이트맵을 나무꼴로. /sitemap.xml 은 갈래 목록(색인)이고, 갈래마다 /sitemap/<갈래>.xml 이 따로 나간다.
 *
 * 2026-10-08 까지는 한 파일에 수천 주소를 평평하게 담았다. 나누면 검색엔진이 갈래마다 따로 긁어 가고,
 * 서치콘솔·서치어드바이저에서 어느 갈래가 색인에서 빠지는지 보인다. 한 갈래의 DB 읽기가 실패해도
 * 다른 갈래는 그대로 나간다.
 *
 *   pages     고정 쪽(첫 화면, 갈래 허브, 소개 …)
 *   programs  지원사업 — 시·도 쪽과 상위 400건
 *   jobs      채용 — 구분·지역·기관 목차와 최근 400건
 *   licenses  자격증 종목
 *   housing   주거 지원 — 대상×종류와 시·도
 *   posts     읽을거리 — 안내 글과 이야기
 */
import { getAreas, getTopSourceIds } from "./db";
import { KIND_KEYS, WHO_KEYS, housingCounts, housingPath, sidosFor } from "./housing";
import { POSTS } from "./posts";
import { getJobHires, getJobRegions, getTopJobIds, getTopOrgs } from "./pubJobs";
import { getLicenses } from "./qnet";
import { getStories } from "./stories";
import { TOPICS } from "./topics";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://jiwon.knowhow-it.com";

export type Freq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
export type Entry = { url: string; lastModified?: Date; changeFrequency?: Freq; priority?: number };

export const SITEMAP_SECTIONS = ["pages", "programs", "jobs", "licenses", "housing", "posts"] as const;
export type Section = (typeof SITEMAP_SECTIONS)[number];

/** <lastmod> 에 넣을 날짜. 값이 없거나 이상하면 아예 안 적는다 — 틀린 날짜는 없는 것만 못하다. */
function day(v: string | null | undefined): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v.length <= 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const e = (path: string, changeFrequency: Freq, priority: number, lastModified?: Date): Entry =>
  ({ url: `${SITE}${path}`, changeFrequency, priority, ...(lastModified ? { lastModified } : {}) });

function pages(): Entry[] {
  return [
    e("", "daily", 1),
    e("/business", "daily", 0.9),
    e("/policies", "daily", 0.9),
    e("/topic", "weekly", 0.8),
    ...TOPICS.map((t) => e(`/topic/${t.slug}`, "daily", 0.8)),
    e("/money", "weekly", 0.8),
    e("/money/jeonse", "daily", 0.8),
    e("/money/home-loan", "weekly", 0.8),
    e("/money/student-loan", "weekly", 0.8),
    e("/license", "weekly", 0.8),
    e("/license/pro", "weekly", 0.7),
    e("/license/schedule", "daily", 0.8),
    e("/jobs", "daily", 0.8),
    e("/jobs/region", "daily", 0.8),
    e("/jobs/org", "daily", 0.8),
    e("/jobs/overseas", "daily", 0.7),
    e("/jobs/majors", "yearly", 0.7),
    e("/agency", "daily", 0.8),
    e("/agency/events", "daily", 0.7),
    e("/agency/facilities", "weekly", 0.7),
    e("/free", "monthly", 0.7),
    e("/business/search", "weekly", 0.8),
    e("/map", "daily", 0.8),
    e("/about", "monthly", 0.7),
    e("/blog", "weekly", 0.8),
    e("/story", "weekly", 0.7),
    e("/housing", "daily", 0.9),
    e("/privacy", "yearly", 0.2),
  ];
}

/** 지원사업: 시·도 쪽과 상위 400건. 자동 생성 쪽을 한 번에 수천 개 올리면 품질 평가에서 통째로 걸릴 수 있어 단계적으로 늘린다. */
async function programs(): Promise<Entry[]> {
  const [areas, ids] = await Promise.all([getAreas(), getTopSourceIds(400)]);
  return [
    ...areas.map((a) => e(`/area/${encodeURIComponent(a.sido)}`, "weekly", 0.9)),
    ...ids.map((p) => e(`/p/${encodeURIComponent(p.id)}`, "weekly", 0.7, day(p.updated))),
  ];
}

/** 채용: 구분(넷뿐이라 전부)·지역·기관(공고 여덟 건 이상, 300곳) 목차와 최근 400건. */
async function jobs(): Promise<Entry[]> {
  const [hires, regions, orgs, ids] = await Promise.all([getJobHires(), getJobRegions(), getTopOrgs(300), getTopJobIds(400)]);
  return [
    ...hires.map((h) => e(`/jobs/hire/${encodeURIComponent(h.hire)}`, "daily", 0.7)),
    ...regions.map((r) => e(`/jobs/region/${encodeURIComponent(r.sido)}`, "daily", 0.7)),
    ...orgs.map((o) => e(`/jobs/org/${encodeURIComponent(o.org)}`, "weekly", 0.6)),
    ...ids.map((j) => e(`/jobs/${encodeURIComponent(j.id)}`, "weekly", 0.6, day(j.updated))),
  ];
}

async function licenses(): Promise<Entry[]> {
  const b = await getLicenses();
  return b.all.filter((l) => l.code).map((l) => e(`/license/${encodeURIComponent(l.code)}`, "monthly", 0.6));
}

/** 주거 지원: 대상×종류 9쪽은 늘, 시·도 쪽은 사업 3건 이상인 곳만. */
async function housing(): Promise<Entry[]> {
  const counts = await housingCounts();
  return WHO_KEYS.flatMap((who) =>
    KIND_KEYS.flatMap((kind) => [
      e(housingPath(kind, who), "daily", 0.8),
      ...sidosFor(counts, kind, who, 3).map((s) => e(housingPath(kind, who, s.sido), "daily", 0.7)),
    ]),
  );
}

/** 읽을거리: 손으로 쓴 안내 글, 코드 안의 글 목록, 자동 생성 이야기. */
async function posts(): Promise<Entry[]> {
  const stories = await getStories(200);
  return [
    e("/blog/youth-future-savings", "daily", 0.9),
    e("/blog/income", "monthly", 0.8),
    e("/blog/gojobs-guide", "monthly", 0.9),
    e("/story/jeonse-extension", "monthly", 0.9),
    ...POSTS.map((p) => e(`/blog/${p.slug}`, "monthly", 0.6, day(p.updated))),
    ...stories.map((s) => e(`/story/${encodeURIComponent(s.slug)}`, "weekly", 0.8, day(s.updated_at))),
  ];
}

const BUILDERS: Record<Section, () => Entry[] | Promise<Entry[]>> = { pages, programs, jobs, licenses, housing, posts };

/** 한 갈래의 주소 목록. DB 를 못 읽으면 빈 목록 — 사이트맵 하나 때문에 전체가 깨지지 않게. */
export async function sectionEntries(name: Section): Promise<Entry[]> {
  try {
    return await BUILDERS[name]();
  } catch (err) {
    console.warn(`[sitemap] ${name} 갈래를 못 읽어 비워 둔다:`, err);
    return name === "pages" ? pages() : [];
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function urlsetXml(entries: Entry[]): string {
  const body = entries.map((u) => {
    const lm = u.lastModified ? `<lastmod>${u.lastModified.toISOString()}</lastmod>` : "";
    const cf = u.changeFrequency ? `<changefreq>${u.changeFrequency}</changefreq>` : "";
    const pr = u.priority !== undefined ? `<priority>${u.priority}</priority>` : "";
    return `<url><loc>${esc(u.url)}</loc>${lm}${cf}${pr}</url>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function indexXml(lastmod: Date): string {
  const body = SITEMAP_SECTIONS
    .map((s) => `<sitemap><loc>${esc(`${SITE}/sitemap/${s}.xml`)}</loc><lastmod>${lastmod.toISOString()}</lastmod></sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}
