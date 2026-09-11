import type { Metadata } from "next";
import Link from "next/link";
import { ArtStudy } from "@/components/Art";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { studentLoanRelated } from "@/lib/related";
import { STUDENT_LOAN_FAQ } from "@/lib/pageFaq";
import { hasNote } from "@/lib/areaNotes";
import {
  LOAN_BASE, LOAN_ORGS, loanGrouped, productLabel,
} from "@/lib/studentLoan";

export const metadata: Metadata = {
  title: "학자금 대출 이자지원 지자체 — 어디가 대신 내주나",
  description:
    "한국장학재단과 협약해 학자금 대출 이자를 대신 내주는 지자체를 지역별로 정리했습니다. " +
    "사는 곳이 목록에 있으면 이자를 한 푼도 안 낼 수 있습니다.",
  keywords: [
    "학자금 대출 이자지원",
    "지자체 학자금 이자지원",
    "학자금 이자 면제",
    "대학생 학자금 지원",
  ],
  alternates: { canonical: "/money/student-loan" },
};

const ymd = (s: string) => s.replaceAll("-", ".");

export default function StudentLoan() {
  const groups = loanGrouped();
  const sggCount = LOAN_ORGS.filter((o) => o.sigungu).length;

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="생활금융"
        title="학자금 대출 이자, 지자체가 내주는 곳이 있습니다"
        sub={`전국 ${LOAN_ORGS.length}개 기관이 한국장학재단과 협약을 맺고 있습니다. 사는 곳이 여기 있으면 이자를 내지 않아도 되는 경우가 많습니다.`}
        art={<ArtStudy />}
      />

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { n: LOAN_ORGS.length, label: "협약 기관" },
          { n: groups.length, label: "해당 시·도" },
          { n: sggCount, label: "시·군 단위 협약" },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <b className="num block text-[1.5rem] font-extrabold text-brand">{s.n}</b>
            <span className="mt-0.5 block text-xs text-muted">{s.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        한국장학재단 협약 현황 {ymd(LOAN_BASE)} 기준입니다.
      </p>

      <section className="mt-10">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          지역별 협약 기관
        </h2>
        <div className="mt-4 space-y-3">
          {groups.map((g) => (
            <div key={g.sido} className="card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-[15px] font-bold">
                  {hasNote(g.sido) ? (
                    <Link
                      href={`/area/${encodeURIComponent(g.sido)}`}
                      className="underline decoration-line2 underline-offset-4 hover:text-brand"
                    >
                      {g.sido}
                    </Link>
                  ) : (
                    g.sido
                  )}
                </h3>
                <span className="num text-xs text-muted">{g.orgs.length}곳</span>
              </div>
              <ul className="mt-3 space-y-2.5">
                {g.orgs.map((o) => (
                  <li key={o.org} className="text-sm leading-relaxed">
                    <b className="font-bold">{o.org}</b>
                    <span className="ml-2 text-xs text-muted">
                      {o.sigungu ? `${o.sigungu} 단위` : "광역 단위"} · {ymd(o.signed)} 협약
                      {" · "}
                      {o.ways.join("·")}
                    </span>
                    <span className="mt-1 block text-[13px] text-muted">
                      {o.products.map(productLabel).join(" · ")}
                      {o.years.length > 0 && ` · ${o.years.join("·")}년 지원`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          어떻게 신청하나
        </h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            학자금 대출 이자지원은 한국장학재단에서 받은 대출의 이자를 지자체가 대신
            내주는 제도입니다. 대출 자체는 그대로 두고 이자만 지자체 예산으로 처리하는
            방식이라, 학생 입장에서는 원금만 갚으면 됩니다. 재학 중에는 어차피 이자가
            유예되니 체감이 덜하지만, 졸업하고 상환이 시작되면 차이가 크게 납니다.
          </p>
          <p>
            신청은 보통 학기마다 받습니다. 지자체 홈페이지나 인재육성재단 공고에
            &lsquo;학자금 대출 이자지원&rsquo;으로 올라오고, 학기 시작 전후 한두 달 안에
            접수를 마감합니다. 필요한 것은 주민등록등본, 학자금 대출 약정 내역, 재학
            증명서 정도이고, 재단에서 받은 대출이라는 점만 확인되면 절차는 간단합니다.
            다만 &lsquo;신청한 사람만&rsquo; 지원하므로, 가만히 있으면 자동으로 되는 일은
            없습니다.
          </p>
          <p>
            조건에서 가장 많이 걸리는 것은 주소입니다. 부모님 주소지 기준인 곳도 있고
            본인 주소지 기준인 곳도 있으며, 일정 기간 이상 그 지역에 살았어야 하는 곳도
            있습니다. 타지에서 학교를 다니느라 주소를 옮겨 둔 경우 여기서 갈리는 일이
            잦으니 공고문의 거주 요건을 먼저 보셔야 합니다. 소득 기준을 두는 곳도
            있지만, 이자지원은 소득과 상관없이 주는 지자체가 오히려 많은 편입니다.
          </p>
          <p>
            표에 &lsquo;일반상환&rsquo;과 &lsquo;취업후상환&rsquo;이 나뉘어 있는데, 둘 중
            무엇으로 빌렸는지에 따라 지원 대상이 달라지는 지자체가 있습니다. 저금리
            전환 대출까지 지원하는 곳도 있으니, 이미 받아 둔 대출 종류를 확인하고
            해당되는 항목이 있는지 보시면 됩니다. 목록에 사는 곳이 없더라도 매년 새로
            협약을 맺는 지자체가 생기므로, 학기 시작 전에 한 번씩 지자체 공고를 확인해
            보시길 권합니다.
          </p>
        </div>
      </section>

      <Faq items={STUDENT_LOAN_FAQ} />

      <GuideBanner title="학생·청년이라면 이것도" />
      <RelatedLinks items={studentLoanRelated()} />
      <PromoBanner placement="student-loan" context="student" />
    </div>
  );
}
