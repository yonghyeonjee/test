import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ShareButton from "@/components/ShareButton";
import { getPost, POSTS } from "@/lib/posts";
import { SITE_URL, t } from "@/lib/seo";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const post = getPost(params.slug);
  if (!post) return {};
  return {
    title: t(post.title),
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      type: "article",
    },
  };
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) notFound();

  return (
    <article className="py-4">
      <nav className="text-xs text-muted">
        <Link href="/blog" className="hover:text-brand">
          지원금 안내
        </Link>
      </nav>

      <h1 className="mt-2 text-[1.75rem] font-extrabold leading-tight">
        {post.title}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="num badge badge-quiet">{post.updated} 기준</span>
        <ShareButton title={post.title} text={post.description} />
      </div>

      <p className="mt-6 border-l-[3px] border-brand pl-4 leading-relaxed text-ink2">
        {post.lead}
      </p>

      {post.sections.map((s) => (
        <section key={s.h} className="mt-10">
          <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
            {s.h}
          </h2>
          {s.p.map((para) => (
            <p key={para} className="mt-4 leading-relaxed text-ink2">
              {para}
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
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <Link href={post.cta.href} className="btn btn-primary mt-12 w-full py-4">
        {post.cta.label}
      </Link>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        이 글은 제도의 큰 갈래를 설명한 것입니다. 금액과 시행 시기는 해마다
        바뀌므로, 실제 신청 전에는 공고 원문이나 관할 주민센터에서 확인하세요.
      </p>
    </article>
  );
}
