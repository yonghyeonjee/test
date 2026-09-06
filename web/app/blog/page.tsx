import type { Metadata } from "next";
import Link from "next/link";
import PromoBanner from "@/components/PromoBanner";
import { POSTS } from "@/lib/posts";
import { t } from "@/lib/seo";

export const metadata: Metadata = {
  title: t("정부 지원금 안내 — 종류, 신청 방법, 대상 확인"),
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

      <div className="mt-8 grid gap-3">
        {POSTS.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="card card-link block p-5"
          >
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
          </Link>
        ))}
      </div>

      <PromoBanner placement="blog" />
    </div>
  );
}
