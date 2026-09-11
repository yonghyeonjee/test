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
          <span className="display text-[1.5rem] text-deep">나라지원</span>
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
  const cols: { h: string; items: [string, string][] }[] = [
    { h: "찾기", items: [["내 조건으로 찾기", "/"], ["기업 지원사업", "/?tab=business"], ["정책 전체", "/policies"], ["지역별", "/#areas"]] },
    { h: "정보", items: [["채용·취업", "/jobs"], ["학과별 취업률", "/jobs/majors"], ["자격증", "/license"], ["생활금융", "/money"], ["공공기관", "/agency"]] },
    { h: "안내", items: [["지원금 안내 글", "/blog"], ["서비스 소개", "/about"], ["개인정보 처리방침", "/privacy"]] },
  ];
  const sources: [string, string][] = [
    ["복지로", "https://www.bokjiro.go.kr"], ["기업마당", "https://www.bizinfo.go.kr"],
    ["나라일터", "https://www.gojobs.go.kr"], ["월드잡플러스", "https://www.worldjob.or.kr"],
    ["큐넷", "https://www.q-net.or.kr"], ["주택금융공사", "https://www.hf.go.kr"],
    ["한국장학재단", "https://www.kosaf.go.kr"], ["알리오 플러스", "https://www.alioplus.go.kr"],
    ["공공데이터포털", "https://www.data.go.kr"],
  ];
  return (
    <footer className="band-deep -mx-5 mt-24 px-6 pb-8 pt-12 text-[13px] text-white/70 sm:mx-0 sm:rounded-t-card sm:px-10">
      <div className="grid gap-8 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <p className="display text-[1.35rem] text-white">나라지원</p>
          <p className="mt-3 max-w-[22rem] leading-relaxed">
            모르고 지나칠 정부 지원 혜택을 찾는 서비스입니다. 복지로와 기업마당이 공공데이터포털에
            개방한 자료를 매일 새벽 색인합니다.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.h}>
            <p className="eyebrow !text-[#8FCFB0]">{c.h}</p>
            <ul className="mt-3 space-y-1.5">
              {c.items.map(([label, href]) => (
                <li key={href}><Link href={href} className="hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-10 border-t border-white/10 pt-5 text-[11.5px] leading-relaxed text-white/50">
        화면의 조건은 공고 원문에서 자동으로 추려낸 것이라 실제와 다를 수 있습니다. 신청 자격의 최종
        확인과 접수는 원문 또는 관할 주민센터를 통해 하시기 바랍니다. 정부 공식 서비스가 아닙니다.
      </p>
      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-white/45">
        <span className="font-bold text-white/60">자료 출처</span>
        {sources.map(([name, href]) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="hover:text-white">{name}</a>
        ))}
      </p>
    </footer>
  );
}
