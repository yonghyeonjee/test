import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { isBot } from "@/lib/bot";
import { getHotSlides } from "@/lib/hotBanner";
import { Suspense } from "react";
import AlertBox from "@/components/AlertBox";
import BizSearchBox from "@/components/BizSearchBox";
import BusinessSentence from "@/components/BusinessSentence";
import ConditionSentence from "@/components/ConditionSentence";
import FeedTabs from "@/components/FeedTabs";
import ProgramEntry from "@/components/ProgramEntry";
import Finder from "@/components/Finder";
import { getHotTerms, type HotTerms } from "@/lib/hotTerms";
import { IllusEmpty } from "@/components/Illus";
import LastConditions from "@/components/LastConditions";
import RecentStrip from "@/components/RecentStrip";
import RememberMe from "@/components/RememberMe";
import GuideBanner from "@/components/GuideBanner";
import KeywordBar from "@/components/KeywordBar";
import TopicGrid from "@/components/TopicGrid";
import SectionHead from "@/components/SectionHead";
import AdSlot from "@/components/AdSlot";
import HotBanner from "@/components/HotBanner";
import HomeMap from "@/components/HomeMap";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import SaveBar from "@/components/SaveBar";
import SavedList from "@/components/SavedList";
import {
  AboutBox, DeadlineList, HotRank, MapCard, PortalColumns, PortalTop, ProgramLine,
} from "@/components/PortalHome";
import PortalIcon from "@/components/PortalIcon";
import SearchBox from "@/components/SearchBox";
import StatTables from "@/components/StatTables";
import Tabs from "@/components/Tabs";
import { promoContextFor } from "@/lib/promo";
import { SUGGEST_BUSINESS, SUGGEST_WELFARE, cleanQuery } from "@/lib/keywords";
import { blogIndexRelated } from "@/lib/related";
import { SITE_URL, withOg } from "@/lib/seo";
import { SIDO_SHORT } from "@/lib/geo";
import {
  countByTopic,
  countBusiness, countWelfare, feedClosing, feedNew, getBusinessRegions, getHomeBundle,
  logSearch, matchBusiness, matchWelfare, type Program,
} from "@/lib/db";


/** 기업 지원사업 첫 화면의 메타데이터. /business 가 쓴다. */
export function businessMetadata(): Metadata {
  return withOg({
    title: { absolute: "나라지원 — 중소기업·소상공인 지원사업 조회, 지역·업종·업력으로" },
    description:
      "지역과 사업체 형태만 고르면 신청할 수 있는 정부 지원사업 공고를 " +
      "찾아드립니다. 자금·기술·인력·수출·판로 분야를 마감일 순으로 정리했습니다.",
    keywords: ["나라지원", "소상공인 지원사업", "중소기업 지원사업", "창업 지원사업", "정부 지원사업 조회"],
    // 물음표 주소(/?tab=business)는 Next 가 정본 주소에서 물음표 뒤를 떼어 버려
    // 첫 화면과 같은 쪽으로 보였다. 그래서 /business 라는 제 길을 줬다.
    alternates: { canonical: "/business" },
  });
}

export async function homeMetadata({ searchParams }: { searchParams: SP }):
  Promise<Metadata> {
  const biz = (Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab)
    === "business";
  if (biz) return businessMetadata();
  // 사이트 이름이 제목에 없으면 "나라지원"으로 검색해도 첫 화면이 안 걸린다.
  // 이름을 맨 앞에 두고, 설명문도 이름으로 시작한다.
  return withOg({
    title: { absolute: "나라지원 — 정부지원금·청년지원금 조회, 사는 곳과 나이만 넣으면 됩니다" },
    description:
      "나라지원은 전국 지자체와 중앙부처의 정부지원금·복지서비스를 한자리에 모은 곳입니다. " +
      "사는 곳과 나이를 넣으면 해당될 만한 것만 남습니다. " +
      "회원가입도 주민등록번호도 필요 없습니다.",
    keywords: [
      "나라지원",
      "나라지원 사이트",
      "정부지원금 조회",
      "청년지원금",
      "복지서비스",
      "정부복지",
      "지원금 찾기",
      "지원금 신청 방법",
    ],
    alternates: { canonical: SITE_URL },
  });
}

export type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v);
const many = (v: SP[string]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** 촘촘한 공고 목록(제목·기관·남은 날). 탭 카드 안에 들어간다. */
function Lines({ items, fresh = false }: { items: Program[]; fresh?: boolean }) {
  if (!items.length) return null;
  return <ul className="divide-y divide-line">{items.map((p) => <ProgramLine key={p.id} p={p} fresh={fresh} />)}</ul>;
}

/** 많이 찾는 말 상자의 기준 문구. */
const hotSub = (h: HotTerms) => (h.from === "log" ? `지난 ${h.days}일` : "자주 찾는 말");

function Results({ results, total, label, myAge, terms, q }: {
  results: Program[]; total?: number; label: string; myAge?: number; terms: string[]; q?: string;
}) {
  // 목록은 60건까지만 받는다. 전체 건수를 따로 세어 왔으면 그 수를, 못 세어
  // 왔으면 "60건+" 로 적는다.
  const n = total ?? results.length;
  return (
    <section className="mt-8">
      {results.length > 0 && (
        <Suspense fallback={null}>
          <SaveBar label={terms} />
        </Suspense>
      )}

      <div className="mb-3 mt-8 flex items-baseline justify-between">
        <h1 className="text-[1.0625rem] font-bold">{label}</h1>
        <span className="num text-sm text-muted">
          {n.toLocaleString("ko-KR")}건{total === undefined && results.length >= 60 && "+"}
          {total !== undefined && total > results.length && (
            <span className="ml-1 text-xs text-faint">중 {results.length}건 표시</span>
          )}
        </span>
      </div>

      {results.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="mx-auto h-28 w-40"><IllusEmpty /></div>
          <p className="mt-2 leading-relaxed text-muted">
            입력하신 조건에 걸리는 사업을 찾지 못했습니다.
            <br />
            {q
              ? `‘${q}’ 을(를) 다른 말로 바꾸거나 빼고, 지역을 시·도 단위로 넓혀 보세요.`
              : "지역을 시·도 단위로 넓히거나 선택을 줄여 보세요."}
          </p>
          <Link href="/" className="btn btn-ghost mt-5">처음부터 다시</Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {results.map((p) => <ProgramEntry key={p.id} p={p} myAge={myAge} />)}
        </div>
      )}

      <p className="mt-8 text-xs leading-relaxed text-muted">
        여기 나온 사업이 곧 신청 자격이 있다는 뜻은 아닙니다. 소득·재산 기준처럼
        화면에 담기지 않은 요건이 남아 있을 수 있으니, 눌러서 원문을 확인하세요.
      </p>
    </section>
  );
}

export default async function Home({ searchParams, forceTab }: { searchParams: SP; forceTab?: "business" }) {
  const tab = forceTab ?? (one(searchParams.tab) === "business" ? "business" : "welfare");
  const via = one(searchParams.via) ?? "form";
  const [bundle, hotTerms] = await Promise.all([getHomeBundle(), getHotTerms()]);
  const { coverage, settings } = bundle;
  const sido = one(searchParams.sido);
  const q = cleanQuery(one(searchParams.q));
  const total = coverage.welfare + coverage.business;

  if (tab === "business") {
    const sidos = await getBusinessRegions();
    const bizTarget = one(searchParams.target);
    const bizField = many(searchParams.field);
    const yearsRaw = one(searchParams.years);
    const bizYears = yearsRaw ? Number(yearsRaw) : undefined;
    const industry = many(searchParams.ind);
    const asked = Boolean(
      sido || bizTarget || bizField.length || yearsRaw || industry.length || q
    );

    const bq = { sido, bizTarget, bizField, bizYears, industry, q };
    const [results, count] = asked
      ? await Promise.all([matchBusiness(bq), countBusiness(bq).catch(() => undefined)])
      : [[], 0];
    // 크롤러가 정책 화면의 조건 링크를 훑는 것까지 "검색"으로 세고 있었다.
    if (asked && !isBot(headers().get("user-agent")))
      logSearch({ kind: "business", sido, bizTarget, bizField,
                  n: results.length, entry: via });

    if (asked) {
      return (
        <>
          <Tabs active="business" counts={coverage} />
          <Suspense fallback={<div className="h-56" />}>
            <Finder
              pick={<><BusinessSentence sidos={sidos} /><KeywordBar suggest={SUGGEST_BUSINESS} tab="business" /></>}
              search={<BizSearchBox />}
            />
          </Suspense>
          <Results
            results={results}
            total={count}
            label="신청할 수 있는 지원사업"
            q={q}
            terms={[sido, bizTarget, yearsRaw ? `${yearsRaw}년차` : "", ...bizField, q && `‘${q}’`]
              .filter(Boolean) as string[]}
          />
          <PromoBanner placement="business-results" context="business" />
        </>
      );
    }

    const [closing, fresh] = await Promise.all([
      feedClosing("business", 6).catch(() => [] as Program[]),
      feedNew("business", 6).catch(() => [] as Program[]),
    ]);

    return (
      <>
        <PortalTop
          index={bundle.sggIndex} hot={hotTerms.business} scope="business" findHref="/business#find"
          h1="기업·소상공인 지원사업, 내 사업에 맞는 것만 — 나라지원 사업자 검색"
          tagline={<>중소기업·소상공인 지원사업 <b className="num text-ink">{coverage.business.toLocaleString("ko-KR")}</b>건을 지역·업종·업력으로</>}
          placeholder="무엇이 필요하세요 — 수출 바우처, 스마트공장, 소상공인 폐업"
          placeholderNarrow="수출, 스마트공장, 폐업, 특허…"
        />
        <PortalColumns
          main={<>
            <section id="find" className="card scroll-mt-28 p-4 sm:p-5">
              <Tabs active="business" counts={coverage} compact />
              <Suspense fallback={<div className="h-40" />}>
                {/* 낱말 칸(KeywordBar)은 두지 않는다 — 위 검색창과 겹친다. */}
                <BusinessSentence sidos={sidos} />
              </Suspense>
            </section>
            <FeedTabs tabs={[
              { key: "closing", label: "마감 임박", sub: `${settings.closingDays}일 이내 마감 · 놓치면 내년까지 기다려야 합니다`, more: "/policies",
                content: closing.length ? <Lines items={closing} /> : null },
              { key: "fresh", label: "새로 올라온", sub: `최근 ${settings.newDays}일`, more: "/policies",
                content: fresh.length ? <Lines items={fresh} fresh /> : null },
            ]} />
            <PromoBanner placement="business" context="business" />
          </>}
          aside={<>
            <AlertBox findHref="/business#find" />
            <HotRank terms={hotTerms.business} base="/business/search" sub={hotSub(hotTerms)} className="hidden lg:block" />
            <MapCard className="hidden lg:flex" />
            <AboutBox total={total} closing={bundle.closingCount} className="hidden lg:block" />
          </>}
        />
      </>
    );
  }

  const { regions, areas, stats, sggIndex } = bundle;

  const sigungu = one(searchParams.sigungu);
  const ageRaw = one(searchParams.age);
  const age = ageRaw ? Number(ageRaw) : undefined;
  const employment = one(searchParams.emp);
  const household = many(searchParams.hh);
  const asked = Boolean(sido || age || employment || household.length || q);

  const wq = { sido, sigungu, age, employment, household, q };
  const [results, count] = asked
    ? await Promise.all([matchWelfare(wq), countWelfare(wq).catch(() => undefined)])
    : [[], 0];
  if (asked && !isBot(headers().get("user-agent")))
    logSearch({ kind: "welfare", sido, sigungu, age, employment,
                household, n: results.length, entry: via });

  if (asked) {
    return (
      <>
        <Tabs active="welfare" counts={coverage} />
        {/* 사람이 직접 고른 조건만 기억한다. 글이나 정책 전체에서 "서울에서 찾기" 같은
            링크로 들어온 조건은 그 사람의 것이 아니다. */}
        {(sido || age) && (via === "form" || via === "last") && (
          <RememberMe sido={sido} sigungu={sigungu} age={age} emp={employment} hh={household} />
        )}
        {settings.notice && (
          <p className="mb-6 rounded-card bg-brandSoft px-4 py-3 text-sm text-brand">{settings.notice}</p>
        )}
        <Suspense fallback={<div className="h-56" />}>
          {/* 결과 화면에서는 자동 초점을 주지 않는다. 초점이 가면 브라우저가
              검색칸을 화면에 맞추느라 쪽을 내려 버려, 조건을 고르자마자
              "해당될 수 있는 사업"부터 보였다. */}
          <Finder
            pick={<><ConditionSentence regions={regions} /><KeywordBar suggest={SUGGEST_WELFARE} tab="welfare" /></>}
            search={<SearchBox index={sggIndex} />}
          />
        </Suspense>
        <Results
          results={results}
          total={count}
          label="해당될 수 있는 사업"
          myAge={age}
          q={q}
          terms={[sigungu || sido, age ? `${age}세` : "", employment, ...household, q && `‘${q}’`]
            .filter(Boolean) as string[]}
        />
        <AdSlot name="results_bottom" />
        <PromoBanner
          placement="results"
          context={promoContextFor({ employment, household, age })}
        />
      </>
    );
  }

  const { closing, closingFallback, fresh, closingCount } = bundle;
  const areaTotal = areas.reduce((a, x) => a + x.n, 0);
  const [topicCounts, hot] = await Promise.all([
    countByTopic().catch(() => ({} as Record<string, number>)),
    // 마감이 걸린 것만 도는 띠. 결과를 보는 중에는 방해가 되어 첫 화면에서만.
    getHotSlides().catch(() => []),
  ]);

  return (
    <>
      {settings.notice && (
        <p className="mt-4 rounded-card bg-brandSoft px-4 py-3 text-sm text-brand">{settings.notice}</p>
      )}
      {/* 검색 포털의 얼굴: 가운데 큰 검색창 → 많이 찾는 말 → 색 아이콘 바로가기.
          휴대폰에서는 이것만으로 첫 화면이 찬다. 긴 소개·통계 띠는 넓은 화면의
          오른쪽 기둥으로 줄여 옮겼다. */}
      <PortalTop
        index={sggIndex} hot={hotTerms.welfare}
        h1="나라지원 — 정부지원금·청년지원금 조회부터 공공기관 채용·자격증까지 한 번에 찾는 검색"
        tagline={<>정부지원금 · 채용 · 자격증 · 공공기관 사업을 <b className="text-ink">검색 한 번</b>으로</>}
      />
      <PortalColumns
        main={<>
          <section id="find" className="card scroll-mt-28 p-4 sm:p-5">
            <Tabs active="welfare" counts={coverage} compact />
            <Suspense fallback={<div className="h-40" />}>
              <ConditionSentence regions={regions} />
            </Suspense>
          </section>
          {/* 저장해 둔 조건과 지난번 조건. 조건 카드 바로 아래가 제자리다. */}
          <div className="-mb-5 empty:hidden">
            <Suspense fallback={null}>
              <SavedList />
            </Suspense>
            <LastConditions />
          </div>
          <RecentStrip />
          {/* 마감 롤링 띠(얇은 한 줄). 처음 온 사람에게는 조건 카드 바로 아래다. */}
          <HotBanner slides={hot} className="" />
          {/* 휴대폰: 정책지도 미리보기는 본문에. 넓은 화면은 오른쪽 기둥 맨 위. */}
          <HomeMap areas={areas} total={areaTotal} className="lg:hidden" />
          <FeedTabs tabs={[
            { key: "closing", label: "마감 임박",
              sub: closingFallback ? "마감일이 가까운 순 · 놓치면 내년까지 기다려야 합니다" : `${settings.closingDays}일 이내 마감 · 놓치면 내년까지 기다려야 합니다`,
              more: "/policies", content: closing.length ? <Lines items={closing.slice(0, 6)} /> : null },
            { key: "fresh", label: "새로 올라온", sub: `최근 ${settings.newDays}일`, more: "/policies",
              content: fresh.length ? <Lines items={fresh.slice(0, 6)} fresh /> : null },
          ]} />
          <AdSlot name="home_mid" />
          <TopicGrid counts={topicCounts} className="card p-4 sm:p-5" />
          <section id="areas" className="card scroll-mt-28 p-4 sm:p-5">
            <SectionHead title="우리 동네 지원금"
                         sub="시·도를 고르면 시·군·구 사업까지 함께 나옵니다." more="/policies" />
            {/* 휴대폰은 짧은 이름(서울·경기…)으로 네 칸. 긴 이름이 세 줄로 꺾였다. */}
            <div className="grid grid-cols-4 gap-x-1 gap-y-0.5 sm:gap-x-3">
              {areas.map((a) => (
                <Link key={a.sido} href={`/area/${encodeURIComponent(a.sido)}`} title={a.sido}
                      className="flex items-baseline justify-between gap-1 rounded-[8px] px-2 py-2 text-[14px]
                                 transition-colors hover:bg-ground">
                  <span className="truncate font-medium text-ink2">
                    <span className="sm:hidden">{SIDO_SHORT[a.sido] ?? a.sido}</span>
                    <span className="hidden sm:inline">{a.sido}</span>
                  </span>
                  <span className="num text-[12px] text-faint">{a.n}</span>
                </Link>
              ))}
            </div>
            <Link href="/map" className="mt-3 flex items-center justify-center gap-1.5 rounded-btn bg-cat-redSoft px-4 py-3
                                         text-[14px] font-bold text-cat-red transition-colors hover:bg-[#FFE3E3]">
              <PortalIcon name="map" className="h-[18px] w-[18px]" strokeWidth={2.1} />
              정책지도에서 내 주변 보기
            </Link>
          </section>

          {/* 넓은 화면에서만: 조건별 통계표·정책 전체 입구·안내 글. 휴대폰에서는 검색과
              바로가기로 충분하고, 긴 덩어리가 아래 탭 막대까지 몇 화면을 밀어냈다. */}
          <div className="hidden space-y-6 lg:block">
            <section className="card p-5">
              <SectionHead title="어디에 해당되시나요"
                           sub="눌러보면 그 조건에 걸리는 사업만 모아 보여드립니다." more="/policies" />
              <StatTables areas={areas} age={stats.age}
                          employment={stats.employment} household={stats.household} />
            </section>
            <Link href="/policies" className="card card-link flex items-center justify-between gap-6 p-5">
              <span className="block">
                <b className="block text-[16px] font-extrabold">무엇을 찾아야 할지 모르겠다면</b>
                <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">
                  대상·분야·지역·업종을 전부 펼쳐 두었습니다. 누르기만 하면 그 조건에 걸리는 공고만 남습니다.
                </span>
              </span>
              <span className="btn btn-primary shrink-0 !py-2.5">정책 전체 보기</span>
            </Link>
            <GuideBanner />
            <RelatedLinks
              title="처음이시라면 이것부터"
              items={blogIndexRelated().filter((r) => r.href !== "/")}
            />
          </div>
          <PromoBanner placement="home" />
        </>}
        aside={<>
          <HomeMap areas={areas} total={areaTotal} className="hidden lg:block" />
          <AlertBox />
          <HotRank terms={hotTerms.welfare} sub={hotSub(hotTerms)} className="hidden lg:block" />
          <DeadlineList slides={hot} className="hidden lg:block" />
          <AboutBox total={total} closing={closingCount} className="hidden lg:block" />
        </>}
      />
    </>
  );
}
