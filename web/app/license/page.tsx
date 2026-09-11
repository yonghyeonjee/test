import type { Metadata } from "next";
import Link from "next/link";
import { ArtLicense } from "@/components/Art";
import GuideBanner from "@/components/GuideBanner";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import LicenseList from "@/components/LicenseList";
import { getLicenses } from "@/lib/qnet";
import { licenseRelated } from "@/lib/related";

/** 종목 목록은 해마다 몇 개 바뀌는 정도다. 하루 한 번이면 충분하다. */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "국가자격 종목 전체 목록 — 분야별·등급별로 찾기",
  description:
    "한국산업인력공단이 시행하는 국가기술자격·국가전문자격 종목을 직무 분야와 등급별로 펼쳤습니다. " +
    "자격증 응시료·학원비를 지원하는 정부 제도와 함께 보실 수 있습니다.",
  keywords: [
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
  const board = await getLicenses();
  const picked = one(searchParams.series) ?? "";
  const tech = board.all.filter((l) => l.kind === "T").length;
  const fields = new Set(board.all.map((l) => l.field)).size;

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="자격증"
        title="국가자격 종목, 전부 한 화면에"
        sub="무슨 자격증이 있는지부터 알아야 준비할 수 있습니다. 한국산업인력공단이 시행하는 종목을 직무 분야와 등급으로 나눠 두었습니다."
        art={<ArtLicense />}
      >
        {board.ok && (
          <div className="mt-7 grid grid-cols-3 gap-3">
            {[
              { n: board.all.length, label: "시행 종목" },
              { n: tech, label: "국가기술자격" },
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

      <LicenseList board={board} picked={picked} />

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
            공단이 공개한 종목 명단을 그대로 옮긴 것이라, 올해 시행 여부나 회차는 담겨
            있지 않습니다.
          </p>
        </div>
      </section>

      <GuideBanner title="취업·이직을 준비하신다면 이것도" />
      <RelatedLinks items={licenseRelated()} />
      <PromoBanner placement="license" context="job" />
    </div>
  );
}
