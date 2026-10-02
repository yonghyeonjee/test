import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostArt } from "@/components/Art";
import AdSlot from "@/components/AdSlot";
import Faq from "@/components/Faq";
import JsonLd from "@/components/JsonLd";
import MidAd from "@/components/MidAd";
import PromoBanner from "@/components/PromoBanner";
import type { PromoContext } from "@/lib/promo";
import RelatedLinks from "@/components/RelatedLinks";
import Inline from "@/components/Inline";
import ShareButton from "@/components/ShareButton";
import Toc from "@/components/Toc";
import { getPost, POSTS } from "@/lib/posts";
import { postRelated } from "@/lib/related";
import { SITE_URL, t, withOg, OG_IMAGE } from "@/lib/seo";
import { ORG_ID, pageGraph } from "@/lib/schema";


/** 글 주제와 이어지는 바깥 자료를 고르는 단서. */
const POST_CONTEXT: Record<string, PromoContext> = {
  "youth-support": "youth",
  "sme-startup-support": "business",
  "government-subsidy-types": "money",
  "national-employment-support": "job",
  "youth-benefits": "youth",
  "social-worker-license": "job",
  "vocational-training-card": "job",
};

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const post = getPost(params.slug);
  if (!post) return withOg({});
  return withOg({
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      type: "article",
    },
  });
}

/**
 * 글의 핵심 낱말(keywords)이 본문에 처음 나오는 자리를 굵게 한다.
 * 글마다 손으로 표시하지 않아도 검색엔진과 사람이 핵심을 바로 본다.
 * 이미 굵게 표시된 곳이나 링크 안은 건드리지 않는다.
 */
function emph(text: string, keys: string[]): string {
  if (/\*\*|\]\(/.test(text)) return text;
  // 긴 낱말부터, 없으면 낱말을 쪼개서("정부 지원금 종류" → "지원금") 찾는다.
  const cands = [
    ...keys.filter((x) => x.length >= 2),
    ...keys.flatMap((x) => x.split(/\s+/)).filter((x) => x.length >= 3),
  ];
  for (const k of cands) {
    const i = text.indexOf(k);
    if (i >= 0) return `${text.slice(0, i)}**${k}**${text.slice(i + k.length)}`;
  }
  return text;
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) notFound();

  const path = `/blog/${post.slug}`;
  const ld = pageGraph({
    path,
    name: post.title,
    description: post.description,
    dateModified: post.updated,
    crumbs: [
      { name: "지원금 안내", path: "/blog" },
      { name: post.title },
    ],
    about: {
      "@type": "BlogPosting",
      image: [OG_IMAGE],
      "@id": `${SITE_URL}${path}#post`,
      headline: post.title,
      description: post.description,
      // 언제 쓴 것인지 모르는 글이 제일 못 미덥다. 고친 날을 적는다.
      dateModified: post.updated,
      datePublished: post.updated,
      inLanguage: "ko-KR",
      keywords: post.keywords.join(", "),
      author: { "@id": ORG_ID },
      publisher: { "@id": ORG_ID },
      url: `${SITE_URL}${path}`,
    },
  });

  return (
    <article className="py-4">
      <JsonLd data={ld} />
      <nav className="text-xs text-muted">
        <Link href="/blog" className="inline-block py-1 hover:text-brand">
          지원금 안내
        </Link>
      </nav>

      <div className="mt-2 flex items-start justify-between gap-6">
        <h1 className="display text-[1.75rem] leading-tight sm:text-[2rem]">
          {post.title}
        </h1>
        <div className="hidden h-24 w-36 shrink-0 sm:block"><PostArt name={post.art} /></div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="num badge badge-quiet">{post.updated} 기준</span>
        <ShareButton title={post.title} text={post.description} />
      </div>

      <p className="mt-6 border-l-[3px] border-brand pl-4 leading-relaxed text-ink2">
        <Inline text={emph(post.lead, post.keywords)} />
      </p>

      <Toc items={post.sections.map((s, i) => ({ id: `s${i + 1}`, label: s.h }))} />

      {post.sections.map((s, i) => (
        <section key={s.h} id={`s${i + 1}`} className="mt-10 scroll-mt-24">
          {i === 2 && (
            <MidAd name="post_mid" context={POST_CONTEXT[post.slug] ?? "general"} seed={post.slug} className="mb-10" />
          )}
          <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
            {s.h}
          </h2>
          {s.p.map((para, j) => (
            <p key={para} className="mt-4 leading-relaxed text-ink2">
              <Inline text={j === 0 ? emph(para, post.keywords) : para} />
            </p>
          ))}
          {s.list && (
            <ul className="mt-4 grid gap-2.5">
              {s.list.map((item) => (
                <li key={item} className="flex gap-2.5 leading-relaxed text-ink2">
                  <span
                    aria-hidden
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-pill bg-brand"
                  />
                  <span><Inline text={item} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {post.faq && <Faq items={post.faq} />}

      <Link href={post.cta.href} className="btn btn-primary mt-12 w-full py-4">
        {post.cta.label}
      </Link>

      <AdSlot name="post_bottom" />

      <RelatedLinks items={postRelated(post.slug)} />

      <PromoBanner placement="post" context={POST_CONTEXT[post.slug] ?? "general"} />

      <p className="mt-8 text-xs leading-relaxed text-muted">
        이 글은 제도의 큰 갈래를 설명한 것입니다. 금액과 시행 시기는 해마다
        바뀌므로, 실제 신청 전에는 공고 원문이나 관할 주민센터에서 확인하세요.
      </p>
    </article>
  );
}
