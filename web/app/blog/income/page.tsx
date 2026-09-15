import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import { PostArt } from "@/components/Art";
import Faq from "@/components/Faq";
import IncomeEstimator from "@/components/IncomeEstimator";
import JsonLd from "@/components/JsonLd";
import MidAd from "@/components/MidAd";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { manwon, medianIncome, tableYear, won } from "@/lib/medianIncome";
import { pageGraph } from "@/lib/schema";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "기준 중위소득 소득 기준 계산기 — 내 연소득은 몇 %일까",
  description:
    "공고에 적힌 '기준 중위소득 180% 이하'가 얼마인지 금액으로 확인합니다. 연소득과 가구원 수를 " +
    "넣으면 몇 %에 해당하는지, 생계·의료·주거·교육급여 기준선에 드는지 어림잡아 봅니다.",
  keywords: [
    "기준 중위소득", "중위소득 계산기", "중위소득 180%", "중위소득 150%",
    "중위소득 100% 얼마", "소득 기준", "소득인정액", "생계급여 기준",
    "의료급여 기준", "주거급여 기준", "가구원수별 중위소득",
  ],
  alternates: { canonical: "/blog/income" },
};

/**
 * 복지로가 직접 굴리는 진단·모의계산. 확정은 여기서 한다.
 *
 * 휴대폰 주소(m.bokjiro)로 건다. 들어오는 사람 대부분이 휴대폰이다.
 */
const BOKJIRO = [
  {
    href: "https://m.bokjiro.go.kr/ssis-tem/twatbz/mkclAsis/mkclInsertNblgPage.do",
    label: "기초생활수급자 모의계산",
    desc: "생계·의료·주거·교육급여를 받을 수 있는지",
  },
  {
    href: "https://m.bokjiro.go.kr/ssis-tem/twatbz/mkclAsis/mkclInsertEmhecsPage.do",
    label: "초·중·고 교육비지원 모의계산",
    desc: "자녀 학비·급식비·방과후 활동비 지원",
  },
  {
    href: "https://m.bokjiro.go.kr/ssis-tem/twatbz/mkclAsis/mkclInsertBspnPage.do",
    label: "기초연금 모의계산",
    desc: "만 65세 이상, 얼마를 받을 수 있는지",
  },
  {
    href: "https://m.bokjiro.go.kr/ssis-tem/twatbz/mkclAsis/SelfDiagnosisYouthHousView.do",
    label: "청년 주거 자가진단",
    desc: "청년 월세·전세 지원에 해당하는지",
  },
];

export default function IncomePage() {
  const year = tableYear();

  return (
    <div className="pb-4">
      <JsonLd
        data={pageGraph({
          path: "/blog/income",
          name: "기준 중위소득 소득 기준 계산기",
          description: "연소득과 가구원 수로 기준 중위소득 몇 %인지 확인합니다.",
          crumbs: [
            { name: "지원금 안내", path: "/blog" },
            { name: "소득 기준" },
          ],
        })}
      />
      <nav aria-label="위치" className="text-[13px] text-muted">
        <Link href="/blog" className="hover:text-brand">지원금 안내</Link>
        {" · "}
        <span className="text-ink2">소득 기준</span>
      </nav>

      <header className="mt-3">
        <h1 className="display text-[1.75rem] leading-tight">
          &ldquo;기준 중위소득 180% 이하&rdquo;는 얼마일까
        </h1>
        <p className="mt-3 text-[15.5px] leading-[1.85] text-ink2">
          지원금 공고의 소득 요건은 거의 다 이렇게 적혀 있습니다. 퍼센트만 적혀 있으니
          내가 되는지 알 수가 없습니다. 가구원 수와 소득을 넣으면 금액으로 바꿔 드립니다.
        </p>
        <div className="mt-4"><PostArt name="money" /></div>
      </header>

      {year === null ? (
        <div className="card mt-6 p-6">
          <p className="leading-relaxed text-muted">
            올해 기준 중위소득 표가 아직 들어와 있지 않습니다. 낡은 금액을 보여
            드리는 것보다 안 보여 드리는 편이 낫다고 보아 비워 둡니다. 아래 복지로
            모의계산에서 확인해 주세요.
          </p>
        </div>
      ) : (
        <IncomeEstimator year={year} />
      )}

      <p className="mt-3 text-xs leading-relaxed text-muted">
        {year ?? "—"}년 보건복지부 고시 기준입니다. 기준 중위소득은 해마다 중앙생활보장위원회
        심의를 거쳐 새로 고시됩니다.
      </p>

      <MidAd name="detail_mid" context="money" seed="income" className="mt-8" />

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">
          이 숫자를 그대로 믿으시면 안 되는 이유
        </h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            심사는 연봉이 아니라 <b>소득인정액</b>으로 합니다. 소득인정액은 &ldquo;소득평가액 +
            재산의 소득환산액&rdquo;입니다. 쉽게 말해 <b>집·전세보증금·자동차·예금도 소득으로
            바꿔 더합니다.</b> 그래서 월급이 같아도 전세보증금이 큰 집은 소득인정액이 훨씬
            높게 잡힙니다. 위 계산기는 재산을 하나도 안 보므로, 재산이 있으면 실제로는
            더 높은 구간에 들어갑니다.
          </p>
          <p>
            소득 쪽에도 빼 주는 것이 있습니다. 근로소득은 일정 비율을 공제하고, 장애인·
            학생·노인은 추가 공제가 붙습니다. 이건 반대로 실제 소득인정액을 낮춥니다.
            빼는 것과 더하는 것이 둘 다 있어서, 어느 쪽으로 얼마나 움직일지는 사람마다
            다릅니다.
          </p>
          <p>
            아예 다른 잣대를 쓰는 사업도 많습니다. 청년 지원 사업과 각종 바우처는{" "}
            <b>건강보험료 납부액</b>으로 가리는 경우가 흔합니다. 이때는 중위소득 퍼센트가
            아니라 &ldquo;건강보험료 고지금액 얼마 이하&rdquo;가 기준이 됩니다. 공고문에 어느 쪽인지
            반드시 적혀 있으니 그것부터 보세요.
          </p>
          <p>
            그러니 위 결과는 <b>어느 언저리인지 가늠하는 용도</b>입니다. 경계선에 가깝게
            나왔다면 되는지 안 되는지 여기서 판단하지 마시고, 아래 복지로 진단이나 주민센터에서
            확인하세요. 경계선에서 떨어졌다고 지레 포기하는 것이 제일 아깝습니다.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">복지로에서 정확히 보기</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink2">
          복지로는 보건복지부가 운영하는 곳입니다. 재산까지 넣어 소득인정액을 계산해 주므로
          위 어림보다 훨씬 정확합니다.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {BOKJIRO.map((b) => (
            <li key={b.href}>
              <a href={b.href} target="_blank" rel="noopener noreferrer"
                 className="card card-link block p-4">
                <b className="block text-[14.5px] leading-snug">{b.label}</b>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">
                  {b.desc}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {year !== null && (
        <section className="mt-12">
          <h2 className="sec-title text-[1.0625rem] font-extrabold">
            {year}년 기준 중위소득 100%
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-line text-left text-[12.5px] text-muted">
                  <th scope="col" className="py-2 pr-2 font-semibold">가구원 수</th>
                  <th scope="col" className="py-2 pr-2 text-right font-semibold">월</th>
                  <th scope="col" className="py-2 text-right font-semibold">연 환산</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                  const m = medianIncome(n, year);
                  return m === null ? null : (
                    <tr key={n} className="border-b border-line/70 last:border-b-0">
                      <td className="py-2 pr-2">{n}인</td>
                      <td className="num py-2 pr-2 text-right">{won(m)}</td>
                      <td className="num py-2 text-right text-muted">{manwon(m * 12)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            8인 이상은 7인 가구 금액에 (7인 − 6인) 차액을 한 사람마다 더합니다. 고시가 정한
            방식입니다.
          </p>
        </section>
      )}

      <AdSlot name="page_bottom" />

      <Faq
        items={[
          {
            q: "기준 중위소득이 정확히 뭔가요?",
            a: "우리나라 모든 가구를 소득 순서대로 줄 세웠을 때 한가운데 오는 가구의 소득입니다. 실제 조사값 그대로는 아니고, 보건복지부 장관이 중앙생활보장위원회 심의를 거쳐 해마다 고시합니다. 기초생활보장을 비롯한 여러 복지 사업이 이 값의 몇 %인지로 대상을 정합니다.",
          },
          {
            q: "연봉 3,600만원이면 몇 %인가요?",
            a: `가구원 수에 따라 완전히 달라집니다. 위 계산기에 3600을 넣고 가구원 수를 바꿔 보시면 바로 보입니다. 같은 소득이라도 1인 가구는 높은 %가 나오고 4인 가구는 낮게 나옵니다. 가구원이 많을수록 기준 금액 자체가 크기 때문입니다.`,
          },
          {
            q: "세전인가요 세후인가요?",
            a: "세전입니다. 세금과 4대보험을 빼기 전 금액을 넣으세요. 다만 실제 심사에서는 근로소득 공제가 따로 적용되어 계산된 소득이 세전보다 낮아집니다.",
          },
          {
            q: "가구원은 누구까지 세나요?",
            a: "주민등록등본에 함께 올라 있고 생계를 같이하는 사람을 셉니다. 따로 사는 부모나 취업해서 독립한 형제는 대개 빠집니다. 사업마다 조금씩 다르니 공고문의 가구 기준을 확인하세요.",
          },
          {
            q: "재산이 있으면 어떻게 되나요?",
            a: "불리해집니다. 집·전세보증금·자동차·예금은 정해진 비율로 소득으로 환산되어 더해집니다(소득의 소득환산액). 위 계산기는 재산을 보지 않으므로, 재산이 있으면 실제로는 더 높은 구간에 들어갑니다. 복지로 모의계산에서 재산까지 넣어 보세요.",
          },
          {
            q: "경계선에 걸렸는데 신청해도 되나요?",
            a: "신청하세요. 공제 항목이 사람마다 달라서 실제 계산에서 내려가는 경우가 많습니다. 여기 계산은 어림이고, 최종 판단은 접수 기관이 합니다. 미리 포기하지 마세요.",
          },
        ]}
      />

      <RelatedLinks
        items={[
          { href: "/", title: "내 조건으로 지원금 찾기",
            desc: "사는 곳과 나이를 넣으면 실제로 해당되는 것만 남깁니다." },
          { href: "/policies", title: "전체 지원 정책 보기",
            desc: "중앙부처와 지자체 지원사업을 한자리에서 훑어봅니다." },
          { href: "/topic/living", title: "생활·복지 지원",
            desc: "생계·주거·의료처럼 살림에 바로 닿는 지원을 모았습니다." },
          { href: "/blog", title: "지원금 안내 글 전체",
            desc: "신청 방법과 종류를 정리한 안내 글 목록입니다." },
        ]}
      />
      <PromoBanner placement="income" context="money" />
    </div>
  );
}
