"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BigText from "./BigText";
import { HeaderFx } from "./Motion";
import { BrandMark } from "./Illus";
import TopSearch from "./TopSearch";

/**
 * 주 메뉴. 일곱 묶음.
 *
 * 열세 개가 한 줄에 늘어서 있었다 — 지원금 찾기·분야별·지역별·전체 정책이
 * 따로 서 있고, 지원금 안내·블로그·무료 서비스·소개가 또 따로. 사람이 보는
 * 갈래는 "지원금 / 기업 / 채용 / 자격증 / 금융 / 공공기관 / 읽을거리" 일곱이다.
 * 나머지는 그 안의 하위 메뉴로 넣는다. 묶음 안에 들어가 있으면 아래에 갈래
 * 줄이 하나 더 붙는다.
 *
 * match 는 그 묶음으로 치는 주소 앞머리. /p/… (공고 하나), /area/… (지역)
 * 처럼 메뉴에 직접 없는 쪽도 제 묶음이 켜지게.
 */
type Leaf = { href: string; label: string; match?: string[] };
type NavItem = Leaf & { sub?: Leaf[] };

const NAV: NavItem[] = [
  {
    href: "/", label: "지원금 찾기", match: ["/p/", "/area/", "/topic", "/policies", "/housing"],
    sub: [
      { href: "/", label: "내 조건으로 찾기", match: ["/p/"] },
      { href: "/topic", label: "분야별" },
      { href: "/#areas", label: "지역별", match: ["/area/"] },
      { href: "/housing", label: "주거 지원" },
      { href: "/policies", label: "정책 전체" },
    ],
  },
  { href: "/map", label: "정책지도" },
  { href: "/business", label: "기업·창업" },
  {
    href: "/jobs", label: "채용",
    sub: [
      { href: "/jobs", label: "공공기관 채용" },
      { href: "/jobs/region", label: "지역별 채용" },
      { href: "/jobs/org", label: "기관별 채용 이력" },
      { href: "/jobs/overseas", label: "해외취업" },
      { href: "/jobs/majors", label: "학과별 취업률" },
    ],
  },
  {
    href: "/license", label: "자격증",
    sub: [
      { href: "/license", label: "종목 찾기" },
      { href: "/license/pro", label: "국가전문자격" },
      { href: "/license/schedule", label: "시험 일정" },
    ],
  },
  {
    href: "/money", label: "생활금융",
    sub: [
      { href: "/money/jeonse", label: "전세대출 금리" },
      { href: "/money/home-loan", label: "구입자금 금리" },
      { href: "/money/student-loan", label: "학자금 이자지원" },
      { href: "/housing", label: "주거 지원 찾기" },
    ],
  },
  {
    href: "/agency", label: "공공기관",
    sub: [
      { href: "/agency", label: "기관 사업" },
      { href: "/agency/events", label: "행사·교육" },
      { href: "/agency/facilities", label: "시설 이용" },
    ],
  },
  {
    href: "/blog", label: "읽을거리", match: ["/story", "/free", "/about"],
    sub: [
      { href: "/blog", label: "지원금 안내" },
      { href: "/story", label: "블로그" },
      { href: "/blog/income", label: "소득 기준 계산기" },
      { href: "/free", label: "무료 서비스" },
      { href: "/about", label: "소개" },
    ],
  },
];

/** 주소가 이 항목(또는 그 아래)인가. "/" 는 첫 화면만, "/#areas" 는 match 로만. */
function hit(path: string | null, leaf: Leaf): boolean {
  if (!path) return false;
  const base = leaf.href.split("?")[0].split("#")[0];
  if (leaf.match?.some((m) => path === m.replace(/\/$/, "") || path.startsWith(m))) return true;
  if (leaf.href.includes("#")) return false;
  if (base === "/") return path === "/";
  return path === base || path.startsWith(base + "/");
}

/** 관리자 화면은 내부용이다. 방문자용 머리말·꼬리말을 달지 않는다. */
function useIsAdmin() {
  const path = usePathname();
  return path?.startsWith("/admin") ?? false;
}

export function SiteHeader({ index = {} }: { index?: Record<string, { sido: string; full: string }> }) {
  const path = usePathname();
  if (path?.startsWith("/admin")) return null;
  // 지금 들어와 있는 묶음. 그 묶음의 갈래 줄을 아래에 한 줄 더 편다.
  // 하위 항목 가운데 가장 긴 주소가 맞는 것을 켠다 — /blog/income 은 "소득
  // 기준 계산기"이고 "지원금 안내"(/blog)가 아니다.
  const open = NAV.find((n) => hit(path, n) || n.sub?.some((t) => hit(path, t)));
  const leaf = open?.sub
    ?.filter((t) => hit(path, t))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <header data-site-header className="pb-2 pt-4">
      <HeaderFx />
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <BrandMark className="h-7 w-7" />
          <span className="display text-[1.5rem] text-deep">나라지원</span>
          <span className="hidden text-xs text-muted lg:inline">
            나라에서 주는 지원, 받을 수 있는 지원
          </span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <TopSearch index={index} />
          <BigText />
        </div>
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
            aria-current={open ? (open.href === n.href ? "page" : undefined) : hit(path, n) ? "page" : undefined}
            className="shrink-0 px-3 py-2.5 font-semibold transition-colors"
          >
            {n.label}
          </Link>
        ))}
      </nav>

      {open?.sub && (
        <nav
          aria-label={`${open.label} 하위 메뉴`}
          className="-mx-5 flex gap-1 overflow-x-auto border-b border-line px-3 pb-1 pt-2
                     text-[13px] [scrollbar-width:none] sm:mx-0 [&::-webkit-scrollbar]:hidden"
        >
          {open.sub!.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={leaf === t ? "page" : undefined}
              className={`shrink-0 rounded-pill px-3 py-1.5 font-semibold transition-colors ${
                leaf === t
                  ? "bg-brandSoft text-brand"
                  : "text-muted hover:bg-ground hover:text-brand"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  if (useIsAdmin()) return null;
  const cols: { h: string; items: [string, string][] }[] = [
    { h: "찾기", items: [["통합 검색", "/search"], ["정책지도", "/map"], ["내 조건으로 찾기", "/"], ["기업·창업 지원", "/business"], ["분야별", "/topic"], ["지역별", "/#areas"], ["정책 전체", "/policies"]] },
    { h: "정보", items: [["공공기관 채용", "/jobs"], ["지역별 채용", "/jobs/region"], ["기관별 채용 이력", "/jobs/org"], ["자격증·시험 일정", "/license"], ["생활금융 금리", "/money"], ["주거 지원", "/housing"], ["공공기관 사업", "/agency"]] },
    { h: "읽을거리", items: [["지원금 안내 글", "/blog"], ["블로그", "/story"], ["소득 기준 계산기", "/blog/income"], ["무료 서비스", "/free"], ["서비스 소개", "/about"], ["개인정보 처리방침", "/privacy"]] },
  ];
  const sources: [string, string][] = [
    ["복지로", "https://www.bokjiro.go.kr"], ["기업마당", "https://www.bizinfo.go.kr"],
    ["소상공인24", "https://www.sbiz24.kr"], ["나라일터", "https://www.gojobs.go.kr"], ["월드잡플러스", "https://www.worldjob.or.kr"],
    ["큐넷", "https://www.q-net.or.kr"], ["주택금융공사", "https://www.hf.go.kr"],
    ["한국장학재단", "https://www.kosaf.go.kr"], ["알리오 플러스", "https://www.alioplus.go.kr"],
    ["공공데이터포털", "https://www.data.go.kr"],
  ];
  return (
    <footer className="band-deep -mx-5 mt-24 px-6 pb-8 pt-12 text-[13px] text-white/70 sm:mx-0 sm:rounded-t-card sm:px-10">
      <div className="grid gap-8 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2"><BrandMark className="h-6 w-6" /><span className="display text-[1.35rem] text-white">나라지원</span></p>
          <p className="mt-3 max-w-[22rem] leading-relaxed">
            모르고 지나칠 정부 지원 혜택을 찾는 서비스입니다. 복지로와 기업마당이 공공데이터포털에
            개방한 자료를 매일 새벽 색인합니다.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.h}>
            <p className="eyebrow !text-[#C4B5FD]">{c.h}</p>
            <ul className="mt-2 space-y-0.5">
              {c.items.map(([label, href]) => (
                <li key={href}><Link href={href} className="inline-block py-1.5 hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-10 border-t border-white/10 pt-5 text-[12px] leading-relaxed text-white/50">
        화면의 조건은 공고 원문에서 자동으로 추려낸 것이라 실제와 다를 수 있습니다. 신청 자격의 최종
        확인과 접수는 원문 또는 관할 주민센터를 통해 하시기 바랍니다. 정부 공식 서비스가 아닙니다.
      </p>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 text-[12px] text-white/45">
        <span className="font-bold text-white/60">자료 출처</span>
        {sources.map(([name, href]) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="inline-block py-1.5 hover:text-white">{name}</a>
        ))}
      </p>
    </footer>
  );
}
