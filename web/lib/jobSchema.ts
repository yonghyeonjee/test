import type { Job } from "./pubJobs";
import { locateJob } from "./geo";
import { SIDO_WORDS } from "./parse";

/**
 * 구글 채용 검색(JobPosting)에 넣을 근무지와 고용형태.
 *
 * Search Console 이 공고 19건을 "jobLocation 없음"으로 무효 처리했다. 중앙부처
 * 공고는 나라일터가 지역을 비워 보내서다. 지역이 없으면 기관 이름에서
 * 시·도를 읽고("부산광역시교육청", "경기광주우체국"), 그것도 없으면 나라만
 * 적는다 — 구글은 jobLocation 자체는 요구하지만 주소의 세부는 권장 사항이다.
 * 모르는 주소를 지어 넣지는 않는다.
 */
export function jobLocation(job: Job) {
  const address: Record<string, string> = { "@type": "PostalAddress", addressCountry: "KR" };
  // 지역 칸 → 기관 이름 → 공고 제목 → 시·군·구 사전(locateJob: "대전청사관리소" 같은 줄임 이름까지) 순으로.
  // Search Console 이 addressRegion 이 빠졌다고 알렸다(권장 항목). 끝까지 모르면 비워 둔다 — 지어 넣지 않는다.
  const place = locateJob({ org: job.org, title: job.title, region: job.region });
  const region = job.region || sidoFromOrg(job.org) || sidoFromOrg(job.title) || place?.sido || null;
  // 잡알리오는 해외 근무를 지역 "해외"로 적는다. 나라가 KR 로 박혀 있으니 시·도 칸에 넣지 않는다.
  if (region && region !== "해외") address.addressRegion = region;
  if (place?.sigungu && place.sido === region) address.addressLocality = place.sigungu;
  return { "@type": "Place", address };
}

/**
 * 시·도 이름이 없을 때 읽을 도시 이름. 광역시·특별시는 SIDO_WORDS 가 잡는다.
 * 기관 이름에 자주 나오는 것만 — "국립춘천병원", "수원지방검찰청 안양지청".
 */
const CITY: [RegExp, string][] = [
  [/수원|성남|고양|용인|안양|안산|과천|의정부|파주|김포|평택|화성|광명|부천|시흥|군포|하남|구리|남양주|오산|이천|여주|양평|포천|동두천|가평|연천|안성|양주/, "경기도"],
  [/춘천|원주|강릉|속초|동해|삼척|태백|홍천|횡성|영월|평창|정선|철원|화천|양구|인제|고성|양양/, "강원특별자치도"],
  [/청주|충주|제천|보은|옥천|영동|증평|진천|괴산|음성|단양/, "충청북도"],
  [/천안|공주|보령|아산|서산|논산|계룡|당진|금산|부여|서천|청양|홍성|예산|태안/, "충청남도"],
  [/전주|군산|익산|정읍|남원|김제|완주|진안|무주|장수|임실|순창|고창|부안/, "전북특별자치도"],
  [/목포|여수|순천|나주|광양|담양|곡성|구례|고흥|보성|화순|장흥|강진|해남|영암|무안|함평|영광|장성|완도|진도|신안/, "전라남도"],
  [/포항|경주|김천|안동|구미|영주|영천|상주|문경|경산|의성|청송|영양|영덕|청도|고령|성주|칠곡|예천|봉화|울진|울릉/, "경상북도"],
  [/창원|진주|통영|사천|김해|밀양|거제|양산|의령|함안|창녕|부곡|고성|남해|하동|산청|함양|거창|합천/, "경상남도"],
  [/서귀포/, "제주특별자치도"],
];

/** 기관 이름에 든 시·도. "경인지방우정청 경기광주우체국" → 경기도. */
export function sidoFromOrg(org: string | null): string | null {
  if (!org) return null;
  for (const [re, name] of SIDO_WORDS) if (re.test(org)) return name;
  for (const [re, name] of CITY) if (re.test(org)) return name;
  return null;
}

export type Employment = "FULL_TIME" | "PART_TIME" | "TEMPORARY" | "CONTRACTOR" | "INTERN";

/**
 * 공고 제목에 적힌 고용형태. 직무 사전(jobRole)이 못 알아본 공고의 뒷받침.
 * 순서가 중요하다 — "기간제 공무직" 은 기간제다.
 */
export function employmentFromTitle(title: string): Employment | null {
  if (/인턴|체험형/.test(title)) return "INTERN";
  if (/시간선택제|단시간|시간제|파트타임/.test(title)) return "PART_TIME";
  if (/기간제|한시|대체인력|대체\s*근로|임시/.test(title)) return "TEMPORARY";
  if (/임기제|(?<!무기)계약직|전문경력관|위촉/.test(title)) return "CONTRACTOR";
  if (/공무직|무기계약|정규직|경력경쟁|공개경쟁|일반직/.test(title)) return "FULL_TIME";
  return null;
}

/**
 * 공고 요약의 보수 문구를 구글 JobPosting 의 baseSalary(MonetaryAmount)로.
 *
 * 구글은 급여를 강하게 권하지만 틀린 값은 안 된다. 단위(시간·월·연)가 분명한 금액만 쓰고,
 * "공무원보수규정에 따름" 처럼 숫자가 없거나 단위를 알 수 없으면 null — 지어 넣지 않는다.
 * 식대·수당·상여금 같은 딸린 금액은 단위별 그럴듯한 범위로 걸러 낸다(월 16만 원 식대는 월급이 아니다).
 * 금액이 여럿이면(분야별·상한·하한) 가장 작은 것~큰 것 범위로.
 */
export type Salary = { "@type": "MonetaryAmount"; currency: "KRW"; value: Record<string, unknown> };
const UNIT_RANGE = { HOUR: [9_000, 300_000], MONTH: [1_000_000, 20_000_000], YEAR: [15_000_000, 300_000_000] } as const;
type PayUnit = keyof typeof UNIT_RANGE;

export function salaryFromPay(text: string | null | undefined): Salary | null {
  const t = (text ?? "").replace(/\s+/g, " ");
  if (!t) return null;
  const found: { unit: PayUnit; value: number }[] = [];
  const re = /(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(천원|만\s*원|만원|원)/g;
  for (const m of t.matchAll(re)) {
    const n = Number(m[1].replace(/,/g, ""));
    const mult = m[2].startsWith("천") ? 1_000 : m[2].startsWith("만") ? 10_000 : 1;
    const value = n * mult;
    const before = t.slice(Math.max(0, (m.index ?? 0) - 14), m.index);
    const after = t.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 4);
    // 금액 바로 앞에 딸린 금액 이름이 붙어 있으면 뺀다.
    if (/(식대|급식비|수당|상여금|보로금|휴가비|보조비|기술비|복지|여비)\s*:?\s*(월\s*)?$/.test(before)) continue;
    let unit: PayUnit | null = null;
    if (/(시간당|시급|강사료|시간\s*당)/.test(before) || /^\s*\/\s*(시간|h)/.test(after)) unit = "HOUR";
    else if (/(연봉|연\s|연간|한계액|하한액|상한액|하한|상한)/.test(before) || /^\s*\/\s*(년|연)/.test(after)) unit = "YEAR";
    else if (/(월급|매월|월\s|기본급|봉급기준액|월$)/.test(before) || /^\s*\/\s*월/.test(after) || /^\s*\(?\s*월/.test(after)) unit = "MONTH";
    else if (value >= UNIT_RANGE.YEAR[0]) unit = "YEAR";
    if (!unit) continue;
    const [lo, hi] = UNIT_RANGE[unit];
    if (value < lo || value > hi) continue;
    found.push({ unit, value });
  }
  if (!found.length) return null;
  const unit = found[0].unit;
  const vals = found.filter((f) => f.unit === unit).map((f) => f.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const value: Record<string, unknown> = { "@type": "QuantitativeValue", unitText: unit };
  if (min === max) value.value = min;
  else { value.minValue = min; value.maxValue = max; }
  return { "@type": "MonetaryAmount", currency: "KRW", value };
}
