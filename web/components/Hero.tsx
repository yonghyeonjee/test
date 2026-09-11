import Link from "next/link";
import { HowItWorksArt } from "./Infographic";
import Photo from "./Photo";
import { CountUp } from "./Motion";

/** 대상자 중심 입구. "무엇을 지원하나"가 아니라 "누가 받나"로 묻는다. */
const TILES = [
  { href: "/?age=28&via=chip",  label: "청년",   desc: "월세 · 학자금 · 취업" },
  { href: "/?age=70&via=chip",  label: "어르신", desc: "돌봄 · 의료 · 수당" },
  { href: "/?hh=%EC%A0%80%EC%86%8C%EB%93%9D&via=chip", label: "저소득", desc: "생계 · 주거 · 의료" },
  { href: "/?tab=business", label: "사업자", desc: "자금 · 판로 · 인력" },
];

const TRUST = ["회원가입 없음", "주민등록번호 안 받음", "무료"];

export default function Hero({
  count, closing, children,
}: {
  count: number;
  closing: number;
  /** 히어로에 걸쳐 올라오는 카드 안에 들어갈 것 — 찾기 화면. */
  children: React.ReactNode;
}) {
  return (
    <>
      <section className="hero -mx-5 px-6 pb-24 pt-12 text-white sm:mx-0 sm:rounded-card sm:px-10">
        <div className="grid items-center gap-8 md:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="eyebrow !text-[#8FCFB0]">
              공공데이터 <CountUp value={count} />건 · 매일 새벽 갱신
            </p>
            <h1 className="display mt-4 text-[2.25rem] leading-[1.15] sm:text-[2.9rem]">
              나라에서 주는 지원,
              <br />
              <span className="text-[#8FCFB0]">받을 수 있는</span> 지원.
            </h1>
            <p className="mt-5 max-w-[27rem] text-[15.5px] leading-[1.8] text-[#B9D6C6]">
              중앙부처와 지자체가 내놓은 지원사업을 한자리에 모아,
              <b className="font-bold text-white"> 내 조건에 실제로 해당되는 것만</b>{" "}
              남깁니다. 사는 곳과 나이만 넣으면 됩니다.
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[#B9D6C6]">
              {TRUST.map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#8FCFB0]" fill="none"
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
                   fallback={<HowItWorksArt />} className="h-full" />
          </div>
        </div>
      </section>

      {/* 히어로가 position:relative 라 그냥 두면 검색 카드 위를 덮는다.
          끌어올린 쪽에도 스택 순서를 줘야 입력칸이 눌린다. */}
      <div className="relative z-10 -mt-16 px-0.5">
        <div className="card border-t-[3px] border-t-brand p-4 shadow-lift sm:p-5">{children}</div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TILES.map((t) => (
            <Link key={t.label} href={t.href} className="tile">
              <b className="display text-[1.15rem] text-ink">{t.label}</b>
              <span className="h-[2px] w-6 bg-brand" aria-hidden />
              <small className="text-[12.5px] leading-snug text-muted">{t.desc}</small>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
