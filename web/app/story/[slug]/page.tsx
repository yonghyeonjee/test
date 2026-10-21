import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import MidAd from "@/components/MidAd";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import ShareButton from "@/components/ShareButton";
import StoryBody from "@/components/StoryBody";
import StorySummary from "@/components/StorySummary";
import SerifFont from "@/components/SerifFont";
import StoryCover from "@/components/StoryCover";
import { blocksText, readMinutes } from "@/lib/readTime";
import TopStripAd from "@/components/TopStripAd";
import { blogIndexRelated } from "@/lib/related";
import { ORG_ID, pageGraph } from "@/lib/schema";
import { SITE_URL, withOg, OG_IMAGE } from "@/lib/seo";
import { getStories, getStoryStrict, KIND_LABEL, storyIndexable } from "@/lib/stories";
import type { Block } from "@/lib/stories";

/**
 * 자료에서 매일 만드는 블로그 글. 파이프라인이 써 둔 블록을 그린다.
 * 숫자는 쓴 날 기준이라 하루 한 번만 새로 그리면 된다.
 */
export const revalidate = 3600;
export const dynamicParams = true;

type P = { params: { slug: string } };

export async function generateStaticParams() {
  try {
    return (await getStories(30)).map((s) => ({ slug: s.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const s = await getStoryStrict(decodeURIComponent(params.slug));
  if (!s) return withOg({ title: "찾을 수 없는 글" });
  const path = `/story/${encodeURIComponent(s.slug)}`;
  return withOg({
    title: s.title,
    description: s.summary,
    keywords: s.keywords,
    alternates: { canonical: path },
    // 이 경로의 글은 전부 파이프라인이 자료로 써 내는 글(blog_posts)이다. 다른 쪽과 겹치는 갈래(브리핑·주제·지역·
    // 순위 연재)는 색인하지 않는다(lib/stories storyIndexable, 2026-10-17). 쪽은 그대로 열리고 링크는 따라간다.
    ...(storyIndexable(s) ? {} : { robots: { index: false, follow: true } }),
    openGraph: { type: "article", url: `${SITE_URL}${path}`, title: s.title, description: s.summary,
                 publishedTime: s.published_at, modifiedTime: s.updated_at,
                 ...(coverOf(s.body) ? { images: [{ url: `${SITE_URL}${coverOf(s.body)}` }] } : {}) },
  });
}

/** 글의 첫 사진. 있으면 공유 미리보기와 구조화 데이터의 그림으로 쓴다. */
function coverOf(blocks: Block[]): string | null {
  const b = blocks.find((x) => x.type === "img");
  return b && b.type === "img" ? b.src : null;
}


export default async function StoryPage({ params }: P) {
  const slug = decodeURIComponent(params.slug);
  const s = await getStoryStrict(slug);
  if (!s) notFound();
  const path = `/story/${encodeURIComponent(s.slug)}`;
  const ld = pageGraph({
    path, name: s.title, description: s.summary, dateModified: s.updated_at,
    crumbs: [{ name: "블로그", path: "/story" }, { name: KIND_LABEL[s.kind] ?? "블로그" }],
    about: {
      "@type": "BlogPosting", "@id": `${SITE_URL}${path}#post`, headline: s.title, description: s.summary,
      image: [coverOf(s.body) ? `${SITE_URL}${coverOf(s.body)}` : OG_IMAGE],
      datePublished: s.published_at, dateModified: s.updated_at, inLanguage: "ko-KR",
      keywords: s.keywords.join(", "), author: { "@id": ORG_ID }, publisher: { "@id": ORG_ID }, url: `${SITE_URL}${path}`,
    },
  });

  // 차례와 첫 문단은 요약 상자가 보여 준다. 첫 사진은 머리 그림으로 올린다. 본문에서는 뺀다.
  const firstP = s.body.findIndex((b) => b.type === "p");
  const cover = s.body.find((b): b is Extract<Block, { type: "img" }> => b.type === "img");
  const body = s.body.filter((b, i) => b.type !== "toc" && i !== firstP && b !== cover);

  const mins = readMinutes(blocksText(s.body));

  return (
    <article className="mx-auto max-w-[44rem] py-4">
      <SerifFont />
      <JsonLd data={ld} />
      <nav aria-label="위치" className="text-[13px] text-muted">
        <Link href="/story" className="inline-block py-1 hover:text-brand">블로그</Link>{" · "}
        <span className="text-ink2">{KIND_LABEL[s.kind] ?? "글"}</span>
      </nav>
      {/* 브런치처럼: 좁은 기둥, 명조 큰 제목, 작은 표식 줄, 그 아래 머리 띠. 2026-10-16. */}
      <header className="mt-4 sm:mt-6">
        <h1 className="article-title text-[1.75rem] leading-[1.3] sm:text-[2.25rem]">{s.title}</h1>
        <p className="num mt-4 text-[13px] text-faint">
          <span className="font-semibold text-brand">K나라지원</span> · {s.updated_at.slice(0, 10).replaceAll("-", ".")} · 읽는 데 {mins}분 · {s.kind === "case" ? "실제 사례를 정리한 글입니다" : "모아 둔 자료에서 센 숫자로 씁니다"}
        </p>
      </header>
      {/* 사진이 있는 글은 본문 첫 사진이 머리 그림을 대신한다(본문에서는 그 사진을 뺀다). */}
      {cover
        ? <figure className="mt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover.src} alt={cover.alt} className="w-full rounded-card object-cover" />
            {cover.caption && <figcaption className="mt-2 text-xs leading-relaxed text-muted">{cover.caption}</figcaption>}
          </figure>
        : <StoryCover kind={s.kind} label={KIND_LABEL[s.kind]} band className="mt-6" />}

      {/* 두괄식: 요약 상자가 먼저, 그 아래 광고 띠, 본문. */}
      <StorySummary summary={s.summary} blocks={s.body.filter((b) => b !== cover)} className="mt-6" />
      <TopStripAd className="mt-5" />

      <StoryBody blocks={body.slice(0, Math.ceil(body.length / 2))} />
      <MidAd name="post_mid" context={s.kind === "topic" || s.kind === "region" ? "general" : "job"} seed={s.slug} className="mt-10" />
      <StoryBody blocks={body.slice(Math.ceil(body.length / 2))} />

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/story" className="btn btn-primary px-5 py-3">블로그의 다른 글</Link>
        <ShareButton title={s.title} />
      </div>
      <AdSlot name="post_bottom" />
      <PromoBanner placement="story" context={s.kind === "topic" || s.kind === "region" ? "general" : "job"} />
      <RelatedLinks items={blogIndexRelated()} />
    </article>
  );
}
