import type { ReactNode } from "react";
import TopStripAd from "./TopStripAd";

/** 갈래 색(진한·옅은). tailwind 의 cat.* 와 같은 값. */
const TONES = {
  brand: ["#5A4BE0", "#EEEBFF"],
  green: ["#0C9F6E", "#E6FCF5"],
  red: ["#E03131", "#FFF0F0"],
  violet: ["#7048E8", "#F3F0FF"],
  blue: ["#1C7ED6", "#E7F5FF"],
  orange: ["#E8590C", "#FFF4E6"],
  lime: ["#5C940D", "#F4FCE3"],
  cyan: ["#0C8599", "#E3FAFC"],
  indigo: ["#3B5BDB", "#EDF2FF"],
  pink: ["#C2255C", "#FFF0F6"],
} as const;
export type Tone = keyof typeof TONES;

/**
 * 자료 화면의 머리 띠. 흰 카드에 갈래 색을 옅게 깔고, 위첨자 제목만 갈래 색으로.
 *
 * 예전에는 짙은 보라 물결 띠였다. 모든 자료 화면이 같은 짙은 띠로 시작해서
 * 화면이 무겁고 어디가 어디인지 갈리지 않았다. 채용은 파랑, 자격증은 주황처럼
 * 첫 화면 바로가기와 같은 색을 입힌다.
 */
export default function PageBanner({
  eyebrow, title, sub, art, tone = "brand", children,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  art: ReactNode;
  tone?: Tone;
  children?: ReactNode;
}) {
  const [c, soft] = TONES[tone];
  return (
    <>
    <section className="banner-soft -mx-5 mt-4 px-6 py-7 sm:mx-0 sm:rounded-card sm:px-9 sm:py-8"
             style={{ ["--tone" as string]: c, ["--tone-soft" as string]: soft }}>
      <div className="flex items-center gap-6">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display mt-2 text-[1.6rem] leading-tight text-ink sm:text-[1.9rem]">
            {title}
          </h1>
          <p className="mt-2.5 max-w-[34rem] text-[14.5px] leading-[1.75] text-muted">
            {sub}
          </p>
        </div>
        {/* 좁은 화면에서는 그림을 접는다. 글이 먼저다. */}
        <div className="relative hidden h-28 w-44 shrink-0 sm:block md:h-32 md:w-52">
          <span className="banner-art relative block h-full w-full">{art}</span>
        </div>
      </div>
      {children}
    </section>
    {/* 머리 띠 바로 아래 작은 가로 광고(관리자가 켠 때만). */}
    <TopStripAd />
    </>
  );
}
