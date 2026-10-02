import type { Metadata } from "next";
import Link from "next/link";
import { ArtJeonse } from "@/components/Art";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { blogIndexRelated } from "@/lib/related";
import { brandKeys, withOg } from "@/lib/seo";
import { getStories, KIND_LABEL } from "@/lib/stories";

/**
 * 블로그. 제도 설명(지원금 안내)과 달리, 한 사람이 실제로 겪을 법한 상황을
 * 따라가며 방법을 안내하는 글을 둔다. 사례는 각색한다.
 */
export const metadata: Metadata = withOg({
  title: "블로그 — 사례로 보는 지원 제도, 이럴 때 이렇게",
  description:
    "전세 만기에 집주인이 집을 판다고 할 때, 대출을 옮겨 이사할 때처럼 실제로 겪을 법한 상황을 따라가며 순서와 서류, 돈 계산을 안내합니다.",
  keywords: [...brandKeys("블로그", "사례"), "전세대출 연장 사례", "버팀목 이사"],
  alternates: { canonical: "/story" },
});

const STORIES = [
  {
    href: "/story/jeonse-extension",
    tag: "전세",
    title: "버팀목 전세대출 1개월 연장, 연장 후 이사까지",
    desc: "집주인이 집을 판다고 할 때 세입자가 할 일. 집주인에게 보낼 문자, 한시적 연장 계약서, 목적물 변경, 돈 계산을 순서대로.",
    date: "2026-10-02",
    Art: ArtJeonse,
  },
];

export const revalidate = 3600;

export default async function StoryIndex() {
  const posts = await getStories(60);
  return (
    <div className="py-4">
      <h1 className="text-[1.75rem] font-extrabold leading-tight">블로그</h1>
      <p className="mt-3 max-w-[34rem] leading-relaxed text-muted">
        제도 설명은 지원금 안내에 있습니다. 여기서는 모아 둔 자료를 세어 나온 것을 매일 한 편씩
        적습니다 — 어느 기관이 언제 뽑는지, 어떤 지원이 어느 지역에 몇 건 있는지. 사례 글은
        여러 경우를 섞어 각색합니다.
      </p>

      <div className="mt-8 grid gap-3">
        {posts.map((s) => (
          <Link key={s.slug} href={`/story/${encodeURIComponent(s.slug)}`} className="card card-link block p-5">
            <span className="text-[12px] font-semibold text-brand">{KIND_LABEL[s.kind] ?? "글"}</span>
            <b className="mt-0.5 block text-[15.5px] leading-snug">{s.title}</b>
            <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">{s.summary}</span>
            <span className="num mt-2 block text-xs text-faint">{s.published_at}</span>
          </Link>
        ))}
        {STORIES.map((s) => (
          <Link key={s.href} href={s.href} className="card card-link flex gap-5 p-5">
            <span className="hidden shrink-0 sm:block"><s.Art /></span>
            <span className="min-w-0">
              <span className="text-[12px] font-semibold text-brand">{s.tag}</span>
              <b className="mt-0.5 block text-[15.5px] leading-snug">{s.title}</b>
              <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">{s.desc}</span>
              <span className="num mt-2 block text-xs text-faint">{s.date}</span>
            </span>
          </Link>
        ))}
      </div>

      <PromoBanner placement="story" context="money" />
      <RelatedLinks items={blogIndexRelated()} />
    </div>
  );
}
