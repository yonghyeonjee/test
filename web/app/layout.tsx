import type { Metadata } from "next";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://jiwon.knowhow-it.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "지원 — 내가 받을 수 있는 복지·지원사업 찾기",
    template: "%s | 지원",
  },
  description:
    "사는 지역과 나이, 취업 상태를 넣으면 해당될 가능성이 있는 복지서비스와 정부 지원사업을 찾아 보여줍니다. 회원가입 없이 이용할 수 있습니다.",
  openGraph: {
    type: "website",
    siteName: "지원",
    locale: "ko_KR",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <div className="mx-auto max-w-[46rem] px-5">
          <header className="flex items-baseline justify-between pt-8 pb-10">
            <a href="/" className="text-lg font-extrabold tracking-tight">
              지원
            </a>
            <span className="text-xs text-muted">
              공공데이터 기반 · 정부 공식 서비스 아님
            </span>
          </header>

          <main>{children}</main>

          <footer className="mt-24 border-t border-rule py-10 text-xs leading-relaxed text-muted">
            <p>
              이 사이트는 복지로(한국사회보장정보원)와 기업마당(중소벤처기업부)이
              공공데이터포털을 통해 개방한 자료를 색인해 안내하는 민간 서비스입니다.
              정부·지자체가 운영하는 공식 서비스가 아닙니다.
            </p>
            <p className="mt-3">
              표시된 조건은 공고 원문에서 자동으로 추려낸 것이라 실제와 다를 수
              있습니다. 신청 자격의 최종 확인과 접수는 반드시 원문 또는 관할
              주민센터를 통해 하시기 바랍니다.
            </p>
            <p className="mt-3">
              입력하신 조건은 서버에 저장하지 않습니다.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
