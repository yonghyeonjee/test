import type { Metadata } from "next";
import { Suspense } from "react";
import { GtmNoScript, GtmScript, RouteChange } from "@/components/Gtm";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import VisitTracker from "@/components/VisitTracker";
import { HotkeyFocus } from "@/components/Motion";
import FloatingMenu from "@/components/FloatingMenu";
import { unstable_cache } from "next/cache";
import { getSigunguIndex } from "@/lib/db";
import { getSiteConfig } from "@/lib/settings";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const BASE: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "정부지원금 조회 — 로그인 없이 내 조건으로 찾기 | 나라지원",
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "사는 지역과 나이만 넣으면 받을 수 있는 정부지원금·복지서비스를 찾아드립니다. " +
    "회원가입도 주민등록번호도 필요 없습니다. 전국 지자체·중앙부처 공고를 매일 모읍니다.",
  keywords: [
    "정부지원금", "정부지원금 조회", "지원금 찾기", "복지 혜택",
    "국가 지원금", "지자체 지원금", "청년 지원금", "소상공인 지원사업",
  ],
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ko_KR",
    url: SITE_URL,
    title: "내가 받을 수 있는 정부지원금, 로그인 없이 확인하세요",
    description:
      "지역·나이·상황만 고르면 해당될 수 있는 지원금과 복지서비스를 찾아드립니다.",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

/** 관리자 설정(SEO)을 합쳐 낸다. 확인 토큰·설명·색인 여부가 여기서 바뀐다. */
export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getSiteConfig();
  const other: Record<string, string> = {};
  if (seo.naver) other["naver-site-verification"] = seo.naver;
  if (seo.bing) other["msvalidate.01"] = seo.bing;
  return {
    ...BASE,
    description: seo.description.trim() || BASE.description,
    keywords: seo.keywords.trim()
      ? seo.keywords.split(",").map((k) => k.trim()).filter(Boolean)
      : BASE.keywords,
    robots: seo.index ? { index: true, follow: true } : { index: false, follow: false },
    verification: { ...(seo.google ? { google: seo.google } : {}), other },
  };
}

/**
 * 머리말 검색창이 쓰는 시군구 색인. 어느 화면에서든 필요해 레이아웃에서
 * 받되, 한 시간 캐시로 두어 매 요청마다 DB 를 두드리지 않는다. 못 읽으면
 * 빈 색인 — 검색창은 그대로 뜨고 지역만 못 알아듣는다.
 */
const cachedIndex = unstable_cache(
  async () => {
    try {
      return Object.fromEntries(await getSigunguIndex());
    } catch {
      return {} as Record<string, { sido: string; full: string }>;
    }
  },
  ["sgg-index"],
  { revalidate: 3600 },
);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const index = await cachedIndex();
  return (
    <html lang="ko">
      <head>
        {/* @import 로 넣으면 렌더가 막힌다. 미리 연결해두고 따로 받는다. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* 큰 화면 보기 설정을 첫 페인트 전에 적용한다. 없으면 글자가
            커졌다 작아지는 깜빡임이 보인다. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('jw.big')==='1')" +
              "document.documentElement.classList.add('big')}catch(e){}",
          }}
        />
      </head>
      <body>
        <GtmNoScript />
        <GtmScript />
        <Suspense fallback={null}>
          <RouteChange />
        </Suspense>

        <a href="#main" className="skip">본문으로 건너뛰기</a>
        <div className="mx-auto max-w-[54rem] px-5 lg:max-w-[64rem]">
          <VisitTracker />
          <SiteHeader index={index} />

          <main id="main">{children}</main>
          <FloatingMenu />
          <HotkeyFocus />

          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
