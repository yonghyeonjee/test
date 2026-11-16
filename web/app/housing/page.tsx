import type { Metadata } from "next";
import { IllusHousing } from "@/components/Illus";
import Link from "next/link";
import { cache } from "react";

import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import {
  KINDS, KIND_KEYS, WHO, WHO_KEYS, countOf, type Count, housingCounts, housingPath, shortSido, sidosFor,
} from "@/lib/housing";
import { brandKeys, withOg } from "@/lib/seo";

export const revalidate = 21600;

const TITLE = "신혼부부·청년 전세·월세·매매 지원 총정리 — 지역별 주거 지원 찾기";
const DESC =
  "신혼부부, 청년, 무주택 가구가 받을 수 있는 전세자금 대출이자 지원, 월세·주거비 지원, 주택 구입(매매) 대출을 " +
  "대상과 지역별로 나눠 두었습니다. 주택도시기금 조건과 지금 접수 중인 시·군 사업을 한 번에 봅니다.";

// 목차와 제목·설명이 같은 숫자를 쓴다(한 번만 읽는다).
const loadCounts = cache(() => housingCounts().catch(() => [] as Count[]));

/**
 * 제목·설명에 지금 숫자(2026-11-16). 서치 콘솔에서 /housing 은 아직 '알려지지 않은 URL' 이고
 * 고정 문장이라 다른 주거 정리 쪽과 갈리지 않았다. 숫자는 화면 카드의 "접수 중 N건" 과 같다
 * (housing_counts_mv: 접수 중이거나 상시인 복지 사업 중 대상 말 × 종류 말이 다 들어간 것, 시·도 포함 전국).
 * 한 사업이 여러 칸에 들 수 있어 칸끼리 더하지 않는다. 못 읽으면 예전 문장.
 */
export async function generateMetadata(): Promise<Metadata> {
  const counts = await loadCounts();
  const cells = WHO_KEYS.flatMap((who) =>
    KIND_KEYS.map((kind) => ({ who, kind, n: countOf(counts, kind, who), sidos: sidosFor(counts, kind, who).length })),
  ).filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
  const top = cells.slice(0, 3);
  const cell = (c: (typeof cells)[number]) => `${WHO[c.who].label} ${KINDS[c.kind].label} ${c.n.toLocaleString("ko-KR")}건`;
  // 제목은 이 쪽이 겨냥하는 두 대상(청년·신혼부부)의 가장 큰 칸을 쓴다.
  const lead = (["youth", "newlywed"] as const).map((w) => cells.find((c) => c.who === w)).filter((c) => c !== undefined);
  const title = lead.length === 2
    ? `신혼부부·청년 주거 지원 — ${lead.map(cell).join(" · ")} 접수 중, 지역별로 찾기`
    : TITLE;
  const description = top.length >= 3
    ? `지금 접수 중인 주거 지원: ${top.map((c) => `${cell(c)}(${c.sidos}개 시·도)`).join(", ")}. ` +
      "신혼부부·청년·무주택 가구의 전세자금 대출이자, 월세·주거비, 주택 구입 대출을 대상과 지역별로 나누고 주택도시기금 조건을 함께 적었습니다."
    : DESC;
  return withOg({
    title,
    description,
    keywords: [
      ...brandKeys("주거 지원", "신혼부부", "청년 주거"),
      "신혼부부 전세자금 대출이자 지원", "신혼부부 월세 지원", "신혼부부 매매 대출", "신혼부부 주택구입자금대출",
      "청년 월세 지원", "청년 전세대출", "청년 주거비 지원", "무주택 주택 구입 지원", "경기도 신혼부부 전세자금 대출",
    ],
    alternates: { canonical: "/housing" },
  });
}

export default async function HousingHub() {
  const counts = await loadCounts();
  return (
    <div className="pb-4">
      <PageBanner tone="lime"
        eyebrow="주거 지원"
        title="전세·월세·매매, 누가 무엇을 받을 수 있나"
        sub="신혼부부·청년·무주택 가구가 받는 주거 지원을 대상과 종류로 갈랐습니다. 정부 대출 조건은 글로, 시·군 사업은 매일 새로 받은 공고로 채웁니다."
        art={<IllusHousing />}
      />

      <div className="mt-8 grid gap-6">
        {WHO_KEYS.map((who) => (
          <section key={who}>
            <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">{WHO[who].label}
              <span className="ml-2 text-[13px] font-normal text-muted">{WHO[who].desc}</span>
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {KIND_KEYS.map((kind) => {
                const n = countOf(counts, kind, who);
                const tops = sidosFor(counts, kind, who).slice(0, 5);
                return (
                  <div key={kind} className="card p-4">
                    <Link href={housingPath(kind, who)} className="block text-[15px] font-extrabold leading-snug hover:text-brand">
                      {WHO[who].label} {KINDS[kind].title}
                    </Link>
                    {counts.length > 0 && <p className="num mt-1 text-xs text-muted">접수 중 {n}건</p>}
                    {tops.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {tops.map((s) => (
                          <Link key={s.sido} href={housingPath(kind, who, s.sido)} className="chip !py-0.5 !text-[12.5px]">
                            {shortSido(s.sido)} <span className="num text-[12px] text-faint">{s.n}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-12 text-[15px] leading-[1.85] text-ink2">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">읽는 법</h2>
        <p className="mt-3">
          주거 지원은 두 층으로 되어 있습니다. 바닥은 주택도시기금이 운영하는 <b className="font-bold">대출</b>
          (버팀목 전세, 디딤돌 구입, 신생아 특례)이고, 그 위에 시·군이 <b className="font-bold">이자나 월세를 대신 내주는 사업</b>이
          얹힙니다. 대출은 전국 어디서나 조건이 같지만, 이자지원은 사는 곳에 따라 있고 없고가 갈립니다.
          그래서 대상을 고른 다음 지역을 고르는 순서로 두었습니다.
        </p>
      </section>

      <PromoBanner placement="housing" context="general" />
    </div>
  );
}
