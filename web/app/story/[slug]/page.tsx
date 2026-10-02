import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdSlot from "@/components/AdSlot";
import { ArtJeonse, ArtJobs, ArtPolicy } from "@/components/Art";
import JsonLd from "@/components/JsonLd";
import MidAd from "@/components/MidAd";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import ShareButton from "@/components/ShareButton";
import StoryBody from "@/components/StoryBody";
import { blogIndexRelated } from "@/lib/related";
import { ORG_ID, pageGraph } from "@/lib/schema";
import { SITE_URL, withOg, OG_IMAGE } from "@/lib/seo";
import { getStories, getStory, KIND_LABEL } from "@/lib/stories";

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
  const s = await getStory(decodeURIComponent(params.slug));
  if (!s) return withOg({ title: "찾을 수 없는 글" });
  const path = `/story/${encodeURIComponent(s.slug)}`;
  return withOg({
    title: s.title,
    description: s.summary,
    keywords: s.keywords,
    alternates: { canonical: path },
    openGraph: { type: "article", url: `${SITE_URL}${path}`, title: s.title, description: s.summary,
                 publishedTime: s.published_at, modifiedTime: s.updated_at },
  });
}

const ART: Record<string, (p: { className?: string }) => JSX.Element> = { org: ArtJobs, role: ArtJobs, region: ArtPolicy, topic: ArtJeonse };

export default async function StoryPage({ params }: P) {
  const slug = decodeURIComponent(params.slug);
  const s = await getStory(slug);
  if (!s) notFound();
  const path = `/story/${encodeURIComponent(s.slug)}`;
  const Art = ART[s.kind] ?? ArtPolicy;
  const ld = pageGraph({
    path, name: s.title, description: s.summary, dateModified: s.updated_at,
    crumbs: [{ name: "블로그", path: "/story" }, { name: KIND_LABEL[s.kind] ?? "블로그" }],
    about: {
      "@type": "BlogPosting", "@id": `${SITE_URL}${path}#post`, headline: s.title, description: s.summary,
      image: [OG_IMAGE],
      datePublished: s.published_at, dateModified: s.updated_at, inLanguage: "ko-KR",
      keywords: s.keywords.join(", "), author: { "@id": ORG_ID }, publisher: { "@id": ORG_ID }, url: `${SITE_URL}${path}`,
    },
  });

  return (
    <article className="py-4">
      <JsonLd data={ld} />
      <nav aria-label="위치" className="text-[13px] text-muted">
        <Link href="/story" className="hover:text-brand">블로그</Link>{" · "}
        <span className="text-ink2">{KIND_LABEL[s.kind] ?? "글"}</span>
      </nav>
      <header className="mt-3">
        <h1 className="display text-[1.75rem] leading-tight">{s.title}</h1>
        <p className="num mt-2 text-xs text-faint">{s.updated_at.slice(0, 10)} 기준 · 모아 둔 자료에서 센 숫자로 씁니다</p>
        <p className="mt-3 text-[15.5px] leading-[1.85] text-ink2">{s.summary}</p>
        <div className="mt-5 flex justify-center"><Art /></div>
      </header>

      <StoryBody blocks={s.body.slice(0, Math.ceil(s.body.length / 2))} />
      <MidAd name="detail_mid" context={s.kind === "topic" || s.kind === "region" ? "general" : "job"} seed={s.slug} className="mt-10" />
      <StoryBody blocks={s.body.slice(Math.ceil(s.body.length / 2))} />

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
