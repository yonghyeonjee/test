import type { Metadata } from "next";
import Link from "next/link";
import GuideBanner from "@/components/GuideBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import TopicIcon from "@/components/TopicIcon";
import { countByTopic } from "@/lib/db";
import { policiesRelated } from "@/lib/related";
import { TOPICS } from "@/lib/topics";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "분야별 정부지원 — 주거, 일자리, 교육, 건강, 출산, 돌봄",
  description: "정부·지자체 지원을 분야별로 나눴습니다. 주거지원, 취업지원, 교육비, 의료비, 출산지원금, 돌봄서비스까지 무엇이 필요한지로 고르세요.",
  alternates: { canonical: "/topic" },
};

export default async function TopicIndex() {
  const counts = await countByTopic().catch(() => ({} as Record<string, number>));
  return (
    <div className="pb-4">
      <p className="eyebrow mt-4">분야별</p>
      <h1 className="display mt-2 text-[1.9rem] leading-tight">무엇이 필요한지로 고르세요</h1>
      <p className="mt-3 max-w-[36rem] text-[15.5px] leading-relaxed text-muted">
        지원은 대상보다 분야로 찾는 편이 빠를 때가 있습니다. 집, 일, 배움, 건강, 아이, 돌봄 — 지금 급한 것부터.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((t) => (
          <Link key={t.slug} href={`/topic/${t.slug}`} className="card card-link flex gap-4 p-5">
            <TopicIcon slug={t.slug} color={t.color} soft={t.soft} size={52} />
            <div className="min-w-0">
              <b className="block text-[15.5px]">{t.name}
                {counts[t.key] !== undefined && <span className="num ml-2 text-xs font-normal text-faint">{counts[t.key].toLocaleString()}건</span>}
              </b>
              <span className="mt-0.5 block text-[13px] text-muted">{t.long}</span>
              <span className="mt-1.5 line-clamp-2 block text-[13px] leading-relaxed text-ink2">{t.intro[0]}</span>
            </div>
          </Link>
        ))}
      </div>
      <GuideBanner />
      <RelatedLinks items={policiesRelated()} />
      <PromoBanner placement="topic" />
    </div>
  );
}
