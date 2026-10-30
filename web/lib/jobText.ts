import type { Job } from "./pubJobs";
import type { Role } from "./jobRole";
import type { JobSummary } from "./jobSummary";

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
  return `${head}${when} 접수 방법과 자격 요건은 기관 원문에서 확인하세요.`;
}

const STATUS_LINE: Record<Job["status"], string> = {
  ongoing: "지금 접수 중입니다.",
  upcoming: "아직 접수 시작 전입니다.",
  closed: "접수가 끝난 공고입니다.",
  always: "상시 접수 공고입니다.",
};

/**
 * 이 공고의 기관·지역·접수 상태·기간을 한 문단으로. 예전에는 뒤에 일반론 네 문단(공공 채용의 순서,
 * 고용 형태, 제출 서류, 떨어졌을 때)이 붙었는데 모든 공고 쪽에 같은 글이라 2026-10-17 뺐다.
 */
export function jobIntro(job: Job): string {
  const who = job.org ?? "이 기관";
  const where = job.region ? `${job.region}에서 일할 사람을 ` : "";
  return (
    `${who}이(가) ${where}뽑는 공고입니다. ${STATUS_LINE[job.status]} ` +
    (job.start || job.end
      ? `접수 기간은 ${d(job.start) ?? "공고일"}부터 ${d(job.end) ?? "별도 안내"}까지입니다.`
      : "접수 기간은 공고 원문에 적혀 있습니다.")
  );
}

/**
 * 공고 쪽 FAQ. 2026-10-17 모든 쪽에 같던 답(급여·자격은 어디에, 공공 채용은 어디서, 자격증 가점)을 뺐다.
 * 공고 요약(첨부 공고문에서 뽑은 것)이 있으면 그 칸 가운데 값이 있는 것만 묻고 답한다 — 요약에 없는
 * 칸은 묻지도 않고, 답은 요약에 적힌 그대로만 옮긴다.
 */
/** FAQ 가 쓰는 이 사이트만의 숫자(lib/jobFacts 의 일부). 없으면 그 문답은 빠진다. */
export type FaqFacts = {
  n12: number; rank: number | null; ranked: number; orgTotal: number; orgSince: string | null;
  peak: { label: string; share: number } | null; orgOpen: number; periodDays: number | null; orgAvgDays: number | null;
};

export function jobFaq(job: Job, role: Role | null = null, sum: JobSummary | null = null, f: FaqFacts | null = null): { q: string; a: string }[] {
  const org = job.org ?? "해당 기관";
  const faq: { q: string; a: string }[] = [];

  // 2026-10-30: 직무 일반론 문답("{직무}는 무슨 일을 하나요?")은 같은 직무의 공고 수천 쪽에 글자 그대로 같은 답이 들어가
  // 뺐다. 대신 이 기관의 숫자로 답하는 문답을 앞에 둔다 — 쪽마다 다르고, 원문을 실은 다른 사이트에는 없는 내용이다.
  if (f && (f.n12 > 0 || f.orgTotal >= 5)) {
    const parts: string[] = [];
    if (f.n12 > 0) parts.push(`최근 1년 동안 나라일터에 공고 ${f.n12}건을 올렸습니다${f.rank && f.ranked ? ` (1년 안에 공고를 낸 ${f.ranked.toLocaleString("ko-KR")}곳 가운데 ${f.rank}위)` : ""}.`);
    else parts.push(`${f.orgSince ? `${f.orgSince}년부터 ` : ""}나라일터에 공고 ${f.orgTotal}건을 올렸습니다.`);
    if (f.peak) parts.push(`공고는 ${f.peak.label}에 ${f.peak.share}%가 몰립니다.`);
    if (f.orgOpen > 1) parts.push(`지금 접수 중인 공고도 ${f.orgOpen}건입니다.`);
    faq.push({ q: `${org}은 얼마나 자주 뽑나요?`, a: parts.join(" ") });
  }
  if (f?.periodDays && f.orgAvgDays)
    faq.push({
      q: "접수 기간이 넉넉한 편인가요?",
      a: `이 공고의 접수 기간은 ${f.periodDays}일입니다. ${org}의 평소 접수 기간은 평균 ${f.orgAvgDays}일이라 ${f.periodDays >= f.orgAvgDays * 1.3 ? "평소보다 긴 편" : f.periodDays <= f.orgAvgDays * 0.7 ? "평소보다 짧은 편이니 서류를 먼저 준비해 두는 것이 좋습니다" : "평소와 비슷한 수준"}입니다.`,
    });

  faq.push({
    q: "이 공고, 지금 지원할 수 있나요?",
    a:
      job.status === "closed"
        ? `접수가 끝났습니다${job.end ? ` (${d(job.end)} 마감)` : ""}. 다만 ${org}은(는) 비슷한 자리를 다시 여는 경우가 많으니, 기관 이름으로 다시 찾아보시면 새 공고가 있을 수 있습니다.`
        : job.status === "upcoming"
          ? `아직 접수 시작 전입니다${job.start ? ` (${d(job.start)}부터)` : ""}. 그 사이에 제출 서류를 미리 떼어 두면 여유가 생깁니다.`
          : `네, 접수 중입니다${job.end ? `. 마감은 ${d(job.end)}입니다` : ""}. 마감일은 바뀌기도 하니 원문에서 한 번 더 확인하세요.`,
  });

  if (sum) {
    const add = (q: string, label: string, v: string) => {
      if (v.trim()) faq.push({ q, a: `공고문에 적힌 ${label}: ${v.trim()}` });
    };
    add("보수는 얼마인가요?", "보수", sum.work.pay);
    add("응시 자격은 무엇인가요?", "응시 자격", sum.requirements.join(" / "));
    add("어떻게 지원하나요?", "접수 방법", sum.period.how);
    add("제출 서류는 무엇인가요?", "제출 서류", sum.documents.join(", "));
  }

  // 지역 안내 문답도 모든 쪽에 같은 글이라 뺐다(2026-10-30). 지역 목록 링크는 본문 단추에 있다.
  return faq;
}
