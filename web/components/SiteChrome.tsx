"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BigText from "./BigText";

const NAV = [
  { href: "/", label: "지원금 찾기" },
  { href: "/#areas", label: "지역별" },
  { href: "/?tab=business", label: "기업지원" },
  { href: "/policies", label: "전체 정책" },
  { href: "/money", label: "생활금융" },
  { href: "/license", label: "자격증" },
  { href: "/jobs", label: "채용" },
  { href: "/agency", label: "공공기관" },
  { href: "/blog", label: "지원금 안내" },
  { href: "/about", label: "소개" },
];

/** 관리자 화면은 내부용이다. 방문자용 머리말·꼬리말을 달지 않는다. */
function useIsAdmin() {
  const path = usePathname();
  return path?.startsWith("/admin") ?? false;
}

export function SiteHeader() {
  const path = usePathname();
  if (path?.startsWith("/admin")) return null;
  const current = (href: string) => {
    const base = href.split("?")[0].split("#")[0];
    if (base === "/") return path === "/" && !href.includes("?");
    return path === base || path?.startsWith(base + "/");
  };
  return (
    <header className="pt-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-[1.35rem] font-extrabold tracking-tight text-brandDeep">나라지원</span>
          <span className="hidden text-xs text-muted sm:inline">
            나라에서 주는 지원, 받을 수 있는 지원
          </span>
        </Link>
        <BigText />
      </div>

      {/* 메뉴가 많아 한 줄 띠로 묶는다. 좁은 화면에서는 가로로 밀어서 본다. */}
      <nav
        aria-label="주 메뉴"
        className="menu-band -mx-5 mt-3 flex gap-1 overflow-x-auto px-3 text-[13.5px]
                   [scrollbar-width:none] sm:mx-0 sm:rounded-[12px]
                   [&::-webkit-scrollbar]:hidden"
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={current(n.href) ? "page" : undefined}
            className="shrink-0 px-3 py-2.5 font-semibold transition-colors"
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
          <Link href="/policies" className="underline underline-offset-4 hover:text-brand">
            전체 정책
          </Link>
          <span className="mx-2 text-line2">·</span>
          <Link href="/money" className="underline underline-offset-4 hover:text-brand">
            생활금융
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

        {/* 자료를 받아 오는 곳들. 원문 확인은 결국 여기서 한다. */}
        <p className="mt-5 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-4 text-[11.5px] text-faint">
          <span className="font-bold text-muted">자료 출처</span>
          {[
            ["복지로", "https://www.bokjiro.go.kr"],
            ["기업마당", "https://www.bizinfo.go.kr"],
            ["나라일터", "https://www.gojobs.go.kr"],
            ["월드잡플러스", "https://www.worldjob.or.kr"],
            ["큐넷", "https://www.q-net.or.kr"],
            ["주택금융공사", "https://www.hf.go.kr"],
            ["한국장학재단", "https://www.kosaf.go.kr"],
            ["알리오 플러스", "https://www.alioplus.go.kr"],
            ["공공데이터포털", "https://www.data.go.kr"],
          ].map(([name, href]) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer"
               className="hover:text-brand">{name}</a>
          ))}
        </p>
      </footer>
  );
}
