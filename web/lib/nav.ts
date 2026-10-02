/**
 * 사이트의 갈래(주 메뉴)와 첫 화면 바로가기. 머리말·아래 탭 막대·전체 메뉴·꼬리말이
 * 같은 목록을 쓴다. 클라이언트·서버 어디서 불러도 되는 순수 자료다.
 *
 * match 는 그 묶음으로 치는 주소 앞머리. /p/… (공고 하나), /area/… (지역)
 * 처럼 메뉴에 직접 없는 쪽도 제 묶음이 켜지게.
 */
/**
 * 본문 기둥 폭. 머리말·꼬리말은 화면 폭 전체 띠이고 안쪽만 이 폭에 맞춘다.
 * (클라이언트 모듈에서 내보내면 서버 컴포넌트에서는 문자열이 아니라 참조가 되므로 여기 둔다.)
 */
export const WRAP = "mx-auto max-w-[54rem] px-5 lg:max-w-[64rem]";

export type Leaf = { href: string; label: string; match?: string[] };
export type NavItem = Leaf & { sub?: Leaf[] };

export const NAV: NavItem[] = [
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
export function hit(path: string | null, leaf: Leaf): boolean {
  if (!path) return false;
  const base = leaf.href.split("?")[0].split("#")[0];
  if (leaf.match?.some((m) => path === m.replace(/\/$/, "") || path.startsWith(m))) return true;
  if (leaf.href.includes("#")) return false;
  if (base === "/") return path === "/";
  return path === base || path.startsWith(base + "/");
}

/** 지금 주소가 든 묶음과, 그 안에서 켤 하위 항목(가장 긴 주소가 맞는 것). */
export function current(path: string | null): { open?: NavItem; leaf?: Leaf } {
  const open = NAV.find((n) => hit(path, n) || n.sub?.some((t) => hit(path, t)));
  const leaf = open?.sub?.filter((t) => hit(path, t)).sort((a, b) => b.href.length - a.href.length)[0];
  return { open, leaf };
}

/**
 * 첫 화면 바로가기 열 칸. 네이버 첫 화면의 서비스 아이콘 줄 자리다.
 * 갈래마다 색이 다르다(tailwind cat.*). 클래스는 퍼지(purge)가 읽을 수 있게 통째로 적는다.
 */
export type Shortcut = { href: string; label: string; icon: string; tone: string };
export const SHORTCUTS: Shortcut[] = [
  { href: "/#find", label: "내 조건 찾기", icon: "find", tone: "bg-cat-greenSoft text-cat-green" },
  { href: "/map", label: "정책지도", icon: "map", tone: "bg-cat-redSoft text-cat-red" },
  { href: "/business", label: "기업·창업", icon: "biz", tone: "bg-cat-violetSoft text-cat-violet" },
  { href: "/jobs", label: "채용", icon: "jobs", tone: "bg-cat-blueSoft text-cat-blue" },
  { href: "/license", label: "자격증", icon: "license", tone: "bg-cat-orangeSoft text-cat-orange" },
  { href: "/license/schedule", label: "시험 일정", icon: "calendar", tone: "bg-cat-amberSoft text-cat-amber" },
  { href: "/housing", label: "주거 지원", icon: "home", tone: "bg-cat-limeSoft text-cat-lime" },
  { href: "/money", label: "생활금융", icon: "money", tone: "bg-cat-cyanSoft text-cat-cyan" },
  { href: "/agency", label: "공공기관", icon: "agency", tone: "bg-cat-indigoSoft text-cat-indigo" },
  { href: "/blog", label: "읽을거리", icon: "read", tone: "bg-cat-pinkSoft text-cat-pink" },
];
