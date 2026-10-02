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
