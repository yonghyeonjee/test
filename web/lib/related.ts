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
