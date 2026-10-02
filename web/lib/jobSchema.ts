import type { Job } from "./pubJobs";
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
  const region = job.region || sidoFromOrg(job.org);
  if (region) address.addressRegion = region;
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
