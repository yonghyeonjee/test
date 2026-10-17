import type { Metadata } from "next";
import { ArtJeonse } from "@/components/Art";
import ArticleList, { type Article } from "@/components/ArticleList";
import JsonLd from "@/components/JsonLd";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import SerifFont from "@/components/SerifFont";
import { blocksText, readMinutes } from "@/lib/readTime";
import { blogIndexRelated } from "@/lib/related";
import { pageGraph } from "@/lib/schema";
import { brandKeys, withOg } from "@/lib/seo";
import { getStories, KIND_LABEL } from "@/lib/stories";

/**
 * 블로그 목록. 브런치처럼 좁은 기둥에 한 줄씩 — 제목, 두 줄 요약, 갈래·날짜·읽는 시간, 작은 썸네일.
 * 제도 설명(지원금 안내)과 달리, 자료를 세어 나온 것과 실제로 겪을 법한 사례를 둔다.
 */
const DESC =
  "전세 만기에 집주인이 집을 판다고 할 때, 대출을 옮겨 이사할 때처럼 실제로 겪을 법한 상황을 따라가며 순서와 서류, 돈 계산을 안내합니다.";

export const metadata: Metadata = withOg({
  title: "블로그 — 사례로 보는 지원 제도, 이럴 때 이렇게",
  description: DESC,
  keywords: [...brandKeys("블로그", "사례"), "전세대출 연장 사례", "버팀목 이사"],
  alternates: { canonical: "/story" },
});

const STORIES: Article[] = [
  {
    href: "/story/jeonse-extension",
    label: "전세 · 사례",
    title: "버팀목 전세대출 1개월 연장, 연장 후 이사까지",
    excerpt: "집주인이 집을 판다고 할 때 세입자가 할 일. 집주인에게 보낼 문자, 한시적 연장 계약서, 목적물 변경, 돈 계산을 순서대로.",
    date: "2026-10-02",
    mins: 9,
    art: <ArtJeonse />,
  },
];

export const revalidate = 3600;

export default async function StoryIndex() {
  const posts = await getStories(60);
  const items: Article[] = [
    ...STORIES,
    ...posts.map((s): Article => ({
      href: `/story/${encodeURIComponent(s.slug)}`,
      title: s.title,
      excerpt: s.summary,
      label: KIND_LABEL[s.kind] ?? "글",
      date: s.published_at,
      mins: readMinutes(blocksText(s.body)),
      kind: s.kind,
    })),
  ];
  return (
    <div className="mx-auto max-w-[46rem] py-4">
      <SerifFont />
      <JsonLd
        data={pageGraph({
          path: "/story",
          name: "블로그 — 자료가 말해 주는 것, 매일 세 편",
          description: DESC,
          collection: true,
          items: items.map((a) => ({ name: a.title, path: a.href })).slice(0, 20),
        })}
      />
      <header className="pt-4 sm:pt-8">
        <p className="eyebrow">블로그</p>
        <h1 className="article-title mt-2 text-[1.75rem] leading-tight sm:text-[2.125rem]">자료가 말해 주는 것, 매일 세 편</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          모아 둔 자료를 세어 나온 것을 매일 세 편씩 적습니다. 어느 기관이 언제 뽑는지, 어떤 지원이 어느 지역에 몇 건 있는지,
          자격증 합격률은 어떤지. 사례 글은 여러 경우를 섞어 각색합니다.
        </p>
      </header>

      <ArticleList items={items} className="mt-6 border-t border-line" />

      <PromoBanner placement="story" context="money" />
      <RelatedLinks items={blogIndexRelated()} />
    </div>
  );
}
