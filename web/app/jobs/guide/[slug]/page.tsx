import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdSlot from "@/components/AdSlot";
import { ArtJobs } from "@/components/Art";
import Faq from "@/components/Faq";
import JsonLd from "@/components/JsonLd";
import MidAd from "@/components/MidAd";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import ShareButton from "@/components/ShareButton";
import StoryBody from "@/components/StoryBody";
import { getGuideBySlug, getGuides, guidePath } from "@/lib/guides";
import { jobsRelated } from "@/lib/related";
import { ORG_ID, pageGraph } from "@/lib/schema";
import { OG_IMAGE, SITE_URL, withOg } from "@/lib/seo";

/**
 * 기관 하나의 자기소개서·직무수행계획서 작성 가이드. 파이프라인이 써 둔 블록을 그린다.
 * 글은 120일에 한 번 다시 쓰이니 하루 한 번만 새로 그리면 된다.
 */
export const revalidate = 86400;
export const dynamicParams = true;

type P = { params: { slug: string } };

export async function generateStaticParams() {
  try {
    return (await getGuides(30)).map((g) => ({ slug: g.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const g = await getGuideBySlug(decodeURIComponent(params.slug));
  if (!g) return withOg({ title: "찾을 수 없는 가이드" });
  const path = guidePath(g.slug);
  return withOg({
    title: g.title,
    description: g.summary,
    keywords: g.keywords,
    alternates: { canonical: path },
    openGraph: { type: "article", url: `${SITE_URL}${path}`, title: g.title, description: g.summary,
                 publishedTime: g.published_at, modifiedTime: g.updated_at },
  });
}

export default async function GuidePage({ params }: P) {
  const slug = decodeURIComponent(params.slug);
  const g = await getGuideBySlug(slug);
  if (!g) notFound();
  const path = guidePath(g.slug);
  const ld = pageGraph({
    path, name: g.title, description: g.summary, dateModified: g.updated_at,
    crumbs: [{ name: "채용", path: "/jobs" }, { name: "작성 가이드", path: "/jobs/guide" }, { name: g.org }],
    about: {
      "@type": "Article", "@id": `${SITE_URL}${path}#article`, headline: g.title, description: g.summary,
      image: [OG_IMAGE], datePublished: g.published_at, dateModified: g.updated_at, inLanguage: "ko-KR",
      keywords: g.keywords.join(", "), author: { "@id": ORG_ID }, publisher: { "@id": ORG_ID }, url: `${SITE_URL}${path}`,
      about: { "@type": "Organization", name: g.org },
    },
  });
  // 본문 중간 광고: 목차 다음 둘째 소제목 앞에 하나만.
  const h2s = g.body.map((b, i) => (b.type === "h2" ? i : -1)).filter((i) => i >= 0);
  const cut = h2s.length >= 3 ? h2s[2] : g.body.length;

  return (
    <article className="py-4">
      <JsonLd data={ld} />
      <nav aria-label="위치" className="text-[13px] text-muted">
        <Link href="/jobs" className="inline-block py-1 hover:text-brand">공공기관 채용</Link>{" · "}
        <Link href="/jobs/guide" className="inline-block py-1 hover:text-brand">작성 가이드</Link>{" · "}
        <span className="text-ink2">{g.org}</span>
      </nav>
      <header className="mt-3">
        <h1 className="display text-[1.75rem] leading-tight">{g.title}</h1>
        <p className="num mt-2 text-xs text-faint">{g.updated_at.slice(0, 10)} 기준 · 공식 누리집·공고와 모아 둔 공고 자료로 씁니다</p>
        <p className="mt-3 text-[15.5px] leading-[1.85] text-ink2">{g.summary}</p>
        <div className="mt-5 flex justify-center"><ArtJobs /></div>
      </header>

      <div className="mt-6">
        <StoryBody blocks={g.body.slice(0, cut)} />
        {cut < g.body.length && (
          <>
            <MidAd name="post_mid" seed={g.slug} context="job" className="my-10" />
            <StoryBody blocks={g.body.slice(cut)} />
          </>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href={`/jobs/org/${encodeURIComponent(g.org)}`} className="btn btn-primary">{g.org} 채용 공고 전체</Link>
        <Link href="/jobs/guide" className="btn">다른 기관 가이드</Link>
        <ShareButton title={g.title} />
      </div>

      <Faq items={g.faq} />

      <AdSlot name="page_bottom" />
      <PromoBanner placement="jobs" context="job" />
      <RelatedLinks items={jobsRelated()} />
    </article>
  );
}
