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
import { getSeries, getStories, getStoryStrict, KIND_LABEL, plainKeywords, seriesName, storyIndexable } from "@/lib/stories";
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
    keywords: plainKeywords(s),
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
      keywords: plainKeywords(s).join(", "), author: { "@id": ORG_ID }, publisher: { "@id": ORG_ID }, url: `${SITE_URL}${path}`,
    },
  });

  // 차례와 첫 문단은 요약 상자가 보여 준다. 첫 사진은 머리 그림으로 올린다. 본문에서는 뺀다.
  const firstP = s.body.findIndex((b) => b.type === "p");
  const cover = s.body.find((b): b is Extract<Block, { type: "img" }> => b.type === "img");
  // 핵심 정리 상자가 있는 글(제도 안내)은 요약 상자가 머리글을 쓰지 않으니 본문에 그대로 둔다.
  const keepLead = s.body.some((b) => b.type === "summary");
  const body = s.body.filter((b, i) => b.type !== "toc" && (keepLead || i !== firstP) && b !== cover);

  const mins = readMinutes(blocksText(s.body));

  // 연재(2026-11-26): 같은 이름의 글을 주소 순으로 묶어 차례와 이전·다음 글을 보인다.
  const series = seriesName(s);
  const parts = series ? await getSeries(series) : [];
  const at = parts.findIndex((x) => x.slug === s.slug);
  const prev = at > 0 ? parts[at - 1] : null, next = at >= 0 && at < parts.length - 1 ? parts[at + 1] : null;
  // 자주 묻는 질문은 구조화 자료로도 낸다.
  const faqs = s.body.flatMap((b) => (b.type === "faq" ? b.items : []));
  const faqLd = faqs.length ? {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faqs.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") } })),
  } : null;

  return (
    <article className="mx-auto max-w-[44rem] py-4">
      <SerifFont />
      <JsonLd data={ld} />
      {faqLd && <JsonLd data={faqLd} />}
      <nav aria-label="위치" className="text-[13px] text-muted">
        <Link href="/story" className="inline-block py-1 hover:text-brand">블로그</Link>{" · "}
        <span className="text-ink2">{KIND_LABEL[s.kind] ?? "글"}</span>
      </nav>
      {/* 브런치처럼: 좁은 기둥, 명조 큰 제목, 작은 표식 줄, 그 아래 머리 띠. 2026-10-16. */}
      <header className="mt-4 sm:mt-6">
        <h1 className="article-title text-[1.75rem] leading-[1.3] sm:text-[2.25rem]">{s.title}</h1>
        <p className="num mt-4 text-[13px] text-faint">
          <span className="font-semibold text-brand">K나라지원</span> · {s.updated_at.slice(0, 10).replaceAll("-", ".")} · 읽는 데 {mins}분 · {s.kind === "case" ? "실제 사례를 정리한 글입니다" : s.kind === "guide" ? "공식 발표를 확인해 정리한 글입니다" : "모아 둔 자료에서 센 숫자로 씁니다"}
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

      {/* 연재 차례. 지금 글은 굵게, 나머지는 고리. 아래에 이전·다음 글. */}
      {series && parts.length > 1 && (
        <section aria-label="연재 차례" className="mt-12 rounded-card border border-line bg-surface p-5">
          <p className="eyebrow">연재</p>
          <h2 className="mt-1 text-[1.125rem] font-extrabold tracking-[-.02em]">{series} <span className="num ml-1 text-[13px] font-semibold text-muted">{at + 1} / {parts.length}편</span></h2>
          <ol className="mt-3 space-y-1">
            {parts.map((x, i) => (
              <li key={x.slug} className="flex gap-2.5 text-[15px] leading-snug">
                <span className={`num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold ${x.slug === s.slug ? "bg-brand text-white" : "bg-ground text-muted"}`}>{i + 1}</span>
                {x.slug === s.slug
                  ? <b className="py-0.5 text-ink">{x.subject || x.title}</b>
                  : <Link href={`/story/${encodeURIComponent(x.slug)}`} className="py-0.5 text-ink2 hover:text-brand">{x.subject || x.title}</Link>}
              </li>
            ))}
          </ol>
          {(prev || next) && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {prev ? <Link href={`/story/${encodeURIComponent(prev.slug)}`} className="card-link rounded-btn border border-line px-4 py-3 text-[14px]"><span className="block text-[12px] text-muted">‹ 이전 글</span><b className="line-clamp-1">{prev.subject || prev.title}</b></Link> : <span />}
              {next && <Link href={`/story/${encodeURIComponent(next.slug)}`} className="card-link rounded-btn border border-line px-4 py-3 text-right text-[14px]"><span className="block text-[12px] text-muted">다음 글 ›</span><b className="line-clamp-1">{next.subject || next.title}</b></Link>}
            </div>
          )}
        </section>
      )}

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
