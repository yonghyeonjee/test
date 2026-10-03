export const SITE_NAME = "나라지원";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://jiwon.knowhow-it.com";

/** 검색 결과에 그대로 노출되는 문장. 30자 안쪽으로 끊는다. */
export const t = (s: string) => `${s} | ${SITE_NAME}`;

export const YEAR = new Date().getFullYear();

/**
 * 우리 서비스의 차별점.
 * 보조금24는 로그인과 주민등록번호 연계가 필요하다.
 * 이 문장은 설명·본문 곳곳에서 반복해서 쓴다.
 */
export const HOOK = "회원가입도 주민등록번호도 없이";

/**
 * 사이트 이름과 갈래 이름을 조합한 검색어. "나라지원 채용", "나라지원 전세대출".
 * 이름을 아는 사람이 갈래 이름을 붙여 찾을 때 그 쪽이 걸리게 한다.
 */
export const brandKeys = (...words: string[]) =>
  [SITE_NAME, ...words.map((w) => `${SITE_NAME} ${w}`)];


import type { Metadata } from "next";

/**
 * 쪽 메타데이터에 Open Graph·트위터 카드를 채운다.
 *
 * 구글 SEO 시작 가이드는 쪽마다 고유한 title·description 을 요구한다. 그것은
 * 돼 있었는데, 공유 카드(og:title 등)는 layout 의 사이트 공통 값이 모든 쪽에
 * 그대로 나가고 있었다 — 카카오톡·페이스북에 어느 쪽을 보내도 같은 제목이
 * 떴다. 여기서 title·description·canonical 을 그대로 옮겨 적는다. 쪽이 따로
 * 준 openGraph 값이 있으면 그것이 이긴다.
 */
/** 공유 카드·Article 구조화 데이터에 쓰는 대표 이미지. app/opengraph-image.tsx 가 그린다. */
export const OG_IMAGE = `${SITE_URL}/opengraph-image`;

/** 주소로 갈래 이름. 공유 그림 왼쪽 위 딱지. */
function kindOf(path: string | undefined): string {
  const p = decodeURI(path ?? "").replace(/^https?:\/\/[^/]+/, "");
  if (p.startsWith("/jobs")) return "채용";
  if (p.startsWith("/business")) return "기업·소상공인";
  if (p.startsWith("/license")) return "자격증";
  if (p.startsWith("/map")) return "정책지도";
  if (p.startsWith("/agency")) return "공공기관 사업";
  if (p.startsWith("/p/")) return "지원사업";
  if (p.startsWith("/blog") || p.startsWith("/story")) return "안내 글";
  if (p.startsWith("/search")) return "검색";
  return "지원금";
}

/**
 * 쪽마다 다른 공유 그림(app/og). 제목에서 " | 나라지원" 을 떼고, " — " 뒤는 작은 줄로 내린다.
 * 작은 줄이 없으면 설명의 첫 마디.
 */
export function ogImageFor(title: string | undefined, description: string | undefined, path: string | undefined): string {
  const clean = (title ?? SITE_NAME).replace(/\s*\|\s*나라지원\s*$/, "").trim();
  const [head, ...rest] = clean.split(/\s+—\s+/);
  const sub = rest.join(" — ") || (description ?? "").split(/(?<=[.다])\s/)[0] || "";
  const q = new URLSearchParams({ k: kindOf(path), t: head.slice(0, 60), s: sub.slice(0, 60) });
  return `${SITE_URL}/og?${q}`;
}

export function withOg(m: Metadata): Metadata {
  const t = m.title;
  const title = typeof t === "string" ? t : t && "absolute" in t ? t.absolute : undefined;
  const description = m.description ?? undefined;
  const canon = m.alternates?.canonical;
  const path = typeof canon === "string" ? canon : canon && "url" in canon ? String(canon.url) : undefined;
  const url = path ? (path.startsWith("http") ? path : `${SITE_URL}${path}`) : undefined;
  // 첫 화면("/")은 사이트 그림 그대로. 나머지는 쪽 제목으로 그린 그림.
  const img = path && path !== "/" ? ogImageFor(title, description, path) : OG_IMAGE;
  return {
    ...m,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "ko_KR",
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(url ? { url } : {}),
      // app/opengraph-image.tsx 는 첫 화면에만 붙는다(2026-10 확인). 나머지 쪽은
      // 공유 카드에 그림이 없었다. 쪽이 따로 준 그림이 없으면 사이트 그림을 단다.
      // 첫 화면은 파일 기반 그림이 이것보다 우선해 그대로 간다.
      images: [{ url: img, width: 1200, height: 630, alt: title ?? SITE_NAME }],
      ...(m.openGraph ?? {}),
    },
    twitter: {
      card: "summary_large_image",
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      images: [img],
      ...(m.twitter ?? {}),
    },
  };
}
