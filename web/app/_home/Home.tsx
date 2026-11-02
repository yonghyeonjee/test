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
import StepFinder from "@/components/StepFinder";
import RecentFinds from "@/components/RecentFinds";
import HowItWorks from "@/components/HowItWorks";
import { Reveal } from "@/components/Motion";
import FeedPanels from "@/components/FeedPanels";
import ProgramEntry from "@/components/ProgramEntry";
import Finder from "@/components/Finder";
import { getHotTerms, type HotTerms } from "@/lib/hotTerms";
import { IllusEmpty } from "@/components/Illus";
import LastConditions from "@/components/LastConditions";
import RecentStrip from "@/components/RecentStrip";
import RememberMe from "@/components/RememberMe";
import JsonLd from "@/components/JsonLd";
import KeywordBar from "@/components/KeywordBar";
import TopicGrid from "@/components/TopicGrid";
import WideOnly from "@/components/WideOnly";
import SectionHead from "@/components/SectionHead";
import AdSlot from "@/components/AdSlot";
import PromoBanner from "@/components/PromoBanner";
import SaveBar from "@/components/SaveBar";
import SavedItems from "@/components/SavedItems";
import SavedList from "@/components/SavedList";
import { AboutBox, DeadlineList, HotRank, MapCard, PortalColumns, ProgramLine } from "@/components/PortalHome";
import HomeHero from "@/components/HomeHero";
import TodayNumbers, { type TodayTile } from "@/components/TodayNumbers";
import Ways, { type Way } from "@/components/Ways";
import { getAlioCounts, getJobOverview } from "@/lib/pubJobs";
import PortalIcon from "@/components/PortalIcon";
import SearchBox from "@/components/SearchBox";
import Tabs from "@/components/Tabs";
import { promoContextFor } from "@/lib/promo";
import { SUGGEST_BUSINESS, SUGGEST_WELFARE, cleanQuery } from "@/lib/keywords";
import { pageGraph } from "@/lib/schema";
import { SITE_URL, withOg } from "@/lib/seo";
import { SIDO_SHORT } from "@/lib/geo";
import {
  countByTopic,
  countBusiness, countWelfare, feedClosing, feedNew, getBusinessRegions, getHomeBundle,
  logSearch, matchBusiness, matchWelfare, type Program,
} from "@/lib/db";


const BIZ_TITLE = "K나라지원 — 중소기업·소상공인 지원사업 조회, 지역·업종·업력으로";
const BIZ_DESC =
  "지역과 사업체 형태만 고르면 신청할 수 있는 정부 지원사업 공고를 " +
  "찾아드립니다. 자금·기술·인력·수출·판로 분야를 마감일 순으로 정리했습니다.";
const HOME_TITLE = "K나라지원 — 정부지원금·청년지원금 조회, 사는 곳과 나이만 넣으면 됩니다";
const HOME_DESC =
  "K나라지원은 전국 지자체와 중앙부처의 정부지원금·복지서비스를 한자리에 모은 곳입니다. " +
  "사는 곳과 나이를 넣으면 해당될 만한 것만 남습니다. " +
  "회원가입도 주민등록번호도 필요 없습니다.";

/** 기업 지원사업 첫 화면의 메타데이터. /business 가 쓴다. */

/**
 * 검색으로 세지 않을 요청. 크롤러 이름표(isBot)에 더해, 언어 머리글(Accept-Language)이 없는 요청도 뺀다 —
 * 사람 브라우저는 반드시 보내고, 이름표를 브라우저로 꾸민 수집기는 흔히 빠뜨린다(/api/visit 와 같은 기준, 2026-10-29).
 * 전에는 /policies 의 조건 링크를 그런 수집기가 새벽마다 훑어 하루 검색 354건 중 302건이 사람이 아니었다.
 */
function botLike() {
  const h = headers();
  return isBot(h.get("user-agent")) || !h.get("accept-language");
}

export function businessMetadata(): Metadata {
  return withOg({
    title: { absolute: BIZ_TITLE },
    description: BIZ_DESC,
    keywords: ["K나라지원", "나라지원", "소상공인 지원사업", "중소기업 지원사업", "창업 지원사업", "정부 지원사업 조회"],
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
  // 사이트 이름이 제목에 없으면 "K나라지원"으로 검색해도 첫 화면이 안 걸린다.
  // 이름을 맨 앞에 두고, 설명문도 이름으로 시작한다.
  return withOg({
    title: { absolute: HOME_TITLE },
    description: HOME_DESC,
    keywords: [
      "K나라지원",
      "나라지원",
      "K나라지원 사이트",
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
  // 휴대폰은 두 칸이 위아래로 쌓여 길어지니 넷째 줄까지만.
  return <ul className="divide-y divide-line max-sm:[&>li:nth-child(n+5)]:hidden">{items.map((p) => <ProgramLine key={p.id} p={p} fresh={fresh} />)}</ul>;
}

/**
 * 첫 화면 구조화 데이터. "마감 임박"·"새로 올라온" 칸에 그린 공고만 적는다.
 * 같은 공고가 두 칸에 다 있으면 한 번만.
 */
function homeLd(path: string, name: string, description: string, ...panels: Program[][]) {
  const seen = new Set<string>();
  const items = panels.flat().filter((p) => !seen.has(p.source_id) && seen.add(p.source_id))
    .map((p) => ({ name: p.title, path: `/p/${encodeURIComponent(p.source_id)}` }));
  return <JsonLd data={pageGraph({ path, name, description, items })} />;
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

/**
 * ld: 조건 없는 첫 화면(/, /business)에서만 구조화 데이터를 싣는다. /find 는 같은 틀을
 * 쓰지만 조회 결과 쪽이라 싣지 않는다.
 */
export default async function Home({ searchParams, forceTab, ld = false }: { searchParams: SP; forceTab?: "business"; ld?: boolean }) {
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
      ? await Promise.all([matchBusiness(bq, 60, true), countBusiness(bq, true).catch(() => undefined)])
      : [[], 0];
    // 크롤러가 정책 화면의 조건 링크를 훑는 것까지 "검색"으로 세고 있었다.
    if (asked && !botLike())
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
        {ld && homeLd("/business", BIZ_TITLE, BIZ_DESC, closing, fresh)}
        {/* 첫 화면(/)과 같은 틀(2026-11-02): 약속 한 문장 → 입력 하나 → 신뢰 줄. */}
        <HomeHero
          index={bundle.sggIndex} hot={hotTerms.business} scope="business"
          h1={<>지역과 사업체 형태만 고르면,<br className="hidden sm:block" /> 지금 신청할 수 있는 <em className="not-italic text-brand">기업·소상공인 지원사업</em>이 남습니다</>}
          sub="중앙부처·지자체·공공기관의 자금·기술·인력·수출·판로 공고를 매일 모아 지역·업종·업력으로 걸러 드립니다."
          trust={[
            <>지원사업 <b className="num text-ink2">{coverage.business.toLocaleString("ko-KR")}</b>건</>,
            <>매일 새벽 갱신</>,
            <>출처 기업마당 · 소상공인24 · 지자체 공고</>,
            <>모든 공고에 원문 링크</>,
          ]}
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
            <div className="cv"><FeedPanels panels={[
              { key: "closing", label: "마감 임박", sub: `${settings.closingDays}일 이내 마감`, more: "/policies",
                content: closing.length ? <Lines items={closing} /> : null },
              { key: "fresh", label: "새로 올라온", sub: `최근 ${settings.newDays}일`, more: "/policies",
                content: fresh.length ? <Lines items={fresh} fresh /> : null },
            ]} /></div>
            <PromoBanner placement="business" context="business" />
          </>}
          aside={<>
            <AlertBox findHref="/business#find" />
            <WideOnly>
              <HotRank terms={hotTerms.business} base="/business/search" sub={hotSub(hotTerms)} className="hidden lg:block" />
              <MapCard className="hidden lg:flex" />
              <AboutBox total={total} closing={bundle.closingCount} className="hidden lg:block" />
            </WideOnly>
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
    ? await Promise.all([matchWelfare(wq, 60, true), countWelfare(wq, true).catch(() => undefined)])
    : [[], 0];
  if (asked && !botLike())
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
  const [topicCounts, hot, jobOv, alio] = await Promise.all([
    countByTopic().catch(() => ({} as Record<string, number>)),
    // 오늘의 채용 브리핑(새 공고·사흘 안 마감 건수)과 마감 임박 목록(오른쪽 기둥). 첫 화면에서만.
    getHotSlides().catch(() => []),
    // 채용 갈래 칸의 "접수 중 N건 · M개 기관". 미리 센 표 한 줄.
    getJobOverview().catch(() => null),
    getAlioCounts().catch(() => null),
  ]);
  const jobOpen = jobOv ? jobOv.openN + (alio?.open ?? 0) : 0;
  const brief = hot.find((s) => s.kind === "brief") ?? null;
  // 브리핑 제목 "오늘 새 공고 117건 · 사흘 안 마감 160건"에서 두 숫자를 읽는다. 없으면 접수 중 공고 수로.
  const bm = brief?.title.match(/새 공고 ([\d,]+)건.*?마감 ([\d,]+)건/);
  const briefNew = bm ? Number(bm[1].replace(/,/g, "")) : 0;
  const briefDue = bm ? Number(bm[2].replace(/,/g, "")) : 0;
  // 브리핑 밑글 "10월 30일 공공기관 채용 브리핑 · …"에서 날짜만.
  const briefDay = brief ? brief.sub.split(" 공공기관")[0] : null;
  const todayTiles: TodayTile[] = [
    ...(briefNew > 0 && brief
      ? [{ k: `${briefDay ?? "오늘"} 새 채용 공고`, n: briefNew, tag: "공공기관", tone: "bg-cat-blueSoft text-cat-blue", href: brief.href },
         { k: "사흘 안 마감 채용", n: briefDue, tag: "서두르세요", tone: "bg-alertSoft text-alert", href: "/jobs" }]
      : [{ k: "접수 중 채용 공고", n: jobOpen, tag: "공공기관", tone: "bg-cat-blueSoft text-cat-blue", href: "/jobs" }]),
    { k: `최근 ${settings.newDays}일 새 지원사업`, n: fresh.length, tag: "지원금", tone: "bg-cat-greenSoft text-cat-green", href: "/policies" },
    { k: `${settings.closingDays}일 안 마감 지원사업`, n: closingCount, tag: "마감 임박", tone: "bg-accentSoft text-accent", href: "/calendar" },
  ];
  const ways: Way[] = [
    { href: "/#find", label: "내 조건으로 지원금 찾기", sub: "사는 곳 → 나이 → 상태, 네 번 누르면 끝", icon: "find", tone: "bg-brand text-white", first: true },
    { href: "/jobs", label: "공공기관 채용",
      sub: jobOpen > 0 ? `접수 중 ${jobOpen.toLocaleString("ko-KR")}건${jobOv?.orgs ? ` · ${jobOv.orgs.toLocaleString("ko-KR")}개 기관` : ""}` : "나라일터·잡알리오를 하루 다섯 번",
      icon: "jobs", tone: "bg-cat-blueSoft text-cat-blue" },
    { href: "/license", label: "자격증 시험", sub: "다음 시험일 · 합격률 · 응시 지원 제도", icon: "license", tone: "bg-cat-orangeSoft text-cat-orange" },
    { href: "/business", label: "기업·창업 지원",
      sub: coverage.business > 0 ? `${coverage.business.toLocaleString("ko-KR")}건 · 지역·업종·업력으로` : "지역·업종·업력으로",
      icon: "biz", tone: "bg-cat-violetSoft text-cat-violet" },
    { href: "/map", label: "정책지도", sub: "내 주변 지원사업·채용을 지도에서", icon: "map", tone: "bg-cat-greenSoft text-cat-green" },
  ];

  return (
    <>
      {ld && homeLd("/", HOME_TITLE, HOME_DESC, closing.slice(0, 6), fresh.slice(0, 6))}
      {settings.notice && (
        <p className="mt-4 rounded-card bg-brandSoft px-4 py-3 text-sm text-brand">{settings.notice}</p>
      )}
      {/* 2026-11-02 첫 화면 재설계. 약속 한 문장(보이는 H1) → 입력 하나 → 신뢰 줄 → 오늘의 숫자 → 갈래 다섯 칸.
          회전 띠(HotBanner)·오른쪽 브리핑 카드(HomeTopAd)·지도 미리보기·달력·통계표·안내 글은 첫 화면에서 뺐다.
          h2 가 열 개를 넘으면 검색엔진이 쪽의 주제를 못 잡고, 접히는 선 위가 움직이는 띠뿐이면 처음 온 사람이
          여기가 무엇을 하는 곳인지 모른다. 지도는 /map, 통계표·정책 전체는 /policies, 소개는 /about 에 그대로 있다. */}
      <HomeHero
        index={sggIndex} hot={hotTerms.welfare}
        h1={<>사는 곳과 나이만 넣으면,<br className="hidden sm:block" /> 지금 받을 수 있는 <em className="not-italic text-brand">지원금·채용·시험</em>이 남습니다</>}
        sub="전국 지자체·중앙부처·공공기관의 공고를 매일 새벽 모아 조건으로 걸러 드립니다. 회원가입도 주민등록번호도 없습니다."
        trust={[
          <>공공데이터 <b className="num text-ink2">{total.toLocaleString("ko-KR")}</b>건{jobOpen > 0 && <> · 채용 <b className="num text-ink2">{jobOpen.toLocaleString("ko-KR")}</b>건 접수 중</>}</>,
          <>매일 새벽 갱신{briefDay && <> · <b className="text-ink2">{briefDay}</b> 브리핑</>}</>,
          <>출처 복지로 · 기업마당 · 나라일터 · 알리오 · 큐넷</>,
          <>모든 공고에 원문 링크</>,
        ]}
      />
      <TodayNumbers tiles={todayTiles} className="mt-5 sm:mt-7" note={briefDay ? `${briefDay} 브리핑 기준` : undefined} />
      <Ways items={ways} className="mt-5 sm:mt-6" />
      <PortalColumns
        main={<>
          <section id="find" className="card scroll-mt-28 p-4 sm:p-5">
            <StepFinder regions={regions} />
          </section>
          <RecentFinds />
          {/* 저장해 둔 조건과 지난번 조건. 조건 카드 바로 아래가 제자리다. */}
          <div className="-mb-5 empty:hidden">
            <Suspense fallback={null}>
              <SavedList />
            </Suspense>
            <LastConditions />
          </div>
          <SavedItems variant="strip" max={8} />
          <RecentStrip />
          <div className="cv"><FeedPanels panels={[
            { key: "closing", label: "마감 임박",
              sub: closingFallback ? "마감일이 가까운 순" : `${settings.closingDays}일 이내 마감`,
              more: "/policies", content: closing.length ? <Lines items={closing.slice(0, 6)} /> : null },
            { key: "fresh", label: "새로 올라온", sub: `최근 ${settings.newDays}일`, more: "/policies",
              content: fresh.length ? <Lines items={fresh.slice(0, 6)} fresh /> : null },
          ]} /></div>
          <section id="areas" className="card cv scroll-mt-28 p-4 sm:p-5">
            <SectionHead title="우리 동네 지원금"
                         sub={`시·도를 고르면 시·군·구 사업까지 함께 나옵니다. 전국 ${areaTotal.toLocaleString("ko-KR")}건.`} more="/policies" />
            {/* 휴대폰은 짧은 이름(서울·경기…)으로 네 칸. 긴 이름이 세 줄로 꺾였다. */}
            <div className="grid grid-cols-4 gap-x-1 gap-y-0.5 sm:grid-cols-6 sm:gap-x-3">
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
            <Link href="/map" className="mt-3 flex items-center justify-center gap-1.5 rounded-btn bg-brandSoft px-4 py-3
                                         text-[14px] font-bold text-brand transition-colors hover:bg-brand hover:text-white">
              <PortalIcon name="map" className="h-[18px] w-[18px]" strokeWidth={2.1} />
              정책지도에서 내 주변 보기
            </Link>
          </section>
          <Reveal className="cv"><TopicGrid counts={topicCounts} className="card p-4 sm:p-5" /></Reveal>
          {/* 사이트 소개(HowItWorks)는 휴대폰에서 뺀다 — 검색·갈래·마감 목록이면 첫 화면은 찬다(2026-10-22). */}
          <WideOnly min="sm"><Reveal><HowItWorks total={total} closing={closingCount}
                      areas={regions.reduce((a, r) => a + r.sigungu.length, 0)} /></Reveal></WideOnly>
          {/* 광고와 운영자 다른 사이트 배너는 맨 아래. 접히는 선 위에는 두지 않는다. */}
          <AdSlot name="home_mid" />
          <div className="cv"><PromoBanner placement="home" /></div>
        </>}
        aside={<>
          {/* 재방문을 만드는 유일한 장치라 기둥 맨 위. 지도·달력 미리보기는 첫 화면에서 뺐다(가장 무거운 요소였다). */}
          <AlertBox />
          <WideOnly>
            <HotRank terms={hotTerms.welfare} sub={hotSub(hotTerms)} className="hidden lg:block" />
            <DeadlineList slides={hot} className="hidden lg:block" />
            <AboutBox total={total} closing={closingCount} className="hidden lg:block" />
          </WideOnly>
        </>}
      />
    </>
  );
}
