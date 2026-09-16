import type { Metadata } from "next";
import Link from "next/link";
import { ArtLicense } from "@/components/Art";
import AdSlot from "@/components/AdSlot";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import LicenseFinder from "@/components/LicenseFinder";
import ProLicenseList from "@/components/ProLicenseList";
import { getLicenses, proBoard } from "@/lib/qnet";
import { licenseRelated } from "@/lib/related";
import { PRO_LICENSE_FAQ } from "@/lib/pageFaq";

/** 종목 명단은 해마다 몇 개 바뀌는 정도다. 하루 한 번이면 넉넉하다. */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "국가전문자격 종류 — 공인중개사·감정평가사·청소년상담사 목록",
  description:
    "등급 없이 자격마다 따로 시행하는 국가전문자격을 한자리에 모았습니다. " +
    "공인중개사·감정평가사·행정사·청소년상담사 등 종목과 응시 안내, 취득을 돕는 정부 지원 제도를 함께 보실 수 있습니다.",
  keywords: [
    "국가전문자격",
    "공인중개사 자격증",
    "감정평가사",
    "청소년상담사",
    "행정사 자격증",
    "국가전문자격 종류",
    "전문자격증 목록",
  ],
  alternates: { canonical: "/license/pro" },
};

export default async function ProLicensePage() {
  const all = await getLicenses();
  const board = proBoard(all);
  const finder = board.all.map((l) => ({
    code: l.code, name: l.name, series: l.series, field: l.field,
  }));

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="자격증"
        title="국가전문자격"
        sub="기능사·기사 같은 등급 체계가 없는 자격들입니다. 자격마다 근거 법령과 시행 기관이 따로 있어, 응시 자격과 시험 일정도 자격마다 다릅니다."
        art={<ArtLicense />}
      >
        {board.ok && (
          <div className="mt-7 grid grid-cols-2 gap-3">
            {[
              { n: board.all.length, label: "시행 종목" },
              { n: board.series.length, label: "자격 수" },
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

      {board.ok ? (
        <>
          <LicenseFinder
            items={finder}
            placeholder="예: 공인중개사, 감정평가사, 행정사"
            emptyNote="이 이름의 자격이 없습니다. 기능사·기사처럼 등급이 있는 자격은 국가기술자격 화면에 있습니다."
          />
          <ProLicenseList items={board.all} />
        </>
      ) : (
        <div className="card mt-6 p-8 text-center">
          <p className="leading-relaxed text-muted">
            지금은 종목 목록을 불러오지 못했습니다.
            <br />
            공공데이터 쪽이 잠시 응답하지 않는 경우가 있어, 잠시 뒤 다시 들어오시면 보입니다.
          </p>
          <a href="https://www.q-net.or.kr" target="_blank" rel="noopener noreferrer"
             className="btn btn-ghost mt-5">
            큐넷에서 직접 보기
          </a>
        </div>
      )}

      <AdSlot name="page_bottom" />

      <section className="mt-14">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          국가기술자격과 무엇이 다른가요
        </h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            국가기술자격은 국가기술자격법 하나를 근거로 기능사부터 기술사까지 등급이
            정해져 있고, 대부분 한국산업인력공단이 같은 일정으로 시행합니다. 등급을
            알면 응시 자격과 시험 시기를 대강 짐작할 수 있습니다.
          </p>
          <p>
            국가전문자격은 그렇지 않습니다. 공인중개사는 공인중개사법, 감정평가사는
            감정평가법처럼 자격마다 근거 법령이 따로 있고, 시행 기관도 산업인력공단·
            한국부동산원·국토교통부처럼 제각각입니다. 그래서 응시 자격도 등급이 아니라
            법령이 정한 학력·경력·교육 이수 요건을 직접 봐야 합니다.
          </p>
          <p>
            시험 일정도 한자리에 모이지 않습니다. 이 사이트의 시험 일정 화면은
            국가기술자격의 등급별 회차만 다루므로, 국가전문자격은 각 종목 안내에서
            시행 기관을 확인한 뒤 그곳 공고를 보셔야 합니다.
          </p>
          <p>
            취득을 돕는 지원 제도는 두 갈래가 비슷합니다. 국민내일배움카드로 훈련비를
            지원받는 과정에 국가전문자격 대비 과정도 여럿 있고, 지자체 응시료 지원
            사업은 대개 국가기술자격을 대상으로 하니 공고의 대상 자격을 확인하세요.
          </p>
        </div>
      </section>

      <Faq items={PRO_LICENSE_FAQ} />

      <div className="mt-10">
        <Link href="/license" className="btn btn-ghost px-5 py-2.5">국가기술자격 종목 보기</Link>
      </div>

      <GuideBanner title="취업·이직을 준비하신다면 이것도" />
      <RelatedLinks items={licenseRelated()} />
      <PromoBanner placement="license-pro" context="job" />
    </div>
  );
}
