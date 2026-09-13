/**
 * 같이 운영하는 무료 서비스 목록.
 *
 * 화면 곳곳에 배너로 한두 개씩만 흘려 보여 주고 있어서, 무엇이 있는지
 * 통째로 볼 데가 없었다. 여기 한자리에 모은다. 배너(lib/promo.ts)는
 * 문맥에 맞는 것 하나를 고르는 일을 하고, 이 목록은 전부를 보여 준다.
 *
 * 전부 무료이고 회원가입이 없다. 그게 아닌 것은 여기 넣지 않는다.
 */

export type FreeGroup = {
  key: string;
  tag: string;
  title: string;
  lead: string;
  items: { href: string; title: string; desc: string; slug: string }[];
};

const PSY = "https://jeepedia.com/psychology-test/";

export const FREE_GROUPS: FreeGroup[] = [
  {
    key: "psy",
    tag: "심리",
    title: "심리 테스트",
    lead:
      "공개된 심리 척도를 그대로 쓴 자가진단과, 30초짜리 가벼운 성향 테스트입니다. " +
      "결과는 브라우저에서 계산하고 어디에도 보내지 않습니다. 진단이 아니라 " +
      "나를 한 번 돌아보는 용도로 쓰세요.",
    items: [
      { href: `${PSY}sixteen-types/`, title: "16가지 성향 테스트",
        desc: "3분. 공개 척도로 보는 나의 유형", slug: "psy-16types" },
      { href: `${PSY}big-five-personality-workplace-job-satisfaction/`, title: "직장인 성격 유형 테스트",
        desc: "빅파이브로 보는, 나와 맞는 일", slug: "psy-workplace" },
      { href: `${PSY}burnout/`, title: "번아웃 자가진단",
        desc: "표준 척도 16문항, 2분", slug: "psy-burnout" },
      { href: `${PSY}rank-work/`, title: "업무 스타일 테스트",
        desc: "일할 때 무엇을 먼저 보나, 그림 5장", slug: "psy-work" },
      { href: `${PSY}rank-money/`, title: "소비 습관 테스트",
        desc: "즉시형인지 저축형인지, 30초", slug: "psy-money" },
      { href: `${PSY}rank-move/`, title: "집 고르는 순서로 보는 가치관",
        desc: "역세권·조망·보안, 무엇이 먼저인가", slug: "psy-move" },
      { href: `${PSY}rank-sleep/`, title: "수면 성향 테스트",
        desc: "잠들기 전 루틴으로 보는 나의 잠", slug: "psy-sleep" },
      { href: `${PSY}rank-conflict/`, title: "갈등 대처 유형 테스트",
        desc: "다툴 때 피하는지 맞서는지", slug: "psy-conflict" },
      { href: `${PSY}rank-cafe/`, title: "카페 자리로 보는 내향·외향",
        desc: "어디 앉는지로 보는 성향, 30초", slug: "psy-cafe" },
      { href: `${PSY}effects/`, title: "마케팅이 쓰는 심리 효과 20가지",
        desc: "앵커링·희소성·넛지, 뜻과 한국 사례", slug: "psy-effects" },
    ],
  },
  {
    key: "english",
    tag: "영어",
    title: "영어 공부",
    lead:
      "문법을 처음부터 순서대로 볼 수 있게 짜 둔 커리큘럼입니다. 어디까지 봤는지 " +
      "기억할 필요 없이 목차를 따라가면 됩니다. 결제도 로그인도 없습니다.",
    items: [
      { href: "https://knowhow-it.com/english-grammar-curriculum/", title: "영어 문법 커리큘럼",
        desc: "처음부터 순서대로 보는 문법 전체", slug: "english" },
    ],
  },
  {
    key: "marketing",
    tag: "마케팅",
    title: "마케팅·데이터",
    lead:
      "일하다 마주치는 마케팅·데이터 용어를 찾아보는 곳입니다. 뜻만 적어 두지 않고 " +
      "언제 쓰는 말인지까지 적었습니다.",
    items: [
      { href: "https://knowhow-it.com/data-market/", title: "데이터·마케팅 용어 사전",
        desc: "용어를 한자리에, 쓰이는 맥락까지", slug: "marketing" },
    ],
  },
];

/** utm 을 붙여 어느 화면에서 넘어갔는지 나눠 본다. */
export function withUtm(href: string, slug: string) {
  const u = new URL(href);
  u.searchParams.set("utm_source", "jiwon");
  u.searchParams.set("utm_medium", "free");
  u.searchParams.set("utm_content", slug);
  return u.toString();
}
