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

export function withOg(m: Metadata): Metadata {
  const t = m.title;
  const title = typeof t === "string" ? t : t && "absolute" in t ? t.absolute : undefined;
  const description = m.description ?? undefined;
  const canon = m.alternates?.canonical;
  const path = typeof canon === "string" ? canon : canon && "url" in canon ? String(canon.url) : undefined;
  const url = path ? (path.startsWith("http") ? path : `${SITE_URL}${path}`) : undefined;
  return {
    ...m,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "ko_KR",
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(url ? { url } : {}),
      ...(m.openGraph ?? {}),
    },
    twitter: {
      card: "summary_large_image",
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(m.twitter ?? {}),
    },
  };
}
