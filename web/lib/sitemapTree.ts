/**
 * 사이트맵을 나무꼴로. /sitemap.xml 은 갈래 목록(색인)이고, 갈래마다 /sitemap/<갈래>.xml 이 따로 나간다.
 *
 * 2026-10-08 까지는 한 파일에 수천 주소를 평평하게 담았다. 나누면 검색엔진이 갈래마다 따로 긁어 가고,
 * 서치콘솔·서치어드바이저에서 어느 갈래가 색인에서 빠지는지 보인다. 한 갈래의 DB 읽기가 실패해도
 * 다른 갈래는 그대로 나간다.
 *
 *   pages     고정 쪽(첫 화면, 갈래 허브, 소개 …)
 *   programs  지원사업 — 시·도 쪽과 접수 중·상시 상위 400건
 *   jobs      채용 — 구분·지역·기관 목차와 접수 중인 나라일터 모집 공고(색인하는 것만)
 *   licenses  자격증 종목 — 찾는 사람이 있는 것만
 *   housing   주거 지원 — 대상×종류와 그 시·도 사업이 많은 시·도
 *   posts     읽을거리 — 손으로 쓴 안내 글과 기관·직무·자격증 분석 글
 *
 * 2026-10-17: 사이트 전체가 색인에서 빠진 뒤로 각 갈래에는 색인시키는(noindex 가 아닌) 쪽만 올린다.
 * 기준은 쪽마다 한 곳에 있다 — lib/db programIndexable, lib/qnet licenseIndexable, lib/housing SIDO_*_MIN.
 *
 * 2026-10-24: 1,632 → 600 안쪽으로 더 줄인다. 10/23 사이트맵을 다시 낸 뒤에도 허브 쪽(/map /story /license …)이 2~4주째
 * 다시 긁히지 않는다 — 구글이 이 사이트에 쓰는 크롤링 양이 작아, 같은 틀의 상세 쪽 수백 개가 허브 몫을 먹는다. 상세 쪽은
 * 사이트맵에서 빼도 noindex 가 아니라 허브·목차에서 링크를 타고 가면 색인된다. 허브가 먼저 돌아오면 다시 늘린다.
 */
import { getAreas, getTopSourceIds } from "./db";
import { KIND_KEYS, SIDO_SITEMAP_MIN, WHO_KEYS, housingCounts, housingPath, sidosFor } from "./housing";
import { POSTS } from "./posts";
import { getPublicOrgs } from "./govData";
import { getStories, storyIndexable } from "./stories";
import { ORG_INDEX_MIN, getJobHires, getJobRegions, getOrgRecentCounts, getTopJobIds, getTopOrgs } from "./pubJobs";
import { LICENSE_DEMAND_MIN, getLicenses, licenseApplicants, licenseIndexable } from "./qnet";
import { TOPICS } from "./topics";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://jiwon.knowhow-it.com";

/**
 * 갈래마다 올리는 상세 쪽 수(2026-10-24). 허브와 목차는 전부, 상세는 가장 쓸모 있는 것만.
 * 지원사업 250 → 100, 공고 300 → 100, 기관 목차 300 → 120, 자격증 전체(320) → 응시자 상위 120, 글 200 → 80, 공공기관 342 → 120.
 */
export const SITEMAP_CAP = { programs: 100, jobs: 100, jobOrgs: 120, licenses: 120, stories: 80, orgs: 120 } as const;

export type Freq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
export type Entry = { url: string; lastModified?: Date; changeFrequency?: Freq; priority?: number };

export const SITEMAP_SECTIONS = ["pages", "programs", "jobs", "licenses", "housing", "posts", "orgs"] as const;
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
    e("/orgs", "weekly", 0.8),
    e("/free", "monthly", 0.7),
    e("/business/search", "weekly", 0.8),
    e("/map", "daily", 0.8),
    e("/calendar", "daily", 0.8),
    e("/about", "monthly", 0.7),
    e("/blog", "weekly", 0.8),
    e("/story", "weekly", 0.7),
    e("/housing", "daily", 0.9),
    e("/privacy", "yearly", 0.2),
  ];
}

/**
 * 지원사업: 시·도 쪽과 상위 SITEMAP_CAP.programs 건(2026-10-21 400 → 250, 10-24 → 100). 자동 생성 쪽을 한 번에 수천 개 올리면 품질 평가에서 통째로 걸릴 수 있어 단계적으로 늘린다.
 * 400건은 마감되지 않았고 꼬리표뿐인 기업마당이 아닌 것에서 고른다(getTopSourceIds, 2026-10-17).
 */
async function programs(): Promise<Entry[]> {
  const [areas, ids] = await Promise.all([getAreas(), getTopSourceIds(SITEMAP_CAP.programs)]);
  return [
    ...areas.map((a) => e(`/area/${encodeURIComponent(a.sido)}`, "weekly", 0.9)),
    ...ids.map((p) => e(`/p/${encodeURIComponent(p.id)}`, "weekly", 0.7, day(p.updated))),
  ];
}

/**
 * 채용: 구분(넷뿐이라 전부)·지역(시·도 고정)·기관(공고 여덟 건 이상, 300곳) 목차와 색인하는 공고(접수 중인
 * 나라일터 모집 공고, 요약 있는 것 먼저 — getTopJobIds). 공고는 SITEMAP_CAP.jobs 건만(2026-10-21 1,200 → 300, 10-24 → 100): 10/11 뒤 사이트가
 * 통째로 "크롤링됨 - 색인 안 됨"이 되어, 같은 틀의 상세 쪽을 줄이고 목차·글·기관 쪽에 무게를 둔다.
 */
async function jobs(): Promise<Entry[]> {
  const [hires, regions, topOrgs, ids] = await Promise.all([getJobHires(), getJobRegions(), getTopOrgs(SITEMAP_CAP.jobOrgs), getTopJobIds(SITEMAP_CAP.jobs)]);
  // 2026-10-17 기관 쪽은 최근 365일 공고가 ORG_INDEX_MIN 건 미만이면 noindex 라 사이트맵에서도 뺀다(300곳 중 30곳쯤,
  // 이름이 바뀐 부처 등). 못 세면 그대로 둔다.
  const recent = await getOrgRecentCounts(topOrgs.map((o) => o.org)).catch(() => null);
  const orgs = recent ? topOrgs.filter((o) => (recent.get(o.org) ?? 0) >= ORG_INDEX_MIN) : topOrgs;
  return [
    // 기관별 작성 가이드(/jobs/guide 와 그 아래)는 자동으로 쓴 글이라 noindex 로 돌리며 뺐다(2026-10-17).
    ...hires.map((h) => e(`/jobs/hire/${encodeURIComponent(h.hire)}`, "daily", 0.7)),
    ...regions.map((r) => e(`/jobs/region/${encodeURIComponent(r.sido)}`, "daily", 0.7)),
    ...orgs.map((o) => e(`/jobs/org/${encodeURIComponent(o.org)}`, "weekly", 0.6)),
    ...ids.map((j) => e(`/jobs/${encodeURIComponent(j.id)}`, "weekly", 0.6, day(j.updated))),
  ];
}

/**
 * 자격증: 응시자가 많은 종목만(licenseIndexable 에 LICENSE_DEMAND_MIN, 2026-10-17 기준 613 → 320종목). 응시자 통계를 못 읽으면
 * 종목 쪽도 색인을 끄지 않으니(fail open) 여기서도 전부 올린다.
 */
async function licenses(): Promise<Entry[]> {
  const b = await getLicenses();
  const applicants = await licenseApplicants().catch((err) => {
    console.warn("[sitemap] 응시자 통계를 못 읽어 자격증 종목을 전부 올린다:", err);
    return null;
  });
  const ok = b.all.filter((l) => l.code && (applicants === null || licenseIndexable(l, b.all, applicants, LICENSE_DEMAND_MIN)));
  // 응시자가 많은 종목부터 SITEMAP_CAP.licenses 개(2026-10-24). 통계가 없으면 목록 순서 그대로 자른다.
  const ranked = applicants ? [...ok].sort((a, c) => (applicants.get(c.code) ?? 0) - (applicants.get(a.code) ?? 0)) : ok;
  return ranked.slice(0, SITEMAP_CAP.licenses).map((l) => e(`/license/${encodeURIComponent(l.code)}`, "monthly", 0.6));
}

/** 주거 지원: 대상×종류 9쪽은 늘, 시·도 쪽은 그 시·도 사업(전국 제외)이 SIDO_SITEMAP_MIN 건 이상인 곳만. */
async function housing(): Promise<Entry[]> {
  const counts = await housingCounts();
  return WHO_KEYS.flatMap((who) =>
    KIND_KEYS.flatMap((kind) => [
      e(housingPath(kind, who), "daily", 0.8),
      ...sidosFor(counts, kind, who, SIDO_SITEMAP_MIN).map((s) => e(housingPath(kind, who, s.sido), "daily", 0.7)),
    ]),
  );
}

/**
 * 읽을거리: 손으로 쓴 안내 글, 코드 안의 글 목록, 자동 글 가운데 색인하는 갈래(기관·직무·자격증, lib/stories
 * storyIndexable). 브리핑·주제·지역·순위 연재는 noindex 로 돌리며 뺐다(2026-10-17).
 */
async function posts(): Promise<Entry[]> {
  const stories = (await getStories(200)).filter(storyIndexable).slice(0, SITEMAP_CAP.stories);
  return [
    e("/blog/youth-future-savings", "daily", 0.9),
    e("/blog/income", "monthly", 0.8),
    e("/blog/gojobs-guide", "monthly", 0.9),
    e("/story/jeonse-extension", "monthly", 0.9),
    ...POSTS.map((p) => e(`/blog/${p.slug}`, "monthly", 0.6, day(p.updated))),
    ...stories.map((s) => e(`/story/${encodeURIComponent(s.slug)}`, "weekly", 0.8, day(s.updated_at))),
  ];
}

/**
 * 공공기관 상세(2026-10-21). 잡알리오 지정 공공기관 342곳. 2026-10-24 부터는 기관소개가 있는 곳을 앞에 두고
 * SITEMAP_CAP.orgs 곳만 — 소개가 없는 쪽은 이름·주소·링크뿐이라 얇다.
 */
async function orgs(): Promise<Entry[]> {
  const all = await getPublicOrgs();
  const ranked = [...all].sort((a, b) => (b.intro?.length ?? 0) - (a.intro?.length ?? 0));
  return ranked.slice(0, SITEMAP_CAP.orgs).map((o) => e(`/orgs/${o.id}`, "monthly", 0.6));
}

const BUILDERS: Record<Section, () => Entry[] | Promise<Entry[]>> = { pages, programs, jobs, licenses, housing, posts, orgs };

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
