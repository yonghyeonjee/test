import type { Metadata } from "next";
import { IllusStory } from "@/components/Illus";
import Link from "next/link";
import { PostArt } from "@/components/Art";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { POSTS } from "@/lib/posts";
import { blogIndexRelated } from "@/lib/related";
import { brandKeys, withOg } from "@/lib/seo";

export const metadata: Metadata = withOg({
  title: "정부 지원금 안내 — 종류, 신청 방법, 대상 확인",
  description:
    "정부 지원금의 종류와 신청 방법, 대상 확인하는 법을 정리했습니다. 청년 지원 정책과 중소기업·창업 지원사업 안내도 함께 보실 수 있습니다.",
  keywords: [...brandKeys("안내 글", "지원금 안내", "블로그"), "정부 지원금 종류", "지원금 신청 방법"],
  alternates: { canonical: "/blog" },
});

export default function BlogIndex() {
  return (
    <div className="py-4">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="eyebrow">지원금 안내</p>
          <h1 className="display mt-2 text-[1.9rem] leading-tight">처음 찾아보는 분을 위한 안내</h1>
          <p className="mt-3 max-w-[34rem] leading-relaxed text-muted">
            처음 찾아보면 용어부터 막힙니다. 자주 헷갈리는 것들을 갈래별로
            정리했습니다.
          </p>
        </div>
        <div className="hidden h-32 w-44 shrink-0 sm:block"><IllusStory /></div>
      </div>

      {/* 신청 기간이 열려 있는 것부터. 날짜가 걸린 글은 늦으면 소용이 없다. */}
      <Link href="/blog/youth-future-savings"
            className="card card-link mt-8 flex items-center gap-4 p-5">
        <span className="shrink-0 rounded-card bg-brand px-3 py-2 text-[13px] font-bold text-white">
          신청 중
        </span>
        <span className="min-w-0">
          <b className="block text-[15.5px] leading-snug">
            청년미래적금 2차, 10월 16일까지 신청합니다
          </b>
          <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">
            나이·소득 조건과 정부기여금 6%·12% 차이, 3년 뒤 받는 금액을 계산해 봅니다.
          </span>
        </span>
      </Link>

      <Link href="/blog/gojobs-guide"
            className="card card-link mt-3 flex items-center gap-4 p-5">
        <span className="shrink-0 rounded-card bg-brandSoft px-3 py-2 text-[13px] font-bold text-brand">
          채용
        </span>
        <span className="min-w-0">
          <b className="block text-[15.5px] leading-snug">
            나라일터 채용공고, 절반이 7일 안에 마감됩니다 — 놓치지 않고 찾는 법
          </b>
          <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">
            최근 1년 공고 3만 2천 건을 세어 보니 절반이 일주일 안에 마감됩니다. 어떤 자리가 언제 올라오는지.
          </span>
        </span>
      </Link>

      {/* 계산기는 읽는 글이 아니라 쓰는 도구다. 글 목록 위에 따로 둔다. */}
      <Link href="/blog/income"
            className="card card-link mt-3 flex items-center gap-4 p-5">
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
