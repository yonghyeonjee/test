import { db, dbConfigured } from "./db";

/**
 * 블로그 글. 두 가지가 있다.
 *  - 코드에 적힌 글(/story/jeonse-extension 같은 것): 사례를 따라가는 안내문.
 *  - 자료에서 매일 한 편씩 만드는 글(blog_posts): 파이프라인이 숫자를 세어
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
  | { type: "note"; text: string };

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
  license: "자격증 시험", sigungu: "시·군·구 현황",
};

const COLS = "slug,kind,subject,title,summary,keywords,body,published_at,updated_at";

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

export async function getStory(slug: string): Promise<Story | null> {
  if (!dbConfigured) return null;
  try {
    const { data } = await db.from("blog_public").select(COLS).eq("slug", slug).maybeSingle();
    return (data as Story | null) ?? null;
  } catch {
    return null;
  }
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
