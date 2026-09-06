import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import VisitTracker from "@/components/VisitTracker";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        <div className="mx-auto max-w-[54rem] px-5">
          <VisitTracker />
          <SiteHeader />

          <main>{children}</main>

          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
