/**
 * 주거 지원 목차 — 대상(신혼부부·청년·무주택) × 종류(전세·월세·매매) × 시·도.
 *
 * "경기도 신혼부부 월세 지원", "신혼부부 매매 대출" 처럼 사람들이 실제로
 * 치는 검색어 하나에 쪽 하나가 대응하도록 만든다. 쪽의 알맹이는 두 가지다.
 *  1) 정부(주택도시기금) 상품 — 조건이 안정적이라 글로 적는다. 금리처럼 자주
 *     바뀌는 값은 범위와 확인 날짜만 적고 원문으로 보낸다.
 *  2) 지자체 사업 — DB 에서 낱말 검색(match_welfare + q)으로 매일 새로 채운다.
 */

import { db, matchWelfare, type Program } from "./db";

export type KindKey = "jeonse" | "wolse" | "buy";
export type WhoKey = "newlywed" | "youth" | "nohouse";

export const KINDS: Record<KindKey, { label: string; title: string; q: string; noun: string }> = {
  jeonse: { label: "전세", title: "전세자금 대출이자 지원", q: "전세", noun: "전세 보증금·대출이자" },
  wolse: { label: "월세", title: "월세·주거비 지원", q: "월세", noun: "월세·주거비" },
  buy: { label: "매매", title: "주택 구입(매매) 대출·지원", q: "매매", noun: "주택 구입 자금" },
};

export const WHO: Record<WhoKey, { label: string; q: string; desc: string }> = {
  newlywed: { label: "신혼부부", q: "신혼부부", desc: "혼인 7년 이내 또는 3개월 안에 결혼 예정인 가구" },
  youth: { label: "청년", q: "청년", desc: "만 19~34세(지자체에 따라 39세까지)" },
  nohouse: { label: "무주택", q: "무주택", desc: "세대원 전원이 집이 없는 가구" },
};

export const KIND_KEYS = Object.keys(KINDS) as KindKey[];
export const WHO_KEYS = Object.keys(WHO) as WhoKey[];

export const isKind = (v: string): v is KindKey => v in KINDS;
export const isWho = (v: string): v is WhoKey => v in WHO;

/** 주소에 쓰는 시·도 이름은 정식 명칭 그대로. 화면에는 짧게. */
export const shortSido = (s: string) =>
  s.replace(/(특별자치도|특별자치시|광역시|특별시|통합특별시)$/, "").replace(/도$/, (m) => (s.length > 3 ? "" : m));

export const CHECKED = "2026-09-29";

type Gov = {
  name: string;
  who: string;
  what: string;
  cond: string[];
  href: string;
  note?: string;
};

/**
 * 정부 상품. 숫자는 2026-09-29 에 주택도시기금·마이홈 안내와 은행 안내를
 * 맞춰 본 것이다. 금리와 최대 한도는 정부 대책으로 바뀌므로 범위만 적는다.
 */
const GOV: Record<`${KindKey}-${WhoKey}`, Gov[]> = {
  "jeonse-newlywed": [
    {
      name: "신혼부부전용 버팀목 전세자금대출 (주택도시기금)",
      who: "혼인 7년 이내 또는 3개월 안에 결혼 예정, 부부합산 연소득 7,500만원 이하, 무주택 세대주",
      what: "임차보증금의 80% 안에서 수도권 최대 3억원·그 외 2억원. 금리는 소득과 보증금에 따라 연 1%대~2%대.",
      cond: ["보증금 수도권 4억원·그 외 3억원 이하", "전용면적 85㎡ 이하", "부부합산 순자산 기준 있음"],
      href: "https://www.myhome.go.kr/hws/portal/cont/selectYouthPolicyHoneyMoonLoanView.do",
    },
  ],
  "jeonse-youth": [
    {
      name: "청년전용 버팀목 전세자금대출 (주택도시기금)",
      who: "만 19~34세 무주택 세대주, 부부합산 연소득 5,000만원 이하, 순자산 3.45억원 이하",
      what: "임차보증금의 80% 안에서 대출. 최대 한도는 정부 대책에 따라 1.5억~2억원 사이에서 조정되어 왔으니 신청 시점에 확인.",
      cond: ["보증금 3억원 이하", "전용면적 85㎡ 이하", "금리 연 1%대~2%대"],
      href: "https://www.myhome.go.kr/hws/portal/cont/selectYouthPolicyYouthOnlyCrutchLoanView.do",
    },
  ],
  "jeonse-nohouse": [
    {
      name: "버팀목 전세자금대출 (주택도시기금)",
      who: "무주택 세대주, 부부합산 연소득 5,000만원 이하(신혼·2자녀 이상은 더 높음)",
      what: "임차보증금의 70~80% 안에서 대출. 신혼부부·청년·신생아 가구는 각각 전용 상품이 조건이 더 낫다.",
      cond: ["보증금 수도권 3억원·그 외 2억원 이하(가구 유형별 상이)", "전용면적 85㎡ 이하"],
      href: "https://www.myhome.go.kr/hws/portal/cont/selectYouthPolicyHoneyMoonLoanView.do",
    },
  ],
  "wolse-newlywed": [
    {
      name: "주거급여 (기초생활보장)",
      who: "소득인정액이 기준 중위소득 48% 이하인 가구. 신혼부부라는 이유로 따로 주는 국가 월세 지원은 없다.",
      what: "지역·가구원 수별 기준임대료 안에서 실제 월세를 지원.",
      cond: ["복지로 또는 주민센터 신청", "신혼부부 월세는 지자체 사업이 중심 — 아래 목록"],
      href: "https://www.bokjiro.go.kr",
    },
  ],
  "wolse-youth": [
    {
      name: "청년월세지원 (국토교통부, 2026년부터 상시)",
      who: "만 19~34세, 부모와 따로 사는 무주택 청년. 청년가구 소득 기준 중위소득 60% 이하이고 원가구 100% 이하.",
      what: "실제 내는 월세를 월 최대 20만원, 최대 24개월(480만원) 지원. 생애 1회.",
      cond: ["보증금 5천만원 이하·월세 70만원 이하 주택", "복지로 온라인 또는 주민센터 신청", "주거급여 수급자는 월차임분 차감"],
      href: "https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId=WLF00004661",
    },
  ],
  "wolse-nohouse": [
    {
      name: "주거급여 (기초생활보장)",
      who: "소득인정액이 기준 중위소득 48% 이하인 무주택 가구.",
      what: "지역·가구원 수별 기준임대료 안에서 실제 월세를 지원. 자가 가구는 수선비.",
      cond: ["복지로 또는 주민센터 신청", "부양의무자 기준 없음"],
      href: "https://www.bokjiro.go.kr",
    },
  ],
  "buy-newlywed": [
    {
      name: "신혼부부전용 주택구입자금대출 (디딤돌, 주택도시기금)",
      who: "혼인 7년 이내 또는 3개월 안에 결혼 예정, 부부합산 연소득 8,500만원 이하, 순자산 5.11억원 이하, 무주택 세대주",
      what: "집값의 일정 비율(LTV 70%, 생애최초 80%) 안에서 대출. 금리는 소득·만기에 따라 연 2%대 중반부터.",
      cond: ["주택 평가액 6억원 이하", "전용면적 85㎡ 이하", "실거주 요건"],
      href: "https://www.myhome.go.kr/hws/portal/cont/selectSteppingStoneLoanView.do",
    },
    {
      name: "신생아 특례 디딤돌대출 (주택도시기금)",
      who: "대출 접수일 기준 2년 안에 출산·입양한 가구(2023년 이후 출생), 부부합산 연소득 1.3억원 이하(맞벌이 2억원)",
      what: "최대 4억원. 특례금리 연 1.8%~4.5%(2026년 8월 기준) 5년, 추가 출산 시 5년씩 연장.",
      cond: ["주택 가격 9억원 이하", "전용면적 85㎡ 이하", "소득 8,500만원 초과 시 금리 가산"],
      href: "https://www.myhome.go.kr/hws/portal/cont/selectBabySpecialCaseStepStoneLoneView.do",
    },
  ],
  "buy-youth": [
    {
      name: "내집마련 디딤돌대출 (주택도시기금)",
      who: "무주택 세대주. 부부합산 연소득 6,000만원 이하(생애최초 7,000만원, 신혼 8,500만원), 순자산 5.11억원 이하",
      what: "호당 최대 2.5억원(생애최초·신혼은 더 높음). 금리 연 2%대~3%대, 만기 10~30년.",
      cond: ["주택 평가액 5억원 이하(신혼·2자녀 6억원)", "전용면적 85㎡ 이하", "LTV 70%, 생애최초 80%"],
      href: "https://www.myhome.go.kr/hws/portal/cont/selectSteppingStoneLoanView.do",
      note: "청년만을 위한 구입자금 상품은 따로 없다. 소득이 낮은 초년생에게는 디딤돌 일반·생애최초 조건이 곧 청년 조건이다.",
    },
  ],
  "buy-nohouse": [
    {
      name: "내집마련 디딤돌대출 (주택도시기금)",
      who: "무주택 세대주. 부부합산 연소득 6,000만원 이하(생애최초 7,000만원, 신혼 8,500만원), 순자산 5.11억원 이하",
      what: "호당 최대 2.5억원(생애최초·신혼은 더 높음). 금리 연 2%대~3%대, 만기 10~30년.",
      cond: ["주택 평가액 5억원 이하(신혼·2자녀 6억원)", "전용면적 85㎡ 이하", "LTV 70%, 생애최초 80%"],
      href: "https://www.myhome.go.kr/hws/portal/cont/selectSteppingStoneLoanView.do",
    },
    {
      name: "보금자리론 (한국주택금융공사)",
      who: "소득 기준이 디딤돌보다 넓다(부부합산 7,000만원, 신혼·다자녀 등 우대 시 더 높음).",
      what: "주택 가격 6억원 이하, 최대 3.6억원(우대 시 4억원 대). 고정금리라 이자 변동이 없다.",
      cond: ["디딤돌이 안 되는 소득 구간의 다음 선택지", "은행 창구 또는 공사 누리집 신청"],
      href: "https://www.hf.go.kr/ko/sub01/sub01_01_01.do",
    },
  ],
};

export const govFor = (kind: KindKey, who: WhoKey) => GOV[`${kind}-${who}`];

export type Count = { who: WhoKey; kind: KindKey; sido: string | null; n: number };

/** 대상 × 종류 × 시·도 건수. 목차와 사이트맵이 쓴다. */
export async function housingCounts(): Promise<Count[]> {
  const { data, error } = await db.rpc("housing_counts");
  if (error) throw error;
  return (data ?? []) as Count[];
}

export function countOf(counts: Count[], kind: KindKey, who: WhoKey, sido?: string | null) {
  return counts
    .filter((c) => c.kind === kind && c.who === who && (sido === undefined ? true : (c.sido ?? null) === (sido ?? null)))
    .reduce((s, c) => s + Number(c.n), 0);
}

/** 이 시·도에 사는 사람이 볼 것: 그 시·도 사업 + 전국 사업. */
export function countFor(counts: Count[], kind: KindKey, who: WhoKey, sido: string) {
  return countOf(counts, kind, who, sido) + countOf(counts, kind, who, null);
}

/** 시·도별 건수(전국 제외), 많은 곳부터. 사이트맵은 이 중 3건 이상만 올린다. */
export function sidosFor(counts: Count[], kind: KindKey, who: WhoKey, min = 1) {
  return counts
    .filter((c) => c.kind === kind && c.who === who && c.sido && Number(c.n) >= min)
    .sort((a, b) => Number(b.n) - Number(a.n))
    .map((c) => ({ sido: c.sido as string, n: Number(c.n) }));
}

export async function housingList(kind: KindKey, who: WhoKey, sido?: string): Promise<Program[]> {
  return matchWelfare({ sido, q: `${WHO[who].q} ${KINDS[kind].q}` }, 60);
}

export const housingPath = (kind: KindKey, who: WhoKey, sido?: string) =>
  `/housing/${kind}/${who}${sido ? `/${encodeURIComponent(sido)}` : ""}`;

export const findPath = (kind: KindKey, who: WhoKey, sido?: string) => {
  const sp = new URLSearchParams();
  if (sido) sp.set("sido", sido);
  sp.set("q", `${WHO[who].q} ${KINDS[kind].q}`);
  sp.set("via", "housing");
  return `/?${sp}`;
};

/** 제목. 검색어 순서(지역 → 대상 → 종류)를 그대로 따른다. */
export function housingTitle(kind: KindKey, who: WhoKey, sido: string | undefined, n: number) {
  const head = `${sido ? `${sido} ` : ""}${WHO[who].label} ${KINDS[kind].title}`;
  // 0건이면 숫자를 적지 않는다. "0건" 이 제목에 박히면 검색 결과에서 눌리지 않는다.
  const tail = sido
    ? (n > 0 ? `시·군 사업 ${n}건과 정부 대출` : "정부 대출과 시·군 사업")
    : (n > 0 ? `정부 대출과 지자체 사업 ${n}건` : "정부 대출과 지자체 사업");
  return `${head} — ${tail}`;
}

export function housingFaq(kind: KindKey, who: WhoKey, sido?: string) {
  const w = WHO[who].label, k = KINDS[kind];
  const where = sido ?? "우리 지역";
  const out = [
    {
      q: `${where} ${w} ${k.label} 지원은 어디서 신청하나요?`,
      a: kind === "buy" || kind === "jeonse"
        ? "주택도시기금 대출은 기금e든든(은행 방문 또는 온라인)에서, 지자체 이자지원은 시·군·구 누리집이나 주민센터 공고로 신청합니다. 대출을 먼저 받고 이자지원을 신청하는 순서가 보통입니다."
        : "국가 사업(청년월세지원·주거급여)은 복지로 온라인이나 주민센터에서, 지자체 월세 지원은 시·군·구 공고로 신청합니다. 같은 이름이라도 지자체마다 조건과 접수 기간이 다릅니다.",
    },
    {
      q: `정부 대출과 지자체 지원을 같이 받을 수 있나요?`,
      a: "대개 가능합니다. 지자체 이자지원 사업의 상당수가 '주택도시기금·은행 대출을 받은 사람'을 대상으로 이자의 일부를 대신 내주는 구조입니다. 다만 같은 목적의 현금 지원끼리는 중복이 제한되니 공고의 '중복 지원' 항목을 보세요.",
    },
    {
      q: `${w} 기준은 무엇으로 보나요?`,
      a: who === "newlywed"
        ? "혼인관계증명서상 혼인 기간 7년 이내가 기본이고, 3개월 안에 결혼 예정인 예비부부를 포함하는 곳이 많습니다. 지자체 사업은 '공고일 기준 혼인 5년 이내'처럼 더 좁게 잡기도 합니다."
        : who === "youth"
          ? "만 19세부터 34세까지가 국가 기준입니다. 지자체는 39세까지 넓히는 곳이 많고, 병역 기간을 빼 주는 곳도 있습니다. 공고문의 나이 기준을 먼저 보세요."
          : "세대주와 세대원 전원이 주택을 소유하지 않아야 합니다. 분양권·입주권도 주택으로 보는 사업이 있으니 확인이 필요합니다.",
    },
  ];
  if (sido)
    out.push({
      q: `${sido} 안에서도 시·군마다 다른가요?`,
      a: `다릅니다. ${sido} 광역 사업과 시·군 자체 사업이 따로 있고, 시·군 사업은 그 지역에 주소를 둔 사람만 대상입니다. 아래 목록에서 시·군 이름을 보고 우리 동네 것을 고르세요.`,
    });
  return out;
}
