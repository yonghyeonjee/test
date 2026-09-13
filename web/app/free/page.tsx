import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import Faq from "@/components/Faq";
import PageBanner from "@/components/PageBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { ArtStudy } from "@/components/Art";
import { FREE_GROUPS, withUtm } from "@/lib/freeServices";
import { moneyRelated } from "@/lib/related";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "무료 서비스 — 심리 테스트, 영어 문법, 마케팅 용어",
  description:
    "회원가입도 결제도 없이 쓰는 무료 서비스를 모았습니다. 공개 척도를 쓴 심리 자가진단과 " +
    "성향 테스트, 순서대로 보는 영어 문법 커리큘럼, 데이터·마케팅 용어 사전입니다.",
  keywords: [
    "무료 심리테스트", "성격유형 테스트", "번아웃 자가진단",
    "무료 영어 공부", "영어 문법 커리큘럼", "마케팅 용어",
  ],
  alternates: { canonical: "/free" },
};

export default function FreePage() {
  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="무료 서비스"
        title="가입도 결제도 없이 쓰는 것들"
        sub="지원금 찾는 김에 같이 보시라고 모아 뒀습니다. 심리 테스트, 영어 문법, 마케팅 용어 — 전부 무료입니다."
        art={<ArtStudy />}
      />

      <p className="mt-8 text-[15px] leading-[1.85] text-ink2">
        나라지원과 같은 곳에서 만드는 서비스입니다. 광고를 보여 주는 것 말고 받는 것이 없어서,
        가입을 받지도 개인정보를 묻지도 않습니다. 심리 테스트는 답을 브라우저에서 계산하고
        서버로 보내지 않습니다.
      </p>

      {FREE_GROUPS.map((g, i) => (
        <section key={g.key} className="mt-14">
          <p className="eyebrow">{g.tag}</p>
          <h2 className="sec-title mt-2 text-[1.0625rem] font-extrabold">{g.title}</h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{g.lead}</p>

          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {g.items.map((it) => (
              <li key={it.slug}>
                <a
                  href={withUtm(it.href, it.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card card-link block h-full p-5"
                >
                  <b className="block text-[15px] leading-snug">{it.title}</b>
                  <span className="mt-1.5 block text-[13.5px] leading-relaxed text-muted">
                    {it.desc}
                  </span>
                  <span className="mt-3 block text-xs font-semibold text-brand">무료로 보기 →</span>
                </a>
              </li>
            ))}
          </ul>

          {i === 0 && <AdSlot name="page_bottom" />}
        </section>
      ))}

      <section className="mt-16">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">지원금 찾는 김에</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            일자리를 찾는 중이라면 성격 유형이나 업무 스타일 테스트가 자기소개서 쓸 때 말거리가
            됩니다. 다만 테스트 결과를 그대로 옮겨 적기보다는, 결과를 보고 떠오른 실제 경험을
            쓰는 편이 낫습니다. 채용 담당자는 유형 이름이 아니라 사례를 봅니다.
          </p>
          <p>
            공공기관 채용이나 자격증 시험을 준비 중이라면 영어 문법 커리큘럼이 도움이 될 수
            있습니다. 토익·토플 점수가 가점에 들어가는 공고가 적지 않은데, 문법이 흔들리면
            점수가 잘 오르지 않습니다.
          </p>
          <p>
            소상공인 지원사업을 보고 계신다면 마케팅 용어 사전과 심리 효과 정리가 사업계획서
            쓸 때 쓰입니다. 심사위원이 아는 말로 적는 것만으로도 전달이 달라집니다.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/" className="btn btn-primary px-5 py-2.5">내 조건으로 지원금 찾기</Link>
          <Link href="/jobs" className="btn btn-ghost px-5 py-2.5">공공기관 채용 보기</Link>
        </div>
      </section>

      <Faq
        items={[
          {
            q: "정말 무료인가요? 나중에 결제하라고 하지 않나요?",
            a: "무료입니다. 가입도 결제도 없습니다. 운영비는 광고로 충당합니다. 결제 화면이 나오는 서비스는 여기 넣지 않습니다.",
          },
          {
            q: "심리 테스트 결과가 어디로 가나요?",
            a: "아무 데도 가지 않습니다. 답을 고르면 브라우저 안에서 계산해 바로 보여 줍니다. 서버로 보내지 않으니 저장되는 것도 없고, 창을 닫으면 사라집니다.",
          },
          {
            q: "이 테스트로 우울증 같은 것을 진단할 수 있나요?",
            a: "아닙니다. 공개된 척도를 쓰긴 하지만 진단이 아니라 자가점검입니다. 결과와 무관하게 힘든 상태가 이어진다면 정신건강복지센터(1577-0199)나 가까운 의료기관에 상담하세요. 상담 비용을 지원하는 지자체 사업도 지원금 목록에서 찾을 수 있습니다.",
          },
          {
            q: "영어 커리큘럼은 어디서부터 봐야 하나요?",
            a: "목차 맨 위부터 순서대로 보면 됩니다. 어디까지 봤는지 기억할 필요 없게 순서를 정해 뒀습니다. 중간부터 봐도 되지만, 앞 단원의 용어를 쓰는 곳이 있습니다.",
          },
        ]}
      />

      <RelatedLinks items={moneyRelated()} />
    </div>
  );
}
