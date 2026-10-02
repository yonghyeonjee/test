import Link from "next/link";
import HeroPeople from "./HeroPeople";
import Photo from "./Photo";
import { AmbientVideo, hasPublic } from "./Video";
import { CountUp } from "./Motion";
import Glyph from "./Glyph";

/** 대상자 중심 입구. "무엇을 지원하나"가 아니라 "누가 받나"로 묻는다. */
const TILES = [
  { href: "/?age=28&via=chip",  label: "청년",   desc: "월세 · 학자금 · 취업", glyph: "youth",     tone: "bg-brandSoft text-brand" },
  { href: "/?age=70&via=chip",  label: "어르신", desc: "돌봄 · 의료 · 수당",   glyph: "senior",    tone: "bg-[#FDF0DC] text-[#B45309]" },
  { href: "/?hh=%EC%A0%80%EC%86%8C%EB%93%9D&via=chip", label: "저소득", desc: "생계 · 주거 · 의료", glyph: "lowincome", tone: "bg-[#DDF4F0] text-[#0F766E]" },
  { href: "/business", label: "사업자", desc: "자금 · 판로 · 인력",   glyph: "business",  tone: "bg-[#FCE7F3] text-[#9D174D]" },
];

const TRUST = ["회원가입 없음", "주민등록번호 안 받음", "무료"];

/**
 * 첫 화면의 머리.
 *
 * 차례가 곧 쓰임새다. 포털의 첫 화면은 검색이라, 메뉴 띠를 지나자마자 검색창(top)이
 * 오고, 그 아래 네 갈래 바로가기, 그다음에야 소개 띠와 조건 고르기 카드가 온다.
 * 예전에는 소개 띠가 먼저라 휴대폰에서 검색창이 첫 화면 밖에 있었다.
 *
 * 휴대폰에서는 소개 띠를 줄인다 — 긴 설명문은 넓은 화면에서만.
 */
export default function Hero({
  count, closing, top, children,
}: {
  count: number;
  closing: number;
  /** 맨 위에 오는 것 — 검색창. */
  top?: React.ReactNode;
  /** 소개 띠에 걸쳐 올라오는 카드 안에 들어갈 것 — 조건 고르기. */
  children: React.ReactNode;
}) {
  const video = hasPublic("video/hero.mp4") ? "/video/hero.mp4" : "/login-bg.mp4";
  return (
    <>
      {top && <div className="mt-4">{top}</div>}

      <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
        {TILES.map((t) => (
          <Link key={t.label} href={t.href}
                className="tile group !items-center !gap-1.5 !p-2.5 sm:!items-start sm:!gap-2.5 sm:!p-[18px]">
            <span className={`tile-ic ${t.tone}`}><Glyph name={t.glyph} className="h-5 w-5" /></span>
            <b className="display text-[1rem] text-ink group-hover:text-brand sm:text-[1.15rem]">{t.label}</b>
            <small className="hidden text-[12.5px] leading-snug text-muted sm:block">{t.desc}</small>
          </Link>
        ))}
      </div>

      <section className="hero -mx-5 mt-6 px-6 pb-20 pt-8 text-white sm:mx-0 sm:rounded-card sm:px-10 sm:pb-24 sm:pt-12">
        <AmbientVideo src={video} poster="/poster.jpg" />
        <div className="grid items-center gap-8 md:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="eyebrow !text-[#C4B5FD]">
              공공데이터 <CountUp value={count} />건 · 매일 새벽 갱신
            </p>
            <h1 className="display mt-3 text-[1.75rem] leading-[1.15] sm:mt-4 sm:text-[2.9rem]">
              나라에서 주는 지원,
              <br />
              <span className="text-[#C4B5FD]">받을 수 있는</span> 지원.
            </h1>
            <p className="mt-4 hidden max-w-[27rem] text-[15.5px] leading-[1.8] text-[#C7C3EA] sm:block">
              중앙부처와 지자체가 내놓은 지원사업을 한자리에 모아,
              <b className="font-bold text-white"> 내 조건에 실제로 해당되는 것만</b>{" "}
              남깁니다. 사는 곳과 나이만 넣으면 됩니다.
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-[#C7C3EA] sm:mt-6 sm:gap-x-5 sm:gap-y-2">
              {TRUST.map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#C4B5FD]" fill="none"
                       stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
                       strokeLinejoin="round" aria-hidden><path d="M5 12l5 5 9-10" /></svg>
                  {t}
                </li>
              ))}
              {closing > 0 && (
                <li className="num text-[#F0C98A]">2주 안 마감 {closing.toLocaleString()}건</li>
              )}
            </ul>
          </div>
          {/* 사진이 있으면 사진, 없으면 절차 그림. */}
          <div className="hidden aspect-[6/5] md:block">
            <Photo name="hero" alt="주민센터 창구" credit="Unsplash"
                   fallback={<HeroPeople />} className="h-full" />
          </div>
        </div>
      </section>

      {/* 히어로가 position:relative 라 그냥 두면 카드 위를 덮는다.
          끌어올린 쪽에도 스택 순서를 줘야 입력칸이 눌린다. */}
      <div className="relative z-10 -mt-14 px-0.5 sm:-mt-16">
        <div className="card border-t-[3px] border-t-brand p-4 shadow-lift sm:p-5">{children}</div>
      </div>
    </>
  );
}
