import type { Related } from "@/components/RelatedLinks";
import { POSTS } from "./posts";

/**
 * 페이지끼리 서로 권해 주는 목록을 만든다.
 *
 * 어느 화면에서 막히든 다음 갈 곳이 보이게 하는 것이 목적이라,
 * 안내 글·지역·조회 화면이 서로를 가리키도록 엮어 둔다.
 */

const post = (slug: string): Related | null => {
  const p = POSTS.find((x) => x.slug === slug);
  return p ? { href: `/blog/${p.slug}`, title: p.title, desc: p.description } : null;
};

const keep = (items: (Related | null)[], n = 4) =>
  items.filter((x): x is Related => x !== null).slice(0, n);

/** 인구가 많아 찾는 사람이 많은 지역부터. 자기 지역은 뺀다. */
const BIG = [
  "경기도",
  "서울특별시",
  "부산광역시",
  "경상남도",
  "인천광역시",
  "경상북도",
];

export function areaRelated(sido: string): Related[] {
  const others = BIG.filter((s) => s !== sido).slice(0, 2);
  return keep([
    {
      href: "/money/student-loan",
      title: "학자금 이자지원 되는 지자체",
      desc: `${sido}에도 학자금 대출 이자를 대신 내주는 곳이 있는지 확인해 보세요.`,
    },
    post("check-eligibility"),
    post("how-to-apply"),
    ...others.map((s) => ({
      href: `/area/${encodeURIComponent(s)}`,
      title: `${s} 정부 복지·지원금 모아보기`,
      desc: `${s}에서 신청할 수 있는 지원사업과, 어떤 분들이 무엇을 찾는지 정리했습니다.`,
    })),
  ]);
}

export function postRelated(slug: string): Related[] {
  const others = POSTS.filter((p) => p.slug !== slug)
    .slice(0, 2)
    .map((p) => ({
      href: `/blog/${p.slug}`,
      title: p.title,
      desc: p.description,
    }));
  return keep([
    ...others,
    {
      href: "/area/경기도",
      title: "경기도 정부 복지·지원금 모아보기",
      desc: "인구가 가장 많은 지역입니다. 도 사업과 시·군 사업이 따로 있어 둘 다 봐야 합니다.",
    },
    {
      href: "/",
      title: "내 조건으로 지원금 찾기",
      desc: "사는 곳과 나이만 넣으면 해당될 만한 사업만 남습니다. 회원가입은 없습니다.",
    },
  ]);
}

export function blogIndexRelated(): Related[] {
  return keep([
    {
      href: "/",
      title: "내 조건으로 지원금 찾기",
      desc: "글을 읽으셨다면 실제 조회로 넘어가 보세요. 조건을 고르기만 하면 됩니다.",
    },
    {
      href: "/area/경기도",
      title: "경기도 정부 복지·지원금 모아보기",
      desc: "지역별 페이지에는 그 지역에서 누가 무엇을 찾는지 정리해 두었습니다.",
    },
    {
      href: "/?tab=business",
      title: "중소기업·소상공인 지원사업 찾기",
      desc: "지역과 업종, 업력으로 좁혀 기업 지원사업만 따로 볼 수 있습니다.",
    },
    { href: "/about", title: "나라지원 소개", desc: "무엇이 좋아지는지, 무엇을 받지 않는지 적어 두었습니다." },
  ]);
}

export function aboutRelated(): Related[] {
  return keep([
    post("government-subsidy-types"),
    post("how-to-apply"),
    {
      href: "/",
      title: "내 조건으로 지원금 찾기",
      desc: "사는 곳과 나이만 넣으면 됩니다. 주민등록번호도 소득 자료도 필요 없습니다.",
    },
    {
      href: "/blog",
      title: "지원금 안내 글 모음",
      desc: "종류·신청 방법·대상 확인까지 헷갈리는 것들을 갈래별로 정리했습니다.",
    },
  ]);
}

export function programRelated(sido: string | null): Related[] {
  return keep([
    post("how-to-apply"),
    post("check-eligibility"),
    sido
      ? {
          href: `/area/${encodeURIComponent(sido)}`,
          title: `${sido} 정부 복지 전체 보기`,
          desc: `${sido}에서 신청할 수 있는 지원사업을 대상별로 나누어 정리했습니다.`,
        }
      : null,
  ]);
}

// ── 새로 붙인 자료 화면 ──────────────────────────────────

const POLICIES: Related = {
  href: "/policies",
  title: "정책 전체 찾아보기",
  desc: "대상·분야·지역·업종을 눌러 가며 전국 공고를 훑어볼 수 있습니다.",
};

const JEONSE: Related = {
  href: "/money/jeonse",
  title: "전세자금대출 금리 비교",
  desc: "주택금융공사 보증 전세대출의 은행별 금리를 낮은 순으로 세워 두었습니다.",
};

const STUDY: Related = {
  href: "/money/student-loan",
  title: "학자금 이자지원 되는 지자체",
  desc: "학자금 대출 이자를 대신 내주는 지역이 있습니다. 사는 곳이 있는지 보세요.",
};

const MONEY: Related = {
  href: "/money",
  title: "생활금융 정보",
  desc: "받는 돈 말고, 나가는 돈을 줄여 주는 제도만 모았습니다.",
};

const JOBS: Related = {
  href: "/jobs",
  title: "공공기관 채용정보",
  desc: "나라일터 채용 공고를 지역·고용형태로 걸러 접수 중인 것부터 봅니다.",
};

const AGENCY: Related = {
  href: "/agency",
  title: "공공기관 지원사업·행사·시설",
  desc: "지자체 공고에 안 나오는 공공기관 사업을 생애주기와 분야로 찾습니다.",
};

const LICENSE: Related = {
  href: "/license",
  title: "국가자격 종목 전체 목록",
  desc: "무슨 자격증이 있는지 직무 분야와 등급으로 나눠 두었습니다.",
};

const HOME: Related = {
  href: "/",
  title: "내 조건으로 지원금 찾기",
  desc: "사는 곳과 나이만 넣으면 해당될 만한 사업만 남습니다. 회원가입은 없습니다.",
};

export function policiesRelated(): Related[] {
  return keep([HOME, LICENSE, JEONSE, STUDY]);
}

export function moneyRelated(): Related[] {
  return keep([POLICIES, HOME, post("how-to-apply"), post("government-subsidy-types")]);
}

export function jeonseRelated(): Related[] {
  return keep([STUDY, POLICIES, HOME, post("how-to-apply")]);
}

export function studentLoanRelated(): Related[] {
  return keep([LICENSE, JEONSE, POLICIES, HOME]);
}

export function agencyRelated(): Related[] {
  return keep([HOME, POLICIES, JOBS, post("government-subsidy-types")]);
}

const MAJORS: Related = {
  href: "/jobs/majors",
  title: "학과별 취업률 통계",
  desc: "전공을 고르기 전에 졸업생이 어디로 갔는지 3년치로 봅니다.",
};

export function jobsRelated(): Related[] {
  return keep([MAJORS, LICENSE, HOME, POLICIES]);
}

export function licenseRelated(): Related[] {
  return keep([JOBS, 
    { href: "/?emp=구직중&via=license", title: "구직 중인 분을 위한 지원",
      desc: "취업 준비 기간의 생활비·교육비를 돕는 사업만 모아 봅니다." },
    STUDY, POLICIES, post("youth-support"),
  ]);
}
