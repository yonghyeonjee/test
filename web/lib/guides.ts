import { cache } from "react";
import { db, dbConfigured } from "./db";
import type { Block } from "./stories";
import type { QA } from "./faq";

/**
 * 기관별 "자기소개서·직무수행계획서 작성 가이드"(org_guides).
 *
 * 파이프라인(pipeline/org_guide.py)이 하루 몇 곳씩 만들어 넣는다. 여기서는 읽기만 한다 —
 * 요청마다 검색이나 모델을 부르지 않으니 쪽은 늘 빠르고, 비용은 글을 쓸 때 한 번만 든다.
 */
export type Guide = {
  org: string;
  slug: string;
  title: string;
  summary: string;
  keywords: string[];
  body: Block[];
  faq: QA[];
  sources: { title: string; uri: string; domain: string }[];
  published_at: string;
  updated_at: string;
};

const COLS = "org,slug,title,summary,keywords,body,faq,sources,published_at,updated_at";

export async function getGuides(limit = 200): Promise<Guide[]> {
  if (!dbConfigured) return [];
  try {
    const { data } = await db.from("org_guides_public").select(COLS)
      .order("updated_at", { ascending: false }).limit(limit);
    return (data ?? []) as Guide[];
  } catch {
    return [];
  }
}

export const getGuideBySlug = cache(async (slug: string): Promise<Guide | null> => {
  if (!dbConfigured) return null;
  try {
    const { data } = await db.from("org_guides_public").select(COLS).eq("slug", slug).maybeSingle();
    return (data as Guide | null) ?? null;
  } catch {
    return null;
  }
});

/**
 * 가이드 쪽(/jobs/guide/[slug])이 쓰는 엄격한 판. DB 오류를 "없는 가이드"로 읽으면 notFound() 가
 * 하루 캐시에 남는다(getJob 과 같은 결함, 2026-10-17 점검). supabase-js 는 시간 초과에도 던지지 않고
 * { data: null, error } 를 돌려주므로 error 를 직접 보고 던진다.
 */
export const getGuideBySlugStrict = cache(async (slug: string): Promise<Guide | null> => {
  if (!dbConfigured) return null;
  const { data, error } = await db.from("org_guides_public").select(COLS).eq("slug", slug).limit(1).maybeSingle();
  if (error) throw new Error(`[getGuideBySlug ${slug}] ${error.message}`);
  return (data as Guide | null) ?? null;
});

/** 기관 쪽·공고 쪽에서 "이 기관 가이드가 있나"만 본다. 없으면 null. */
export const getGuideByOrg = cache(async (org: string | null): Promise<Pick<Guide, "org" | "slug" | "title"> | null> => {
  if (!dbConfigured || !org) return null;
  try {
    const { data } = await db.from("org_guides_public").select("org,slug,title").eq("org", org).maybeSingle();
    return (data as Pick<Guide, "org" | "slug" | "title"> | null) ?? null;
  } catch {
    return null;
  }
});

export const guidePath = (slug: string) => `/jobs/guide/${encodeURIComponent(slug)}`;
