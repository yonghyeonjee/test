/**
 * 바깥 자료(같이 운영하는 사이트) 추천 목록.
 *
 * 화면마다 같은 세 개를 보여 주면 아무도 안 누른다. 보고 있던 것과
 * 이어지는 것을 고른다 — 기업 지원을 보던 사람에게는 직장 테스트를,
 * 전세 금리를 보던 사람에게는 집 고르는 가치관 테스트를.
 *
 * 취약계층(저소득·장애인 등)을 우울·불안 자가진단으로 보내지 않는다.
 * 그런 짝짓기는 도움이 아니라 낙인이다. 그 경우는 일반 목록을 쓴다.
 */

export type PromoLink = {
  href: string;
  tag: string;
  title: string;
  desc: string;
  /** utm_content. 어느 링크가 먹히는지 나눠 보려고. */
  slug: string;
};

export type PromoContext =
  | "general"   // 특정할 게 없을 때
  | "business"  // 사업주·기업 지원
  | "job"       // 구직·취업 준비·자격증
  | "worker"    // 재직자
  | "student"   // 학생·학자금
  | "youth"     // 청년
  | "housing"   // 주거·전세·지역
  | "money"     // 생활비·소비
  | "senior"    // 어르신·퇴직
  | "family"    // 임신·출산·육아·다자녀
  | "solo";     // 1인가구

const PSY = "https://jeepedia.com/psychology-test/";

const ENGLISH: PromoLink = {
  href: "https://knowhow-it.com/english-grammar-curriculum/",
  tag: "영어", title: "무료 영어 공부",
  desc: "문법 커리큘럼을 처음부터 순서대로", slug: "english",
};
const MARKETING: PromoLink = {
  href: "https://knowhow-it.com/data-market/",
  tag: "마케팅", title: "무료 마케팅 용어",
  desc: "데이터·마케팅 용어를 한자리에", slug: "marketing",
};
const EFFECTS: PromoLink = {
  href: `${PSY}effects/`,
  tag: "심리", title: "마케팅이 쓰는 심리 효과 20가지",
  desc: "앵커링·희소성·넛지, 뜻과 한국 사례", slug: "psy-effects",
};

/** 문맥별 심리테스트 한 개. */
const TEST: Record<PromoContext, PromoLink> = {
  general: {
    href: `${PSY}sixteen-types/`, tag: "심리", title: "16가지 성향 테스트",
    desc: "3분, 공개 척도로 보는 나의 유형", slug: "psy-16types",
  },
  business: {
    href: `${PSY}rank-work/`, tag: "심리", title: "업무 스타일 테스트",
    desc: "일할 때 나의 우선순위, 그림 5장 30초", slug: "psy-work",
  },
  job: {
    href: `${PSY}big-five-personality-workplace-job-satisfaction/`,
    tag: "심리", title: "직장인 성격 유형 테스트",
    desc: "어떤 일이 나와 맞는지, 빅파이브로", slug: "psy-workplace",
  },
  worker: {
    href: `${PSY}burnout/`, tag: "심리", title: "번아웃 자가진단",
    desc: "표준 척도 16문항, 2분", slug: "psy-burnout",
  },
  student: {
    href: `${PSY}rank-money/`, tag: "심리", title: "소비 습관 테스트",
    desc: "나는 즉시형인지 저축형인지, 30초", slug: "psy-money",
  },
  youth: {
    href: `${PSY}sixteen-types/`, tag: "심리", title: "16가지 성향 테스트",
    desc: "3분, 공개 척도로 보는 나의 유형", slug: "psy-16types",
  },
  housing: {
    href: `${PSY}rank-move/`, tag: "심리", title: "집 고르는 순서로 보는 가치관",
    desc: "역세권·조망·보안, 무엇을 먼저 보나", slug: "psy-move",
  },
  money: {
    href: `${PSY}rank-money/`, tag: "심리", title: "소비 습관 테스트",
    desc: "나는 즉시형인지 저축형인지, 30초", slug: "psy-money",
  },
  senior: {
    href: `${PSY}rank-sleep/`, tag: "심리", title: "수면 성향 테스트",
    desc: "잠들기 전 루틴으로 보는 나의 잠", slug: "psy-sleep",
  },
  family: {
    href: `${PSY}rank-conflict/`, tag: "심리", title: "갈등 대처 유형 테스트",
    desc: "다툴 때 피하는지 맞서는지, 30초", slug: "psy-conflict",
  },
  solo: {
    href: `${PSY}rank-cafe/`, tag: "심리", title: "카페 자리로 보는 내향·외향",
    desc: "어디 앉는지로 성향을 봅니다, 30초", slug: "psy-cafe",
  },
};

/** 문맥에 맞는 세 개. 심리 → 배움 → 마케팅 순서는 어디서나 같다. */
export function promoLinks(ctx: PromoContext = "general"): PromoLink[] {
  const test = TEST[ctx] ?? TEST.general;
  // 사업하는 분에게 영어 문법보다는 소비자 심리가 이어진다.
  const second = ctx === "business" ? EFFECTS : ENGLISH;
  return [test, second, MARKETING];
}

/**
 * 조회 조건에서 문맥을 고른다. 취업 상태가 가장 뚜렷한 단서라 먼저 보고,
 * 그다음 가구 사정, 나이 순. 저소득·장애인·보훈은 일부러 보지 않는다.
 */
export function promoContextFor(q: {
  tab?: "welfare" | "business";
  employment?: string;
  household?: string[];
  age?: number;
}): PromoContext {
  if (q.tab === "business") return "business";
  switch (q.employment) {
    case "재직": return "worker";
    case "구직중": case "미취업": return "job";
    case "학생": return "student";
    case "자영업": return "business";
    case "퇴직": return "senior";
  }
  const hh = q.household ?? [];
  if (hh.includes("무주택")) return "housing";
  if (hh.includes("1인가구")) return "solo";
  if (hh.some((h) => h === "임산부" || h === "다자녀" || h === "한부모·조손")) return "family";
  if (q.age !== undefined) {
    if (q.age >= 65) return "senior";
    if (q.age <= 34) return "youth";
  }
  return "general";
}

/** 복지 사업 한 건에서 문맥을 고른다. 상세 화면용. */
export function promoContextForProgram(p: {
  kind: string;
  employment?: string[] | null;
  household?: string[] | null;
  age_min?: number | null;
  age_max?: number | null;
  topics?: string[] | null;
}): PromoContext {
  if (p.kind === "business" || p.kind === "event") return "business";
  const emp = p.employment ?? [];
  if (emp.includes("재직")) return "worker";
  if (emp.includes("구직중") || emp.includes("미취업")) return "job";
  if (emp.includes("학생")) return "student";
  const hh = p.household ?? [];
  const topics = p.topics ?? [];
  if (hh.includes("무주택") || topics.includes("주거")) return "housing";
  if (hh.includes("1인가구")) return "solo";
  if (hh.includes("임산부") || hh.includes("다자녀") || topics.includes("임신·출산") || topics.includes("보육"))
    return "family";
  if (topics.includes("일자리")) return "job";
  if ((p.age_min ?? 0) >= 65) return "senior";
  if (p.age_max !== null && p.age_max !== undefined && p.age_max <= 39 && (p.age_min ?? 0) >= 18)
    return "youth";
  return "general";
}
