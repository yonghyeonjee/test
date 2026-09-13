import type { Metadata } from "next";
import Link from "next/link";
import { PostArt } from "@/components/Art";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { POSTS } from "@/lib/posts";
import { blogIndexRelated } from "@/lib/related";

export const metadata: Metadata = {
  title: "정부 지원금 안내 — 종류, 신청 방법, 대상 확인",
  description:
    "정부 지원금의 종류와 신청 방법, 대상 확인하는 법을 정리했습니다. 청년 지원 정책과 중소기업·창업 지원사업 안내도 함께 보실 수 있습니다.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  return (
    <div className="py-4">
      <h1 className="text-[1.75rem] font-extrabold leading-tight">
        지원금 안내
      </h1>
      <p className="mt-3 max-w-[34rem] leading-relaxed text-muted">
        처음 찾아보면 용어부터 막힙니다. 자주 헷갈리는 것들을 갈래별로
        정리했습니다.
      </p>

      {/* 계산기는 읽는 글이 아니라 쓰는 도구다. 글 목록 위에 따로 둔다. */}
      <Link href="/blog/income"
            className="card card-link mt-8 flex items-center gap-4 p-5">
        <span className="shrink-0 rounded-card bg-brandSoft px-3 py-2 text-[13px] font-bold text-brand">
          계산기
        </span>
        <span className="min-w-0">
          <b className="block text-[15.5px] leading-snug">
            &ldquo;기준 중위소득 180% 이하&rdquo;는 얼마일까
          </b>
          <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">
            연소득과 가구원 수를 넣으면 몇 %인지, 어느 기준선에 드는지 바로 봅니다.
          </span>
        </span>
      </Link>

      <div className="mt-3 grid gap-3">
        {POSTS.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="card card-link flex gap-5 p-5"
          >
            <div className="hidden h-16 w-24 shrink-0 sm:block"><PostArt name={p.art} /></div>
            <div className="min-w-0">
            <h2 className="text-[1.0625rem] font-bold leading-snug">{p.title}</h2>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
              {p.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {p.keywords.slice(0, 3).map((k) => (
                <span key={k} className="badge badge-quiet">
                  {k}
                </span>
              ))}
            </div>
            </div>
          </Link>
        ))}
      </div>

      <RelatedLinks items={blogIndexRelated()} />

      <PromoBanner placement="blog" />
    </div>
  );
}
