import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import BusinessSentence from "@/components/BusinessSentence";
import ConditionSentence from "@/components/ConditionSentence";
import ProgramEntry from "@/components/ProgramEntry";
import Hero from "@/components/Hero";
import ShareButton from "@/components/ShareButton";
import StatTables from "@/components/StatTables";
import Tabs from "@/components/Tabs";
import { SITE_URL } from "@/lib/seo";
import {
  feedClosing, getBusinessRegions, getHomeBundle,
  logSearch, matchBusiness, matchWelfare, type Program,
} from "@/lib/db";

export const revalidate = 900;

export async function generateMetadata({ searchParams }: { searchParams: SP }):
  Promise<Metadata> {
  const biz = (Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab)
    === "business";
  if (biz)
    return {
      title: "중소기업·소상공인 정부지원사업 조회",
      description:
        "지역과 사업체 형태만 고르면 신청할 수 있는 정부 지원사업 공고를 " +
        "찾아드립니다. 자금·기술·인력·수출·판로 분야를 마감일 순으로 정리했습니다.",
      alternates: { canonical: `${SITE_URL}/?tab=business` },
    };
  return { alternates: { canonical: SITE_URL } };
}

type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v);
const many = (v: SP[string]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function Row({ title, sub, items, more }: {
  title: string; sub?: string; items: Program[]; more?: string;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-12">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[1.0625rem] font-bold">
          {title}
          {sub && <span className="ml-2 text-xs font-normal text-muted">{sub}</span>}
        </h2>
        {more && (
          <Link href={more} className="text-xs text-muted hover:text-brand">
            더 보기
          </Link>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((p) => <ProgramEntry key={p.id} p={p} compact />)}
      </div>
    </section>
  );
}

function Results({ results, label, myAge }: {
  results: Program[]; label: string; myAge?: number;
}) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[1.0625rem] font-bold">{label}</h2>
        <span className="num text-sm text-muted">
          {results.length}건{results.length >= 60 && "+"}
        </span>
      </div>

      {/* 조건이 주소에 그대로 담기므로, 찾은 결과를 그대로 보낼 수 있다. */}
      {results.length > 0 && (
        <div className="mb-4">
          <ShareButton title={label} text="이 조건으로 찾은 지원사업입니다" />
        </div>
      )}

      {results.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="leading-relaxed text-muted">
            입력하신 조건에 걸리는 사업을 찾지 못했습니다.
            <br />
            지역을 시·도 단위로 넓히거나 선택을 줄여 보세요.
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

export default async function Home({ searchParams }: { searchParams: SP }) {
  const tab = one(searchParams.tab) === "business" ? "business" : "welfare";
  const via = one(searchParams.via) ?? "form";
  const bundle = await getHomeBundle();
  const { coverage, settings } = bundle;
  const sido = one(searchParams.sido);

  if (tab === "business") {
    const sidos = await getBusinessRegions();
    const bizTarget = one(searchParams.target);
    const bizField = many(searchParams.field);
    const yearsRaw = one(searchParams.years);
    const bizYears = yearsRaw ? Number(yearsRaw) : undefined;
    const asked = Boolean(sido || bizTarget || bizField.length || yearsRaw);

    const results = asked
      ? await matchBusiness({ sido, bizTarget, bizField, bizYears })
      : [];
    if (asked)
      logSearch({ kind: "business", sido, bizTarget, bizField,
                  n: results.length, entry: via });

    const closing = asked ? [] : await feedClosing("business", 6);

    return (
      <>
        <Tabs active="business" counts={coverage} />
        <Suspense fallback={<div className="h-40" />}>
          <BusinessSentence sidos={sidos} />
        </Suspense>
        {asked ? (
          <Results results={results} label="신청할 수 있는 지원사업" />
        ) : (
          <>
            <p className="num mt-8 text-sm text-muted">
              현재 {coverage.business.toLocaleString()}건의 지원사업을 조건별로
              찾을 수 있습니다.
            </p>
            <Row title="놓치면 내년까지 기다려야 합니다"
                 sub={`${settings.closingDays}일 이내`} items={closing} />
          </>
        )}
      </>
    );
  }

  const { regions, areas, stats, sggIndex } = bundle;

  const sigungu = one(searchParams.sigungu);
  const ageRaw = one(searchParams.age);
  const age = ageRaw ? Number(ageRaw) : undefined;
  const employment = one(searchParams.emp);
  const household = many(searchParams.hh);
  const asked = Boolean(sido || age || employment || household.length);

  const results = asked
    ? await matchWelfare({ sido, sigungu, age, employment, household })
    : [];
  if (asked)
    logSearch({ kind: "welfare", sido, sigungu, age, employment,
                household, n: results.length, entry: via });

  const { closing, fresh, closingCount } = bundle;

  return (
    <>
      <Tabs active="welfare" counts={coverage} />

      {settings.notice && (
        <p className="mb-6 rounded-card bg-brandSoft px-4 py-3 text-sm text-brand">
          {settings.notice}
        </p>
      )}

      {!asked && (
        <Hero
          index={sggIndex}
          count={coverage.welfare + coverage.business}
          closing={closingCount}
        />
      )}

      <div className={asked ? "" : "mt-12"}>
        {!asked && (
          <p className="mb-3 text-xs font-bold text-muted">직접 골라서 찾기</p>
        )}
        <Suspense fallback={<div className="h-40" />}>
          <ConditionSentence regions={regions} />
        </Suspense>
      </div>

      {asked ? (
        <Results results={results} label="해당될 수 있는 사업" myAge={age} />
      ) : (
        <>
          <Row title="놓치면 내년까지 기다려야 합니다"
               sub={`${settings.closingDays}일 이내`} items={closing} />
          <Row title="이번 주에 새로 올라왔어요"
               sub={`최근 ${settings.newDays}일`} items={fresh} />

          <section className="mt-14">
            <h2 className="text-[1.0625rem] font-bold">어디에 해당되시나요</h2>
            <p className="mb-3 mt-1 text-sm text-muted">
              눌러보면 그 조건에 걸리는 사업만 모아 보여드립니다.
            </p>
            <StatTables areas={areas} age={stats.age}
                        employment={stats.employment} household={stats.household} />
          </section>

          <section id="areas" className="mt-12">
            <h2 className="text-[1.0625rem] font-bold">우리 동네 지원금</h2>
            <p className="mb-3 mt-1 text-sm text-muted">
              시·도를 고르면 시·군·구 사업까지 함께 나옵니다.
            </p>
            <div className="card grid grid-cols-2 gap-x-6 gap-y-1 p-5 sm:grid-cols-3">
              {areas.map((a) => (
                <Link key={a.sido} href={`/area/${encodeURIComponent(a.sido)}`}
                      className="flex items-baseline justify-between rounded-[8px]
                                 px-2 py-2 text-sm transition-colors hover:bg-ground
                                 hover:text-brand">
                  <span>{a.sido}</span>
                  <span className="num text-xs text-muted">{a.n}</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
