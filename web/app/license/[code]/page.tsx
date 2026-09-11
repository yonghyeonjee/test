import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtLicense } from "@/components/Art";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import MidAd from "@/components/MidAd";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { licenseFaq, licenseIntro, seriesEligibility } from "@/lib/licenseText";
import { getLicenses, type License } from "@/lib/qnet";
import { licenseRelated } from "@/lib/related";
import { SITE_URL } from "@/lib/seo";

/** 종목 목록은 일주일에 한 번이면 된다. 빌드 때 API 가 죽어 있으면 요청 때 만든다. */
export const revalidate = 604800;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const b = await getLicenses();
    return b.all.filter((l) => l.code).map((l) => ({ code: l.code }));
  } catch {
    return [];
  }
}

async function find(code: string): Promise<{ l: License; same: License[] } | null> {
  const b = await getLicenses();
  const l = b.all.find((x) => x.code === code);
  if (!l) return null;
  const same = b.all.filter((x) => x.field === l.field && x.code !== code).slice(0, 12);
  return { l, same };
}

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const r = await find(params.code);
  if (!r) return { title: "찾을 수 없는 종목" };
  const { l } = r;
  const title = `${l.name} 자격증 — 응시 자격, 시험 일정, 취득 지원 제도`;
  const description = `${l.name}(${l.series}, ${l.field})의 응시 자격과 시험 준비 방법, 학원비·응시료를 지원하는 정부 제도, 이 자격으로 지원할 수 있는 채용을 정리했습니다.`;
  return {
    title, description,
    keywords: [`${l.name}`, `${l.name} 자격증`, `${l.name} 응시자격`, `${l.name} 시험일정`, `${l.series} 자격증`],
    alternates: { canonical: `${SITE_URL}/license/${encodeURIComponent(l.code)}` },
  };
}

export default async function LicensePage({ params }: { params: { code: string } }) {
  const r = await find(params.code);
  if (!r) notFound();
  const { l, same } = r;

  return (
    <div className="pb-4">
      <nav className="mb-3 mt-2 text-xs text-muted">
        <Link href="/license" className="hover:text-brand">자격증</Link>
        {" / "}<Link href={`/license?series=${encodeURIComponent(l.series)}`} className="hover:text-brand">{l.series}</Link>
      </nav>
      <PageBanner
        eyebrow={`${l.kind === "T" ? "국가기술자격" : l.kindName || "국가자격"} · ${l.series}`}
        title={`${l.name} 자격증`}
        sub={`${l.field}${l.subField ? ` › ${l.subField}` : ""} 분야. 응시 자격과 준비 방법, 비용을 줄여 주는 제도까지 한 화면에.`}
        art={<ArtLicense />}
      />

      <p className="mt-8 text-[15.5px] leading-[1.85] text-ink2">{licenseIntro(l)}</p>

      <section className="mt-10 rounded-card border border-line bg-surface2 p-5">
        <h2 className="text-sm font-bold">응시 자격 (일반 기준)</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {seriesEligibility(l.series).map((e) => (
            <li key={e} className="flex items-start gap-2 text-[14.5px] leading-snug">
              <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-brand" fill="none" stroke="currentColor"
                   strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5 9-10" /></svg>
              {e}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">국가기술자격법 시행령의 등급별 일반 기준입니다. 종목별 예외와 인정 학과·경력 범위는 큐넷 종목 안내에서 최종 확인하세요.</p>
      </section>

      <MidAd name="detail_mid" context="job" seed={l.code} className="mt-10" />

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">준비 순서</h2>
        <ol className="mt-4 grid gap-6 sm:grid-cols-3">
          {[
            ["01", "응시 자격 확인", "위 기준에 해당하는지 보고, 애매하면 큐넷의 응시자격 자가진단을 돌려 봅니다."],
            ["02", "훈련과정 고르기", "국민내일배움카드로 등록된 과정을 고르면 훈련비 대부분을 지원받습니다. 실기가 있는 종목은 실습이 있는 과정을 택하세요."],
            ["03", "일정에 맞춰 접수", "큐넷에서 회차별 접수일을 확인합니다. 접수는 며칠만 받고 자리가 빨리 찹니다."],
          ].map(([n, h, b]) => (
            <li key={n} className="border-t-2 border-ink pt-4">
              <span className="numeral">{n}</span>
              <b className="mt-2 block text-[15px] font-bold">{h}</b>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">비용을 줄여 주는 제도</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["/blog/vocational-training-card", "국민내일배움카드", "훈련비 대부분과 훈련장려금. 실업자·재직자 모두."],
            ["/?emp=구직중&via=license", "청년 자격증 응시료 지원", "지자체별 응시료 환급·합격 장려금. 사는 곳으로 조회."],
            ["/blog/national-employment-support", "국민취업지원제도", "훈련 중 구직촉진수당. 취업활동계획에 훈련을 넣으면 됩니다."],
          ].map(([href, h, b]) => (
            <Link key={href} href={href} className="card card-link block p-5">
              <b className="block text-[15px]">{h}</b>
              <span className="mt-1.5 block text-[13.5px] leading-relaxed text-muted">{b}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        <a href={`https://www.q-net.or.kr/crf005.do?id=crf00505&jmCd=${encodeURIComponent(l.code)}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
          큐넷에서 시험 일정 보기
        </a>
        <Link href={`/jobs?q=${encodeURIComponent(l.field)}`} className="btn btn-ghost">이 분야 공공기관 채용</Link>
      </div>

      <Faq items={licenseFaq(l)} />

      {same.length > 0 && (
        <section className="mt-14">
          <h2 className="sec-title text-[1.0625rem] font-extrabold">같은 분야의 다른 종목</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {same.map((x) => (
              <Link key={x.code} href={`/license/${encodeURIComponent(x.code)}`} className="chip">
                {x.name}<span className="text-[11px] text-faint">{x.series}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <GuideBanner title="취업·이직을 준비하신다면 이것도" />
      <RelatedLinks items={licenseRelated()} />
      <PromoBanner placement="license-detail" context="job" />
    </div>
  );
}
