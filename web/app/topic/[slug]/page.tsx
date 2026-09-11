import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import MidAd from "@/components/MidAd";
import ProgramEntry from "@/components/ProgramEntry";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import TopicIcon from "@/components/TopicIcon";
import { listByTopic } from "@/lib/db";
import type { PromoContext } from "@/lib/promo";
import { policiesRelated } from "@/lib/related";
import { SITE_URL, YEAR } from "@/lib/seo";
import { TOPICS, topicBySlug } from "@/lib/topics";

export const revalidate = 3600;
export function generateStaticParams() { return TOPICS.map((t) => ({ slug: t.slug })); }

const CTX: Record<string, PromoContext> = { housing: "housing", jobs: "job", education: "student", pregnancy: "family", care: "family", finance: "money" };

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const t = topicBySlug(params.slug);
  if (!t) return {};
  return {
    title: `${t.long} 정부지원 총정리 (${YEAR}) — 신청 조건과 방법`,
    description: `${t.name} 분야 정부·지자체 지원사업을 모았습니다. ${t.intro[0].slice(0, 70)}… 접수 중인 사업부터 보여 드립니다.`,
    keywords: t.keywords,
    alternates: { canonical: `${SITE_URL}/topic/${t.slug}` },
  };
}

export default async function TopicPage({ params }: { params: { slug: string } }) {
  const t = topicBySlug(params.slug);
  if (!t) notFound();
  const list = await listByTopic(t.key, 60).catch(() => []);
  const others = TOPICS.filter((x) => x.slug !== t.slug).slice(0, 8);

  return (
    <div className="pb-4">
      <nav className="mt-2 text-xs text-muted"><Link href="/topic" className="hover:text-brand">분야별</Link></nav>
      <div className="mt-3 flex items-center gap-4">
        <TopicIcon slug={t.slug} color={t.color} soft={t.soft} size={64} />
        <div>
          <p className="eyebrow">{t.name}</p>
          <h1 className="display mt-1 text-[1.8rem] leading-tight sm:text-[2.1rem]">{t.long}</h1>
        </div>
      </div>
      <div className="mt-5 space-y-3 text-[15.5px] leading-[1.85] text-ink2">
        {t.intro.map((p) => <p key={p.slice(0, 16)}>{p}</p>)}
      </div>

      <div className="mb-3 mt-10 flex items-baseline justify-between">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">{t.name} 지원사업</h2>
        <span className="num text-sm text-muted">{list.length}건{list.length >= 60 && "+"}</span>
      </div>
      {list.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="leading-relaxed text-muted">지금은 목록을 불러오지 못했습니다. 잠시 뒤 다시 들어오시면 보입니다.</p>
          <Link href="/" className="btn btn-ghost mt-5">내 조건으로 찾기</Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.slice(0, 8).map((p) => <ProgramEntry key={p.id} p={p} />)}
          {list.length > 8 && <MidAd name="detail_mid" context={CTX[t.slug] ?? "general"} seed={t.slug} className="my-2" />}
          {list.slice(8).map((p) => <ProgramEntry key={p.id} p={p} />)}
        </div>
      )}
      <p className="mt-4 text-xs leading-relaxed text-muted">
        사는 곳과 나이를 넣으면 이 가운데 해당되는 것만 남습니다. 여기 목록은 전국 사업을 확신도 순으로 보인 것입니다.
      </p>
      <Link href="/" className="btn btn-primary mt-4 w-full py-4">내 조건으로 {t.name} 지원 찾기</Link>

      <Faq items={t.faq} />

      <section className="mt-14">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">다른 분야</h2>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {others.map((o) => (
            <Link key={o.slug} href={`/topic/${o.slug}`} className="group flex flex-col items-center gap-1.5 rounded-card px-1 py-3 text-center transition hover:bg-surface hover:shadow-lift">
              <TopicIcon slug={o.slug} color={o.color} soft={o.soft} />
              <span className="text-[12.5px] font-bold text-ink2 group-hover:text-brand">{o.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <GuideBanner />
      <RelatedLinks items={policiesRelated()} />
      <PromoBanner placement="topic" context={CTX[t.slug] ?? "general"} />
    </div>
  );
}
