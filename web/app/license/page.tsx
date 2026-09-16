import type { Metadata } from "next";
import Link from "next/link";
import { ArtLicense } from "@/components/Art";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import LicenseList from "@/components/LicenseList";
import LicenseFinder from "@/components/LicenseFinder";
import ExamDeadlines from "@/components/ExamDeadlines";
import { getLicenses, proBoard, techBoard } from "@/lib/qnet";
import { getExamRounds, upcoming } from "@/lib/qnetExam";
import { licenseRelated } from "@/lib/related";
import { LICENSE_FAQ } from "@/lib/pageFaq";

/** 종목 목록은 해마다 몇 개 바뀌는 정도다. 하루 한 번이면 충분하다. */

// 검색어(searchParams)로 걸러 보여 주는 화면이라 어차피 요청마다 그린다.
// 그런데도 Next 는 빌드 때 한 번 시험 삼아 그려 보는데, 그 안에서 공공 API 를
// 부르다 60초를 넘기면 배포가 통째로 실패한다. 미리 그리지 않게 못 박는다.
// (fetch 마다 next.revalidate 를 직접 주고 있어 응답 캐시는 그대로 산다.)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "국가자격증 찾기 — 종목별 응시 자격·시험 일정·지원 제도",
  description:
    "한국산업인력공단이 시행하는 국가기술자격 600여 종목을 이름으로 찾고, 응시 자격과 다가오는 " +
    "원서접수 일정을 확인하세요. 자격증 응시료·학원비를 지원하는 정부 제도도 함께 안내합니다.",
  keywords: [
    "국가자격증 종류",
    "사회복지사 자격증",
    "보육교사 자격증",
    "국가자격 종목",
    "국가기술자격 목록",
    "자격증 종류",
    "기사 산업기사 기능사",
    "자격증 응시료 지원",
  ],
  alternates: { canonical: "/license" },
};

type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v);

export default async function LicensePage({ searchParams }: { searchParams: SP }) {
  const all = await getLicenses();
  // 일정은 못 읽어도 화면은 살린다. 이 화면의 본업은 종목 찾기다.
  const soon = await getExamRounds().then(upcoming).catch(() => []);
  // 목록은 국가기술자격만. 국가전문자격은 등급이 없어 칩이 서른 개 넘게
  // 깔리므로 /license/pro 로 뺐다. 이름 검색은 둘 다 뒤진다.
  const board = techBoard(all);
  const pro = proBoard(all);
  const asked = one(searchParams.series) ?? "";
  // 없는 등급으로 걸러 빈 화면이 되지 않게. 국가전문자격 계열이 들어와도 마찬가지.
  const picked = board.series.some((s) => s.name === asked) ? asked : "";
  const fields = new Set(board.all.map((l) => l.field)).size;
  const finder = all.all.map((l) => ({ code: l.code, name: l.name, series: l.series, field: l.field }));

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="자격증"
        title="국가자격증 찾기"
        sub="자격증 이름을 넣으면 응시 자격과 다가오는 시험 일정, 학원비·응시료를 지원하는 제도까지 한 번에 나옵니다. 아래 목록은 등급이 있는 국가기술자격이고, 국가전문자격은 따로 모아 두었습니다."
        art={<ArtLicense />}
      >
        {all.ok && (
          <div className="mt-7 grid grid-cols-3 gap-3">
            {[
              { n: board.all.length, label: "국가기술자격" },
              { n: pro.all.length, label: "국가전문자격" },
              { n: fields, label: "직무 분야" },
            ].map((b) => (
              <div key={b.label} className="rounded-card bg-white/10 px-3 py-3 text-center">
                <b className="num block text-[1.35rem] font-extrabold text-white">
                  {b.n.toLocaleString()}
                </b>
                <span className="mt-0.5 block text-[11.5px] text-white/70">{b.label}</span>
              </div>
            ))}
          </div>
        )}
      </PageBanner>

      {/* 들어온 사람은 대개 이름 하나를 들고 온다. 그것부터 받는다. */}
      {all.ok && <LicenseFinder items={finder} />}

      {/* 이 화면이 무엇을 해 주는지 한 줄씩. 처음 온 사람이 헤매지 않게. */}
      <ol className="mt-4 grid gap-2 text-[13.5px] leading-relaxed text-ink2 sm:grid-cols-3">
        {[
          ["종목 고르기", "위에서 이름으로 찾거나, 아래 등급·분야별 목록에서 고릅니다."],
          ["종목 안내 보기", "응시 자격, 시험 과목, 이 등급의 다가오는 접수 일정이 나옵니다."],
          ["큐넷에서 접수", "원서접수와 합격 확인은 한국산업인력공단 큐넷에서 합니다."],
        ].map(([h, d], i) => (
          <li key={h} className="flex gap-2.5 rounded-card bg-ground px-3.5 py-3">
            <span className="num shrink-0 font-extrabold text-brand">{i + 1}</span>
            <span><b className="font-bold">{h}</b> <span className="text-muted">{d}</span></span>
          </li>
        ))}
      </ol>

      <LicenseList
        board={board}
        picked={picked}
        footer={
          pro.ok ? (
            <Link href="/license/pro" className="card card-link mt-6 flex items-baseline justify-between gap-4 p-5">
              <span>
                <b className="text-[15px] font-bold">국가전문자격 따로 보기</b>
                <span className="mt-1 block text-[13px] leading-relaxed text-muted">
                  공인중개사·감정평가사·청소년상담사처럼 등급 없이 자격마다 따로 시행하는 것들입니다.
                </span>
              </span>
              <span className="num shrink-0 text-xs text-muted">{pro.all.length}종목</span>
            </Link>
          ) : null
        }
      />

      {/* 일정은 목록 다음이다. 종목부터 고르고 그다음이 접수일이다. */}
      <ExamDeadlines
        items={soon}
        limit={4}
        title="접수 마감이 가까운 시험"
        intro="국가기술자격은 등급 단위로 함께 접수합니다. 같은 등급의 종목은 같은 날 열리니, 내 종목의 등급을 보고 맞춰 두세요. 카드를 누르면 그 등급의 전체 일정으로 갑니다."
      />

      <section className="mt-14">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          자격증과 지원금은 붙어 다닙니다
        </h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            자격증을 따는 데 드는 돈은 학원비와 응시료입니다. 이 둘을 정부가 대신 내주는
            제도가 여럿 있는데, 자격증 목록과 지원 제도가 따로 놀아서 둘을 같이 보는
            사람이 드뭅니다. 대표적인 것이 국민내일배움카드입니다. 훈련비의 대부분을
            국가가 부담하고, 자격증 시험을 준비하는 학원 과정 상당수가 여기 등록되어
            있습니다. 취업 준비 중인 청년이나 이직을 생각하는 재직자 모두 쓸 수 있습니다.
          </p>
          <p>
            지자체 사업은 더 구체적입니다. 청년 응시료 지원처럼 국가기술자격 시험 응시료를
            일정 횟수까지 돌려주는 사업이 시·군 단위로 있고, 어떤 곳은 합격하면
            축하금까지 얹어 줍니다. 대상 나이와 거주 요건이 지역마다 다르므로 사는 곳의
            공고를 확인해야 합니다. 이 사이트에서 사는 곳과 나이를 넣고 조회하시면
            그런 사업이 있는지 같이 나옵니다.
          </p>
          <p>
            등급은 보통 기능사에서 시작합니다. 기능사는 응시 자격에 제한이 없어 학력이나
            경력이 없어도 볼 수 있고, 산업기사와 기사는 관련 학과 졸업이나 실무 경력이
            필요합니다. 그래서 지원 제도도 기능사 쪽이 가장 넓습니다. 위 목록에서 내
            분야의 종목을 고른 뒤 등급을 확인하고, 그다음에 지원 제도를 찾는 순서가
            헛걸음이 가장 적습니다.
          </p>
          <p>
            시험 일정과 응시 자격의 최종 확인은 큐넷에서 하셔야 합니다. 여기 목록은
            공단이 공개한 종목 명단을 그대로 옮긴 것이고, 회차 일정은 등급 단위로만
            공개되어 종목마다 실제 시행 여부가 다를 수 있습니다.
          </p>
        </div>
      </section>

      <Faq items={LICENSE_FAQ} />

      <GuideBanner title="취업·이직을 준비하신다면 이것도" />
      <RelatedLinks items={licenseRelated()} />
      <PromoBanner placement="license" context="job" />
    </div>
  );
}
