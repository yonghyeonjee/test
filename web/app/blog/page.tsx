import type { Metadata } from "next";
import { PostArt } from "@/components/Art";
import ArticleList, { type Article } from "@/components/ArticleList";
import JsonLd from "@/components/JsonLd";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import SerifFont from "@/components/SerifFont";
import { yfsPhase } from "@/lib/hotShared";
import { POSTS } from "@/lib/posts";
import { readMinutes } from "@/lib/readTime";
import { blogIndexRelated } from "@/lib/related";
import { pageGraph } from "@/lib/schema";
import { brandKeys, withOg } from "@/lib/seo";

/** 지원금 안내 목록. 블로그(/story)와 같은 한 줄 목록. 날짜가 걸린 글이 맨 위. */
const DESC =
  "정부 지원금의 종류와 신청 방법, 대상 확인하는 법을 정리했습니다. 청년 지원 정책과 중소기업·창업 지원사업 안내도 함께 보실 수 있습니다.";

export const metadata: Metadata = withOg({
  title: "정부 지원금 안내 — 종류, 신청 방법, 대상 확인",
  description: DESC,
  keywords: [...brandKeys("안내 글", "지원금 안내", "블로그"), "정부 지원금 종류", "지원금 신청 방법"],
  alternates: { canonical: "/blog" },
});

// 날짜가 걸린 글의 꼬리표·제목은 오늘 날짜로 정한다(빌드 때 굳지 않게 한 시간마다 다시 그린다).
export const revalidate = 3600;

/** 청년미래적금 글. 신청 중 → 계좌 개설 기다림 → 계좌 개설 중 → 끝(목록 아래로, 꼬리표 없음). */
function youthSavings(): Article & { pinned: boolean } {
  const ph = yfsPhase();
  const base = { href: "/blog/youth-future-savings", label: "청년 · 적금", date: "2026-10-16", mins: 6, art: <PostArt name="money" /> };
  if (ph === "apply") return { ...base, pinned: true, tag: "신청 중", title: "청년미래적금 2차, 10월 16일까지 신청합니다",
    excerpt: "나이·소득 조건과 정부기여금 6%·12% 차이, 3년 뒤 받는 금액을 계산해 봅니다." };
  if (ph === "wait") return { ...base, pinned: true, tag: "11월 16일 계좌 개설", title: "청년미래적금 2차 신청 마감, 11월 16일부터 계좌를 엽니다",
    excerpt: "신청한 사람은 11월 16일부터 27일 사이에 계좌를 열어야 합니다. 정부기여금과 3년 뒤 받는 금액도 계산해 봅니다." };
  if (ph === "open") return { ...base, pinned: true, tag: "계좌 개설 중", title: "청년미래적금 2차 계좌 개설, 11월 27일까지",
    excerpt: "신청한 사람은 27일까지 계좌를 열어야 신청이 유효합니다. 정부기여금과 3년 뒤 받는 금액을 계산해 봅니다." };
  return { ...base, pinned: false, title: "청년미래적금 2차 정리 — 조건, 정부기여금, 3년 뒤 받는 돈",
    excerpt: "2차 모집은 끝났습니다. 조건과 정부기여금 6%·12% 차이, 3년 뒤 받는 금액은 다음 모집 때도 참고가 됩니다." };
}

const FEATURED: Article[] = [
  {
    href: "/blog/gojobs-guide", label: "채용",
    title: "나라일터 채용공고, 절반이 7일 안에 마감됩니다 — 놓치지 않고 찾는 법",
    excerpt: "최근 1년 공고 3만 2천 건을 세어 보니 절반이 일주일 안에 마감됩니다. 어떤 자리가 언제 올라오는지.",
    mins: 7, art: <PostArt name="jobs" />,
  },
  {
    href: "/blog/income", label: "계산기",
    title: "“기준 중위소득 180% 이하”는 얼마일까",
    excerpt: "연소득과 가구원 수를 넣으면 몇 %인지, 어느 기준선에 드는지 바로 봅니다.",
    mins: 3, art: <PostArt name="study" />,
  },
];

export default function BlogIndex() {
  const { pinned, ...ys } = youthSavings();
  const items: Article[] = [
    ...(pinned ? [ys] : []),
    ...FEATURED,
    ...(pinned ? [] : [ys]),
    ...POSTS.map((p): Article => ({
      href: `/blog/${p.slug}`,
      title: p.title,
      excerpt: p.description,
      label: p.keywords[0],
      date: p.updated,
      mins: readMinutes([p.lead, ...p.sections.flatMap((s) => [s.h, ...s.p, ...(s.list ?? [])])].join(" ")),
      art: p.art ? <PostArt name={p.art} /> : undefined,
    })),
  ];
  return (
    <div className="mx-auto max-w-[46rem] py-4">
      <SerifFont />
      <JsonLd
        data={pageGraph({
          path: "/blog",
          name: "지원금 안내 — 처음 찾아보는 분을 위한 안내",
          description: DESC,
          collection: true,
          items: items.map((a) => ({ name: a.title, path: a.href })).slice(0, 20),
        })}
      />
      <header className="pt-4 sm:pt-8">
        <p className="eyebrow">지원금 안내</p>
        <h1 className="article-title mt-2 text-[1.75rem] leading-tight sm:text-[2.125rem]">처음 찾아보는 분을 위한 안내</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          처음 찾아보면 용어부터 막힙니다. 자주 헷갈리는 것들을 갈래별로 정리했습니다. 신청 기간이 열려 있는 글이 맨 위입니다.
        </p>
      </header>

      <ArticleList items={items} className="mt-6 border-t border-line" />

      <RelatedLinks items={blogIndexRelated()} />
      <PromoBanner placement="blog" />
    </div>
  );
}
