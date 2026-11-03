import { getCoverage } from "@/lib/db";
import { getAlioCounts, getJobOverview } from "@/lib/pubJobs";

/**
 * 생성형 검색(ChatGPT·Perplexity 등)이 읽는 안내 파일. 2026-11-03 public/llms.txt 에서 옮겼다.
 * 고정 글은 그대로 두고, 그 아래 "오늘의 숫자"(접수 중 채용·기관 수·지원사업 수)를 매시간 새로 넣는다.
 * 인용하는 쪽이 날짜와 함께 숫자를 옮길 수 있게. 숫자를 못 읽으면 그 줄만 뺀다.
 */
export const revalidate = 3600;

const HEAD = `# K나라지원 (jiwon.knowhow-it.com)

> 대한민국 정부·지자체·공공기관의 지원사업(복지·청년·소상공인), 공공기관 채용 공고, 국가자격증 시험 일정, 주거 지원을
> 한곳에 모아 조건(사는 곳·나이·가구·업종)으로 걸러 보여 주는 무료 안내 사이트. 회원가입 없이 쓴다.
> 자료 출처: 복지로, 기업마당, 소상공인24, 인사혁신처 나라일터, 잡알리오, 한국산업인력공단 큐넷, 주택금융공사, 알리오 플러스.
> 매일 새벽 새로 모으며, 신청은 각 기관 원문 공고에서 한다. 접수 기간·자격 요건의 최종 확인은 원문에서 해야 한다.
`;

const REST = `## 허브
- [지원사업 전체](https://jiwon.knowhow-it.com/policies): 대상·분야·지역·업종별 정부 지원사업 목차와 이번 주 새 공고·마감 임박 공고
- [기업·소상공인 지원](https://jiwon.knowhow-it.com/business): 창업·소상공인·중소기업 지원사업
- [공공기관 채용](https://jiwon.knowhow-it.com/jobs): 나라일터·잡알리오 채용 공고, 지역·고용형태·기관별 목차, 이번 주 채용 흐름
- [지역별 채용](https://jiwon.knowhow-it.com/jobs/region): 시·도별 공공기관 채용 공고
- [기관별 채용 이력](https://jiwon.knowhow-it.com/jobs/org): 기관마다 얼마나 자주 뽑는지, 접수 기간은 며칠인지
- [국가자격증](https://jiwon.knowhow-it.com/license): 종목별 응시 자격·시험 일정, 응시료 지원 제도
- [자격시험 일정](https://jiwon.knowhow-it.com/license/schedule): 등급별 원서접수 기간과 시험일
- [주거 지원](https://jiwon.knowhow-it.com/housing): 대상×종류별 전세·월세·주택 지원
- [전세대출 금리 비교](https://jiwon.knowhow-it.com/money/jeonse): 주택금융공사 보증 은행별 전세대출 금리
- [공공기관 안내](https://jiwon.knowhow-it.com/orgs): 지정 공공기관 342곳의 소개·소재지·채용 이력
- [공공기관 사업·행사](https://jiwon.knowhow-it.com/agency): 공공기관이 직접 운영하는 사업과 행사
- [지도로 찾기](https://jiwon.knowhow-it.com/map): 사는 곳 주변의 지원사업·기관
- [일정](https://jiwon.knowhow-it.com/calendar): 접수 시작·마감 일정
- [읽을거리](https://jiwon.knowhow-it.com/story): 기관·직무·자격증 분석 글
- [안내 글](https://jiwon.knowhow-it.com/blog): 청년미래적립계좌, 소득 기준, 나라일터 이용법 등

## 지역별 지원사업
- [서울특별시](https://jiwon.knowhow-it.com/area/%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C)
- [경기도](https://jiwon.knowhow-it.com/area/%EA%B2%BD%EA%B8%B0%EB%8F%84)
- [부산광역시](https://jiwon.knowhow-it.com/area/%EB%B6%80%EC%82%B0%EA%B4%91%EC%97%AD%EC%8B%9C)
- 나머지 시·도는 /area/<시·도 이름> 으로 열린다.

## 참고
- [사이트 소개](https://jiwon.knowhow-it.com/about)
- [사이트맵](https://jiwon.knowhow-it.com/sitemap.xml)
- 상세 주소: 지원사업 /p/<id>, 채용 공고 /jobs/<id>, 자격증 /license/<종목코드>, 공공기관 /orgs/<id>
- 인용할 때는 쪽 주소와 "K나라지원"을 출처로 적어 주면 된다. 숫자(건수·마감일)는 매일 바뀌므로 날짜를 함께 적는 것이 좋다.`;

const n = (v: number) => v.toLocaleString("ko-KR");

export async function GET() {
  const [ov, alio, cov] = await Promise.all([
    getJobOverview().catch(() => null),
    getAlioCounts().catch(() => null),
    getCoverage().catch(() => null),
  ]);
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const lines: string[] = [];
  const jobOpen = ov ? ov.openN + (alio?.open ?? 0) : 0;
  if (jobOpen > 0) lines.push(`- 접수 중인 공공기관 채용 공고: ${n(jobOpen)}건 → https://jiwon.knowhow-it.com/jobs`);
  // orgs 는 접수 중인 기관 수가 아니라 나라일터에 공고를 낸 적 있는 기관 전체다(2026-11-03 표기 바로잡음).
  if (ov?.orgs) lines.push(`- 나라일터에 채용 공고를 낸 기관: ${n(ov.orgs)}곳${ov.firstReg ? `(${ov.firstReg.slice(0, 4)}년부터 누적)` : "(누적)"} → https://jiwon.knowhow-it.com/jobs/org`);
  if (ov?.lastYear) lines.push(`- 최근 1년 나라일터 채용 공고: ${n(ov.lastYear)}건${ov.medDays ? `, 접수 기간 중앙값 ${ov.medDays}일` : ""}`);
  if (cov && cov.welfare > 0) lines.push(`- 복지·청년 지원사업: ${n(cov.welfare)}건 → https://jiwon.knowhow-it.com/policies`);
  if (cov && cov.business > 0) lines.push(`- 기업·소상공인 지원사업: ${n(cov.business)}건 → https://jiwon.knowhow-it.com/business`);
  const today = lines.length ? `## 오늘의 숫자 (${day} 기준, 매일 바뀜)\n${lines.join("\n")}\n\n` : "";
  return new Response(`${HEAD}\n${today}${REST}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
