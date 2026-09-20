import type { Job } from "./pubJobs";
import type { Role } from "./jobRole";

/**
 * 공고 상세의 글.
 *
 * 나라일터가 주는 것은 제목·기관·지역·날짜뿐이다. 본문이 없다. 그래서
 * 있는 값으로 읽을 만한 문장을 짓되, 없는 사실을 지어내지 않는다 —
 * 급여도 자격 요건도 우리가 모르는 것은 모른다고 쓰고 원문으로 보낸다.
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

export function jobIntro(job: Job): string[] {
  const out: string[] = [];

  const who = job.org ?? "이 기관";
  const where = job.region ? `${job.region}에서 일할 사람을 ` : "";
  out.push(
    `${who}이(가) ${where}뽑는 공고입니다. ${STATUS_LINE[job.status]} ` +
    (job.start || job.end
      ? `접수 기간은 ${d(job.start) ?? "공고일"}부터 ${d(job.end) ?? "별도 안내"}까지입니다.`
      : "접수 기간은 공고 원문에 적혀 있습니다."),
  );

  out.push(
    "공공기관 채용은 민간과 순서가 다릅니다. 공고문에 자격 요건, 전형 단계, 가점 항목이 " +
    "미리 다 적혀 있고, 그 밖의 기준으로는 거르지 않습니다. 그래서 지원 전에 공고문을 " +
    "끝까지 읽는 것이 가장 확실한 준비입니다. 특히 응시 자격의 기준일(어느 날짜를 기준으로 " +
    "경력·자격증을 세는지)을 놓치면 서류에서 그대로 걸립니다.",
  );

  if (job.hire)
    out.push(
      `고용 형태는 ${job.hire}입니다. 공무직·기간제·청년인턴은 정규직과 채용 절차도, ` +
      "이후 전환 가능성도 다릅니다. 계약 기간과 갱신 조건이 공고문 어디에 적혀 있는지 " +
      "확인하고 지원하세요.",
    );

  out.push(
    "제출 서류는 대개 응시원서, 자기소개서, 자격 요건을 증명하는 서류입니다. 경력증명서와 " +
    "자격증 사본은 발급에 며칠 걸리는 것이 있으니 마감 당일에 준비하면 늦습니다. " +
    "온라인 접수는 마감 시각(보통 18:00)에 접속이 몰려 서버가 느려지는 일이 잦습니다.",
  );

  out.push(
    "떨어져도 같은 기관이 몇 달 뒤 비슷한 자리를 다시 여는 경우가 많습니다. 기관 이름으로 " +
    "다시 찾아보고, 자격증이 요건에 걸렸다면 그 사이에 준비해 두면 다음 공고에서 유리합니다.",
  );

  return out;
}

export function jobFaq(job: Job, role: Role | null = null): { q: string; a: string }[] {
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

  faq.push({
    q: "급여와 자격 요건은 어디에 나오나요?",
    a:
      "여기에는 나오지 않습니다. 나라일터가 공개하는 목록에는 기관·지역·기간만 들어 있고, " +
      "보수와 응시 자격은 기관이 올린 공고문(HWP·PDF)에만 있습니다. 위의 원문 링크로 " +
      "넘어가 확인하세요. 저희가 임의로 추정해 적지 않습니다.",
  });

  if (job.region)
    faq.push({
      q: `${job.region}의 다른 공공기관 채용도 볼 수 있나요?`,
      a: `네. ${job.region} 채용 목록에 같은 지역 공고를 모아 두었습니다. 접수 중인 것이 앞에 오고, 마감이 가까운 순서로 정렬됩니다.`,
    });

  faq.push({
    q: "공공기관 채용은 어디서 다 볼 수 있나요?",
    a:
      "인사혁신처 나라일터가 중앙부처·지자체·공공기관 공고를 모읍니다. 다만 개별 기관 " +
      "홈페이지에만 올라오는 공고도 있어, 가고 싶은 기관이 정해져 있다면 그 기관 채용 " +
      "게시판도 같이 보시는 편이 좋습니다.",
  });

  faq.push({
    q: "자격증이 있으면 유리한가요?",
    a:
      "공고문의 가점 항목에 적힌 자격증만 점수가 됩니다. 적혀 있지 않은 자격증은 서류에 " +
      "써도 반영되지 않습니다. 어떤 자격증이 어느 직렬에서 쓰이는지는 국가자격 종목 " +
      "목록에서 분야별로 찾아볼 수 있습니다.",
  });

  return faq;
}
