import type { Metadata } from "next";
import Link from "next/link";
import { ArtPolicy } from "@/components/Art";
import AdSlot from "@/components/AdSlot";
import GuideBanner from "@/components/GuideBanner";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { AGE_LINK } from "@/components/StatTables";
import { policiesRelated } from "@/lib/related";
import {
  BIZ_FIELD, BIZ_TARGET, EMPLOYMENT, HOUSEHOLD, INDUSTRY,
  getAreas, getCoverage, getRegions, getStats,
  type Area, type Stat,
} from "@/lib/db";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "정책 전체 찾아보기 — 대상·분야·지역·업종별 정부지원",
  description:
    "전국 지자체와 중앙부처의 정부 지원 정책을 대상별·분야별·지역별로 한 화면에 펼쳤습니다. " +
    "조건을 누르면 해당되는 공고만 바로 모아 보실 수 있습니다.",
  keywords: [
    "정부 정책 모음",
    "정부지원 전체",
    "지역별 지원금",
    "업종별 지원사업",
    "정부복지 목록",
  ],
  alternates: { canonical: "/policies" },
};

type Data = {
  coverage: { welfare: number; business: number };
  regions: Awaited<ReturnType<typeof getRegions>>;
  areas: Area[];
  stats: { age: Stat[]; employment: Stat[]; household: Stat[] };
};

/**
 * 이 화면 하나 때문에 배포가 죽으면 안 된다. DB 를 못 읽으면 조건 목록만
 * 내보내고, 숫자는 비운 채 다음 revalidate 때 채운다.
 */
async function load(): Promise<Data> {
  try {
    const [coverage, regions, areas, stats] = await Promise.all([
      getCoverage(), getRegions(), getAreas(), getStats(),
    ]);
    return { coverage, regions, areas, stats };
  } catch (e) {
    console.warn("[policies] DB 를 읽지 못했다:", e);
    return {
      coverage: { welfare: 0, business: 0 },
      regions: [],
      areas: [],
      stats: { age: [], employment: [], household: [] },
    };
  }
}

function Chips({ items }: { items: { href: string; label: string; n?: number }[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map((it) => (
        <Link key={it.href + it.label} href={it.href} className="chip">
          {it.label}
          {it.n !== undefined && (
            <span className="num text-[11.5px] font-bold text-faint">{it.n}</span>
          )}
        </Link>
      ))}
    </div>
  );
}

function Block({ title, sub, children }: {
  title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{sub}</p>
      {children}
    </section>
  );
}

export default async function Policies() {
  const { coverage, regions, areas, stats } = await load();
  const total = coverage.welfare + coverage.business;
  const sggTotal = regions.reduce((a, r) => a + r.sigungu.length, 0);

  const band = [
    { n: total, label: "전체 지원사업" },
    { n: coverage.welfare, label: "개인·가구 복지" },
    { n: coverage.business, label: "기업·소상공인" },
    { n: areas.length || regions.length, label: "시·도" },
  ];

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="전체 보기"
        title="찾아볼 수 있는 정책을 전부 펼쳐 두었습니다"
        sub="무엇을 검색해야 할지 모르겠다면 여기서 시작하세요. 대상·분야·지역·업종을 누르기만 하면 그 조건에 걸리는 공고만 남습니다."
        art={<ArtPolicy />}
      >
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {band.map((b) => (
            <div key={b.label} className="rounded-card bg-white/10 px-3 py-3 text-center">
              <b className="num block text-[1.35rem] font-extrabold text-white">
                {b.n.toLocaleString()}
              </b>
              <span className="mt-0.5 block text-[11.5px] text-white/70">{b.label}</span>
            </div>
          ))}
        </div>
      </PageBanner>

      <Block
        title="누가 받는지로 찾기"
        sub="나이·일하는 형태·가구 사정 가운데 해당되는 것을 누르면, 그 조건이 붙은 사업만 모입니다. 두 가지 이상 해당되면 각각 눌러 비교해 보세요."
      >
        {stats.age.length > 0 && (
          <Chips
            items={stats.age.map((s) => ({
              href: `/?age=${AGE_LINK[s.label] ?? 30}&via=policies`,
              label: s.label,
              n: s.n,
            }))}
          />
        )}
        <h3 className="mt-6 text-sm font-bold text-ink2">일하는 형태</h3>
        <Chips
          items={EMPLOYMENT.map((e) => ({
            href: `/?emp=${encodeURIComponent(e)}&via=policies`,
            label: e,
            n: stats.employment.find((s) => s.label === e)?.n,
          }))}
        />
        <h3 className="mt-6 text-sm font-bold text-ink2">가구 사정</h3>
        <Chips
          items={HOUSEHOLD.map((h) => ({
            href: `/?hh=${encodeURIComponent(h)}&via=policies`,
            label: h,
            n: stats.household.find((s) => s.label === h)?.n,
          }))}
        />
      </Block>

      <Block
        title="사업체로 찾기"
        sub="소상공인과 중소기업 지원사업은 개인 복지와 아예 다른 곳에서 공고됩니다. 사업체 형태와 필요한 분야, 업종으로 나눠 두었습니다."
      >
        <Chips
          items={BIZ_TARGET.map((t) => ({
            href: `/?tab=business&target=${encodeURIComponent(t)}&via=policies`,
            label: t,
          }))}
        />
        <h3 className="mt-6 text-sm font-bold text-ink2">필요한 분야</h3>
        <Chips
          items={BIZ_FIELD.map((f) => ({
            href: `/?tab=business&field=${encodeURIComponent(f)}&via=policies`,
            label: f,
          }))}
        />
        <h3 className="mt-6 text-sm font-bold text-ink2">업종</h3>
        <Chips
          items={INDUSTRY.map((i) => ({
            href: `/?tab=business&ind=${encodeURIComponent(i)}&via=policies`,
            label: i,
          }))}
        />
      </Block>

      <Block
        title="사는 곳으로 찾기"
        sub={
          sggTotal
            ? `시·도 아래 시·군·구까지 ${sggTotal.toLocaleString()}곳을 모두 열어 두었습니다. 도 사업과 시·군 사업이 따로 있으니 둘 다 보셔야 합니다.`
            : "시·도를 고르면 그 지역의 시·군·구 사업까지 함께 나옵니다."
        }
      >
        <div className="mt-4 space-y-3">
          {regions.map((r) => (
            <div key={r.sido} className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <h3 className="text-[15px] font-bold">
                  <Link
                    href={`/area/${encodeURIComponent(r.sido)}`}
                    className="underline decoration-line2 underline-offset-4 hover:text-brand"
                  >
                    {r.sido}
                  </Link>
                </h3>
                <span className="num text-xs text-muted">
                  {areas.find((a) => a.sido === r.sido)?.n ?? r.sigungu.length}건
                </span>
              </div>
              {r.sigungu.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[13px]">
                  {r.sigungu.map((s) => (
                    <Link
                      key={s.name}
                      href={`/?sido=${encodeURIComponent(r.sido)}&sigungu=${encodeURIComponent(s.name)}&via=policies`}
                      className="text-muted transition-colors hover:text-brand"
                    >
                      {s.name}
                      <span className="num ml-1 text-[11px] text-faint">{s.n}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Block>

      <section className="mt-14">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          전부 펼쳐 둔 이유
        </h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            정부 지원을 찾을 때 가장 흔한 실패는 검색어를 잘못 넣는 것입니다.
            공고문에 쓰인 말과 사람들이 떠올리는 말이 다르기 때문입니다. 월세가
            부담스러워 찾아보는 사람은 &lsquo;월세 지원&rsquo;이라고 넣지만, 공고에는
            &lsquo;주거안정 월세대출&rsquo;이나 &lsquo;청년 주거비 지원&rsquo;으로 올라와
            있습니다. 그래서 검색창 대신 조건을 눌러 가며 훑을 수 있는 화면을 따로
            두었습니다. 내가 어떤 사람인지만 고르면 되니 용어를 몰라도 걸러집니다.
          </p>
          <p>
            지역도 마찬가지입니다. 시·도 단위 공고만 보고 &lsquo;우리 지역은 없네&rsquo;
            하고 넘기는 경우가 많은데, 실제로 돈이 나가는 사업은 시·군·구에서 하는
            것이 훨씬 많습니다. 같은 도 안에서도 옆 시에는 있고 우리 시에는 없는 사업이
            흔합니다. 그래서 시·군·구를 전부 펼쳐 두었습니다. 사는 곳을 눌러 한 번
            보고, 직장이나 부모님 주소지가 다른 지역이라면 그쪽도 한 번 눌러 보시면
            됩니다.
          </p>
          <p>
            여기 걸린 조건들은 저희가 임의로 만든 분류가 아니라 공고 원문에서 추려낸
            것입니다. 그래서 실제 공고에 그 조건이 적혀 있는 것만 걸립니다. 다만 소득이나
            재산 기준처럼 화면에 담기지 않은 요건이 남아 있을 수 있으니, 후보를 좁힌
            뒤에는 반드시 원문을 눌러 확인하시기 바랍니다.
          </p>
        </div>
      </section>

      <AdSlot name="page_bottom" />
      <GuideBanner />
      <RelatedLinks items={policiesRelated()} />
      <PromoBanner placement="policies" />
    </div>
  );
}
