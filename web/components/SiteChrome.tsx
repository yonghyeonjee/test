"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BigText from "./BigText";

const NAV = [
  { href: "/", label: "지원금 찾기" },
  { href: "/#areas", label: "지역별" },
  { href: "/?tab=business", label: "기업지원" },
  { href: "/blog", label: "지원금 안내" },
  { href: "/about", label: "소개" },
];

/** 관리자 화면은 내부용이다. 방문자용 머리말·꼬리말을 달지 않는다. */
function useIsAdmin() {
  const path = usePathname();
  return path?.startsWith("/admin") ?? false;
}

export function SiteHeader() {
  if (useIsAdmin()) return null;
  return (
    <header className="pb-2 pt-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-extrabold tracking-tight">나라지원</span>
          <span className="hidden text-xs text-muted sm:inline">
            내가 받을 수 있는 것만
          </span>
        </Link>
        <BigText />
      </div>

      {/* 메뉴가 늘어 헤더 한 줄에 다 넣으면 좁은 화면에서 눌리지 않는다.
          줄을 따로 두고, 넘치면 가로로 밀어서 본다. */}
      <nav
        className="-mx-5 mt-3 flex gap-4 overflow-x-auto px-5 pb-1 text-[13px]
                   text-muted [scrollbar-width:none]
                   [&::-webkit-scrollbar]:hidden"
      >
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
  );
}

export function SiteFooter() {
  if (useIsAdmin()) return null;
  return (
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
  );
}
