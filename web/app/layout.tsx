import type { Metadata } from "next";
import Link from "next/link";
import BigText from "@/components/BigText";

const NAV = [
  { href: "/", label: "지원금 찾기" },
  { href: "/#areas", label: "지역별" },
  { href: "/?tab=business", label: "기업지원" },
  { href: "/blog", label: "지원금 안내" },
  { href: "/about", label: "소개" },
];
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
          <header className="pb-2 pt-6">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="flex items-baseline gap-2">
                <span className="text-lg font-extrabold tracking-tight">
                  나라지원
                </span>
                <span className="hidden text-xs text-muted sm:inline">
                  내가 받을 수 있는 것만
                </span>
              </Link>
              <BigText />
            </div>

            {/* 메뉴가 늘어 헤더 한 줄에 다 넣으면 좁은 화면에서 눌리지 않는다.
                줄을 따로 두고, 넘치면 가로로 밀어서 본다. */}
            <nav className="-mx-5 mt-3 flex gap-4 overflow-x-auto px-5 pb-1
                            text-[13px] text-muted [scrollbar-width:none]
                            [&::-webkit-scrollbar]:hidden">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="shrink-0 py-1 font-semibold transition-colors hover:text-brand"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </header>

          <main>{children}</main>

          <footer className="mt-24 border-t border-line py-10 text-xs leading-relaxed text-muted">
            <p className="font-bold text-ink2">
              나라지원은 모르고 지나칠 정부 지원 혜택을 찾는 서비스입니다.
            </p>
            <p className="mt-2">
              복지로(한국사회보장정보원)와 기업마당(중소벤처기업부)이
              공공데이터포털을 통해 개방한 자료를 색인해 안내하는 민간
              서비스입니다. 화면의 조건은 공고 원문에서 자동으로 추려낸 것이라
              실제와 다를 수 있으니, 신청 자격의 최종 확인과 접수는 원문 또는
              관할 주민센터를 통해 하시기 바랍니다.
            </p>
            <p className="mt-4">
              <Link href="/about" className="underline underline-offset-4 hover:text-brand">
                서비스 소개
              </Link>
              <span className="mx-2 text-line2">·</span>
              <Link href="/blog" className="underline underline-offset-4 hover:text-brand">
                지원금 안내
              </Link>
              <span className="mx-2 text-line2">·</span>
              <Link href="/privacy" className="underline underline-offset-4 hover:text-brand">
                개인정보 처리방침
              </Link>
              <span className="mx-2 text-line2">·</span>
              <a href="https://www.bokjiro.go.kr" target="_blank"
                 rel="noopener noreferrer"
                 className="underline underline-offset-4 hover:text-brand">
                복지로 바로가기
              </a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
