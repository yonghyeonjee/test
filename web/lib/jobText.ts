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
export function jobFaq(job: Job, role: Role | null = null, sum: JobSummary | null = null): { q: string; a: string }[] {
  const org = job.org ?? "해당 기관";
  const faq: { q: string; a: string }[] = [];

  if (role)
    faq.push({
      q: `${role.name} 자리는 무슨 일을 하나요?`,
      a: `${role.does} 이 공고의 실제 담당 업무는 원문의 업무 내용 항목에 적혀 있습니다.`,
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

  if (job.region)
    faq.push({
      q: `${job.region}의 다른 공공기관 채용도 볼 수 있나요?`,
      a: `네. ${job.region} 채용 목록에 같은 지역 공고를 모아 두었습니다. 접수 중인 것이 앞에 오고, 마감이 가까운 순서로 정렬됩니다.`,
    });

  return faq;
}
