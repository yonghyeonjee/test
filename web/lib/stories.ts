import { unstable_noStore as noStore } from "next/cache";
import { db, dbConfigured } from "./db";

/**
 * 블로그 글. 두 가지가 있다.
 *  - 코드에 적힌 글(/story/jeonse-extension 같은 것): 사례를 따라가는 안내문.
 *  - 자료에서 매일 세 편씩 만드는 글(blog_posts): 파이프라인이 숫자를 세어
 *    문장으로 옮겨 둔 것. 여기서는 그 블록을 읽어 그린다.
 */
export type Block =
  | { type: "toc"; items: { id: string; label: string }[] }
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id: string }
  | { type: "list"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "bars"; items: { label: string; n: number }[]; unit?: string }
  | { type: "links"; items: { href: string; label: string }[] }
  | { type: "note"; text: string }
  /** 사진. src 는 /img/story/… 같은 사이트 안 경로. 출처는 web/public/img/story/credits.json 에 두고 caption 에 적는다. */
  | { type: "img"; src: string; alt: string; caption?: string };

export type Story = {
  slug: string;
  kind: "topic" | "org" | "role" | "region" | "license" | "sigungu" | string;
  subject: string;
  title: string;
  summary: string;
  keywords: string[];
  body: Block[];
  published_at: string;
  updated_at: string;
};

export const KIND_LABEL: Record<string, string> = {
  topic: "지원 주제", org: "기관별 채용", role: "직무별 채용", region: "지역 현황",
  license: "자격증 시험", sigungu: "시·군·구 현황", daily: "오늘의 채용 브리핑", case: "실제 사례",
};

const COLS = "slug,kind,subject,title,summary,keywords,body,published_at,updated_at";

/**
 * 색인시킬 자동 글인지(2026-10-17). 사이트 전체가 색인에서 빠진 뒤로 다른 쪽과 겹치는 갈래는 색인하지 않는다.
 *  - 오늘의 브리핑(daily)은 /jobs 목록을 날마다 다시 적은 것, 지원 주제·지역·시군구 글은 /topic·/area·/housing 과 겹친다.
 *  - 기관·직무·자격증 글은 공고를 세어 쓴 분석이라 남긴다.
 *  - 순위 연재(top10-…)는 티스토리에 같은 틀로 따로 내는 글이라 여기서는 색인하지 않는다.
 * 쪽은 그대로 열리고 링크는 따라간다(noindex,follow).
 */
// case: 사람이 쓴 사례 글(2026-10-20 전세대출 연재부터). 자동 글이 아니라 색인한다.
const INDEX_KINDS = new Set(["org", "role", "license", "case"]);
export function storyIndexable(s: Pick<Story, "kind" | "slug">): boolean {
  return INDEX_KINDS.has(s.kind) && !s.slug.startsWith("top10-");
}

export async function getStories(limit = 100): Promise<Story[]> {
  if (!dbConfigured) return [];
  try {
    const { data } = await db.from("blog_public").select(COLS)
      .order("published_at", { ascending: false }).order("updated_at", { ascending: false }).limit(limit);
    return (data ?? []) as Story[];
  } catch {
    return [];
  }
}

/** 곁가지용(채용 쪽의 기관 글 고리 등). 못 읽으면 null — 그 쪽 전체를 망치지 않는다. */
export async function getStory(slug: string): Promise<Story | null> {
  if (!dbConfigured) return null;
  try {
    const { data } = await db.from("blog_public").select(COLS).eq("slug", slug).maybeSingle();
    return (data as Story | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * 글 쪽(/story/[slug]) 전용. DB 오류는 던진다 — null 이면 notFound() 가 404 를 캐시해
 * 멀쩡한 글이 색인에서 빠진다. 없는 글만 null.
 */
export async function getStoryStrict(slug: string): Promise<Story | null> {
  if (!dbConfigured) return null;
  const { data, error } = await db.from("blog_public").select(COLS).eq("slug", slug).limit(1).maybeSingle();
  if (error) throw new Error(`[getStory ${slug}] ${error.message}`);
  if (data) return data as Story;
  // 없다고 나오면 캐시 없이 한 번 더 본다(2026-10-21). 예약 글(published_at 이 내일)은 공개 전에 크롤러가
  // 들르면 빈 조회 결과와 404 쪽이 한 시간씩 캐시에 남아 공개 뒤에도 404 가 나왔다(전세대출 연재 2편).
  // noStore() 로 이 요청을 동적으로 돌리면 뒤의 조회는 데이터 캐시를 거치지 않고 404 도 캐시되지 않는다.
  // (dbLive 의 no-store fetch 는 안 된다 — Next 가 정적 생성을 멈추려 던지는 예외를 supabase-js 가 삼켜
  //  오류로 돌려주고, 쪽이 500 이 됐다. 2026-10-21 배포에서 확인.) 진짜 없는 글만 조회 한 번을 더 치른다.
  noStore();
  const live = await db.from("blog_public").select(COLS).eq("slug", slug).limit(1).maybeSingle();
  if (live.error) throw new Error(`[getStory ${slug}] ${live.error.message}`);
  return (live.data as Story | null) ?? null;
}

/** 통합 검색용. 제목·요약에 낱말이 든 글. */
export async function searchStories(words: string[], limit = 6): Promise<Story[]> {
  const ws = words.map((w) => w.replace(/[,()%]/g, "").trim()).filter((w) => w.length >= 2);
  if (!dbConfigured || !ws.length) return [];
  try {
    let sel = db.from("blog_public").select(COLS);
    for (const w of ws) sel = sel.or(`title.ilike.%${w}%,summary.ilike.%${w}%,subject.ilike.%${w}%`);
    const { data } = await sel.order("published_at", { ascending: false }).limit(limit);
    return (data ?? []) as Story[];
  } catch {
    return [];
  }
}
