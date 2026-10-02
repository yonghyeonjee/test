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
    {/* 얇게: 휴대폰에서 머리 띠가 첫 화면의 3분의 1을 먹어 본문(지도·목록)이 밀렸다. */}
    <section className="banner-soft -mx-5 mt-3 px-5 py-5 sm:mx-0 sm:rounded-card sm:px-8 sm:py-6"
             style={{ ["--tone" as string]: c, ["--tone-soft" as string]: soft }}>
      <div className="flex items-center gap-6">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display mt-1.5 text-[1.32rem] leading-tight text-ink sm:text-[1.7rem]">
            {title}
          </h1>
          <p className="mt-2 max-w-[36rem] text-[13.5px] leading-[1.7] text-muted sm:text-[14.5px]">
            {sub}
          </p>
        </div>
        {/* 좁은 화면에서는 그림을 접는다. 글이 먼저다. */}
        <div className="relative hidden h-24 w-36 shrink-0 sm:block md:h-28 md:w-44">
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
