import type { Job } from "./pubJobs";

/**
 * 공고 상세의 글.
 *
 * 나라일터가 주는 것은 제목·기관·지역·날짜뿐이다. 본문이 없다. 그래서
 * 있는 값으로 읽을 만한 문장을 짓되, 없는 사실을 지어내지 않는다 —
 * 급여도 자격 요건도 우리가 모르는 것은 모른다고 쓰고 원문으로 보낸다.
 *
 * 2026-10-17 모든 공고 쪽에 똑같이 붙던 안내 문단·FAQ 답을 걷어 냈다. 서치 콘솔에서 사이트 거의
 * 전체가 '크롤링됨 - 현재 색인이 생성되지 않음'으로 빠졌고, 요약 없는 공고 쪽은 열 문단 중 여섯쯤이
 * 사이트 전체에서 같은 글이었다. 이 공고에 해당하는 사실(기관·날짜·공고 요약의 칸) 위주로 남긴다.
 *
 * 2026-11-16 남아 있던 틀 문장도 걷었다 — "이 공고, 이렇게 보세요" 문단(jobIntro: "{기관}이(가) … 뽑는 공고입니다.
 * 접수가 끝난 공고입니다.")과 자동 FAQ(jobFaq). 둘 다 머리글·기본 정보 표·공고 요약에 이미 있는 값을 문장으로 다시 적은
 * 것이었고, 조사를 못 고른 "이(가)"·"은(는)"이 구글 검색 결과 요약에 그대로 보였다. 이제 남은 것은 설명문 한 줄뿐이다.
 */

const d = (v: string | null) => (v ? v.replaceAll("-", ".") : null);

/** 검색 결과에 뜨는 한 줄. 제목이 아니라 이 글로 눌러 들어온다. */
export function jobSummary(job: Job): string {
  const parts: string[] = [];
  if (job.org) parts.push(job.org);
  if (job.region) parts.push(`${job.region} 근무`);
  if (job.hire) parts.push(job.hire);
  if (job.headcount) parts.push(`${job.headcount}명 모집`);
  const head = parts.length ? `${parts.join(" · ")}.` : "공공기관 채용 공고입니다.";
  const when =
    job.end ? ` 접수 마감 ${d(job.end)}.`
    : job.start ? ` ${d(job.start)}부터 접수.`
    : "";
  // 2026-11-08 끝의 "접수 방법과 자격 요건은 기관 원문에서 확인하세요." 를 뺐다. 모든 공고 쪽의 설명문·구조화 데이터·본문
  // 첫 문단에 똑같이 붙어, 구글 검색 결과에 "원문을 보라는 복사본" 으로 그대로 보였다(11/6 site: 캡처). 원문 링크는 쪽 안에 따로 있다.
  return `${head}${when}`;
}
