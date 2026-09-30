import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import { ArtJeonse } from "@/components/Art";
import Faq from "@/components/Faq";
import JsonLd from "@/components/JsonLd";
import MidAd from "@/components/MidAd";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import ShareButton from "@/components/ShareButton";
import { Timeline } from "@/components/YouthSavingsArt";
import { jeonsePostRelated } from "@/lib/related";
import { ORG_ID, pageGraph } from "@/lib/schema";
import { SITE_URL } from "@/lib/seo";

/**
 * 전세 만기에 집주인이 집을 팔겠다고 했을 때, 버팀목 대출 세입자가 실제로
 * 한 일을 정리한 글. 제도 숫자(한도·금리·요건)는 2026년 9월에 확인한 값이고,
 * 사례의 금액은 한 세입자(A씨)의 경우다. 해마다 바뀌는 숫자는 기준일과 함께 적는다.
 */
export const revalidate = 86400;

const PATH = "/blog/jeonse-extension";
const UPDATED = "2026-09-30";
const TITLE = "버팀목 전세대출 1개월 연장, 연장 후 이사까지 — 한시적 연장 계약서·목적물 변경 실제 사례";
const DESC =
  "버팀목 전세대출을 1개월만 연장하고 이사하려면 한시적 연장 계약서로 기한연장한 뒤 잔금일에 목적물 " +
  "변경을 합니다. 집주인이 집을 판다고 한 HUG 청년버팀목 세입자의 실제 사례로 순서, 은행 서류, " +
  "10% 상환 대신 붙는 가산금리, 돈 계산까지 정리했습니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "버팀목 전세대출 1개월 연장", "버팀목 연장 후 이사", "버팀목 전세대출 연장", "버팀목 기한연장",
    "버팀목 목적물 변경", "HUG 청년 버팀목 전세대출 갱신", "주택도시기금 연장", "청년버팀목 이사",
    "한시적 연장 계약서", "전세 만기 집주인 매도", "전세대출 만기 이사 날짜", "묵시적 갱신 이사",
    "HUG 전세금안심대출보증 연장", "청년버팀목 조건 2026",
  ],
  alternates: { canonical: PATH },
  openGraph: {
    type: "article",
    url: `${SITE_URL}${PATH}`,
    title: TITLE,
    description: DESC,
    publishedTime: UPDATED,
    modifiedTime: UPDATED,
  },
};

const H2 = "sec-title text-[1.0625rem] font-extrabold";
const P = "mt-2 text-[15px] leading-[1.85] text-ink2";
const TH = "py-2 pr-3 font-semibold";
const TD = "py-2.5 pr-3 align-top";

const STEPS = [
  { when: "3월", what: "집주인이 먼저 매매 계획을 알림", detail: "만기에 이사할 생각이 있는지 물어봤습니다. 이때부터 이사 가능성을 두고 준비했습니다." },
  { when: "9월 중순 · 만기 2개월 전", what: "통화, 그리고 회신 없음", detail: "“매물로 내놨지만 연락이 없다, 주말에 부동산 확인하고 문자 주겠다.” 문자는 오지 않았습니다." },
  { when: "9월 23일", what: "문자 1 — 방향만 알려 달라", detail: "종료인지 연장인지만 연휴 끝나는 날까지 알려 달라고 했습니다. 답은 “매매 미정, 추석 지나고 연락”." },
  { when: "9월 29일", what: "문자 2 — 사정 설명", detail: "3월부터 준비해 왔고 이사면 평일 일정이 필요하다고 했습니다. 답은 “직접 입주하며 매도, 만기일에 보증금 반환”." },
  { when: "9월 30일", what: "문자 3 — 한 달만 늦춰 달라", detail: "새 집 입주일이 12월 중순이라 퇴거를 한 달 늦춰 달라고 했습니다. 답은 “편한 일정으로 퇴거해도 됨, 한시적 연장 계약서는 서명하겠다”." },
  { when: "10월 중순 (예정)", what: "은행에 한 달 기한연장 신청", detail: "종료일을 12월 11일로 적은 한시적 연장 계약서를 내고 대출 만기를 그날까지 늘립니다." },
  { when: "11월 중순 (예정)", what: "새 집으로 목적물 변경 신청", detail: "새 집 계약서·계약금 영수증·확정일자를 갖춰 같은 은행에 냅니다." },
  { when: "12월 11일 (예정)", what: "보증금 반환 → 잔금 → 전입신고", detail: "기존 집 보증금을 돌려받아 대출을 갚고, 새 대출과 본인 돈으로 잔금을 치릅니다." },
];

const RULES = [
  "감사와 안부로 시작합니다. 집주인이 먼저 연락했다면 그 점을 인정합니다.",
  "급한 이유를 “내 마음”이 아니라 “은행 절차”에 둡니다. 보증금 대부분이 대출금이라 일정을 마음대로 조정할 수 없다는 점을 밝힙니다.",
  "종료와 연장 중 어느 쪽이든 괜찮다고 말합니다. 매달리는 느낌을 없애고, 집주인이 답하기 쉽게 만듭니다.",
  "답변 기한을 날짜로 적습니다. “확인되시는 대로”는 며칠씩 밀립니다.",
  "법률 용어(묵시적 갱신, 대항력)는 문자에 쓰지 않습니다. 따지는 느낌이 나고, 나중에 쓸 카드를 미리 보여 주는 셈입니다.",
  "매도에 협조한다는 말이나 “팔리면 나가겠다”는 약속은 하지 않습니다. 대항력으로 지킬 권리를 스스로 내주는 문장이 됩니다.",
];

const CHECK = [
  "집주인에게 종료/연장 방향을 문자로 묻고, 답변 기한을 날짜로 넣는다",
  "대출 은행에 전화해 연장·이사 각각 필요한 서류와 신청 시기를 확인한다",
  "보증기관이 HUG인지 HF인지 확인한다 (필요 서류가 다르다)",
  "이사 쪽으로 기울면 계약금을 넣기 전에 집주인의 보증금 반환 날짜를 문자로 확답받는다",
  "새 집 후보는 등기부등본부터 확인하고, 그 주소로 은행 가심사를 받는다",
  "통화는 녹취하고 날짜를 적어 둔다 (묵시적 갱신 판단에 필요)",
  "애매한 법적 판단은 대한법률구조공단(132)에 무료로 확인한다",
];

const FAQ = [
  {
    q: "버팀목 전세대출을 쓰는데 이사 날짜가 만기보다 한 달 늦으면 어떻게 하나요?",
    a: "“1개월 연장” 상품이 따로 있는 게 아니라, 집주인과 종료일을 새 집 잔금일로 적은 한시적 연장 계약서를 쓰고 그 날짜까지 대출 기한연장을 신청합니다. 잔금일에는 목적물 변경으로 대출을 새 집으로 옮깁니다. 둘 다 대출받은 은행에서 처리합니다.",
  },
  {
    q: "기한연장하면 원금 10%를 갚아야 하나요?",
    a: "갚지 않으면 금리가 붙습니다. 보통 연 0.2%p이고, 연장 기간이 1년 이하(HUG 전세금안심대출보증은 1년 1개월 이하)면 연 0.1%p입니다. 한 달 연장이면 1억 원에 1만 원이 안 되므로 10% 상환보다 가산금리를 받는 쪽이 낫습니다.",
  },
  {
    q: "목적물 변경은 무엇이고 언제 신청하나요?",
    a: "기존 대출을 갚지 않고 담보가 되는 집만 새 집으로 바꾸는 절차입니다. 새 집 계약서, 계약금(보통 5% 이상) 영수증, 확정일자를 갖춰 대출받은 은행에 신청합니다. 은행마다 접수 시기가 조금씩 달라 기존 계약 만료 한 달 전쯤 은행에 먼저 물어보는 편이 안전합니다.",
  },
  {
    q: "집이 팔리면 세입자는 나가야 하나요?",
    a: "아닙니다. 전입신고와 거주를 유지하고 있으면 기존 계약은 새 집주인에게 그대로 넘어갑니다(주택임대차보호법 제3조). 새 집주인이 실거주하려 해도 계약 기간 중에는 나가라고 할 수 없습니다. 다만 집주인이 바뀌면 은행과 보증기관에 임대인 변경을 알려야 보증 효력이 유지됩니다.",
  },
  {
    q: "매수 희망자에게 집을 보여 줘야 하나요?",
    a: "계약서에 특약이 없으면 법적 의무는 없고, 거절해도 계약 해지 사유가 되지 않습니다. 다만 이사가 확정됐고 집주인이 매도 대금으로 보증금을 돌려줄 계획이라면, 협조하는 게 내 보증금을 빨리 받는 길일 수 있습니다.",
  },
  {
    q: "청년버팀목 대출 조건은 어떻게 되나요? (2026년 9월 기준)",
    a: "신청일 기준 만 19~34세(병역 이행 시 최대 만 39세), 부부합산 연소득 5,000만 원 이하, 순자산 3억 4,500만 원 이하인 무주택 세대주가 대상입니다. 보증금 3억 원 이하·전용 85㎡ 이하 주택에 보증금의 80% 이내로 빌리며, 수도권 한도는 2025년 6월 27일 대책 이후 2억 원에서 1억 5천만 원으로 줄었습니다. 기본금리는 연소득 2천만 원 이하 2.2%, 4천만 원 이하 2.5%, 6천만 원 이하 2.9%, 7천 5백만 원 이하 3.3%입니다.",
  },
];

export default function JeonseExtensionPage() {
  const ld = pageGraph({
    path: PATH,
    name: TITLE,
    description: DESC,
    dateModified: UPDATED,
    crumbs: [{ name: "지원금 안내", path: "/blog" }, { name: "버팀목 전세대출 1개월 연장" }],
    about: {
      "@type": "BlogPosting",
      "@id": `${SITE_URL}${PATH}#post`,
      headline: TITLE,
      description: DESC,
      dateModified: UPDATED,
      datePublished: UPDATED,
      inLanguage: "ko-KR",
      keywords: "버팀목 전세대출 연장, 버팀목 목적물 변경, 청년버팀목 이사, 전세 만기 집주인 매도, 한시적 연장 계약서",
      author: { "@id": ORG_ID },
      publisher: { "@id": ORG_ID },
      url: `${SITE_URL}${PATH}`,
    },
  });

  return (
    <article className="py-4">
      <JsonLd data={ld} />

      <nav aria-label="위치" className="text-[13px] text-muted">
        <Link href="/blog" className="hover:text-brand">지원금 안내</Link>
        {" · "}
        <span className="text-ink2">버팀목 전세대출 1개월 연장</span>
      </nav>

      <header className="mt-3">
        <h1 className="display text-[1.75rem] leading-tight">
          버팀목 전세대출 1개월 연장, 그리고 연장 후 이사
        </h1>
        <p className="num mt-2 text-xs text-faint">{UPDATED} 기준 · 실제 사례로 정리했습니다</p>
        <p className="mt-3 text-[15.5px] leading-[1.85] text-ink2">
          버팀목 전세대출은 “1개월 연장” 상품이 따로 없습니다. 집주인과 종료일을 새 집 잔금일로
          적은 한시적 연장 계약서를 쓰고 그날까지 기한연장한 뒤, 잔금일에 목적물 변경으로 대출을
          새 집에 옮기는 방식입니다. 전세 만기 두 달 전 집주인이 집을 팔겠다고 한 HUG 청년버팀목
          세입자 A씨의 사례로, 문자 세 통으로 퇴거를 한 달 늦추고 대출을 옮기기까지의 순서와
          은행 서류, 돈 계산을 정리했습니다.
        </p>
        <div className="mt-5 flex justify-center"><ArtJeonse /></div>
      </header>

      <section className="mt-8">
        <h2 className={H2}>한눈에</h2>
        <dl className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {[
            ["집이 팔려도", "전입신고·거주 중이면 계약은 새 집주인에게 승계됩니다"],
            ["만기와 이사 날짜가 다르면", "한시적 연장 계약서 → 기한연장 → 잔금일에 목적물 변경"],
            ["기한연장 비용", "원금 10% 안 갚으면 연 0.1~0.2%p 가산 · 한 달이면 1만 원 미만"],
            ["목적물 변경 서류", "새 집 계약서 · 계약금 5% 영수증 · 확정일자, 같은 은행에서"],
            ["집주인 문자", "기한을 날짜로, 이유는 은행 절차로, 어느 쪽이든 괜찮다고"],
            ["애매한 법적 판단", "대한법률구조공단 132, 무료"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-card bg-ground px-4 py-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 text-[14.5px] font-semibold leading-snug">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12">
        <h2 className={H2}>상황</h2>
        <p className={P}>
          A씨는 수도권 구축 아파트(엘리베이터 없는 6층)에 전세로 살던 30대 직장인입니다.
          보증금 1억 3,000만 원 중 1억 400만 원이 대출이라, 연장이든 이사든 집주인의 결정이
          먼저 나와야 은행 절차를 시작할 수 있었습니다. 집주인은 원거리에 살고, 집을 내놓았지만
          사겠다는 사람이 없어 답을 미루는 상태였습니다.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[22rem] border-collapse text-[13.5px]">
            <tbody>
              {[
                ["현재 집", "1995년 준공 아파트, 엘리베이터 없는 6층, 재건축 초기 단계"],
                ["보증금", "1억 3,000만 원 (대출 1억 400만 원 + 본인 2,600만 원)"],
                ["대출", "청년전용 버팀목 전세자금대출, HUG 전세금안심대출보증, 금리 2.6%"],
                ["임대차 만기", "11월 17일"],
                ["대출·보증 만기", "11월 18일"],
                ["연장 이력", "2년 전 1차 연장 (묵시적 갱신, 계약서 새로 안 씀)"],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-line">
                  <th scope="row" className="w-28 py-2.5 pr-3 text-left font-semibold">{k}</th>
                  <td className="py-2.5 text-ink2">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 rounded-card border-l-[3px] border-brand bg-brandSoft/50 px-4 py-3">
          <p className="text-[13.5px] leading-relaxed text-ink2">
            <b>대출 구조에서 오는 제약.</b> 연장하려면 만기 1개월 전부터 은행에 신청해야 하고,
            묵시적 갱신이라도 은행이 갱신계약 의향서나 임대인 날인을 요구할 수 있습니다. 이사하려면
            새 집 계약서, 계약금 5% 영수증, 확정일자가 있어야 대출을 옮길 수 있습니다. 어느 쪽이든
            집주인의 답이 먼저입니다.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className={H2}>진행 과정</h2>
        <p className={P}>
          3월에 집주인이 매도 계획을 처음 말한 뒤, 9월 말 문자 세 통으로 방향이 정해졌습니다.
          결과는 “만기 퇴거 + 한 달 연장”이었습니다. 집주인이 답을 미룬 기간은 약 2주. 세입자
          쪽에서 재촉하지 않으면 계속 미뤄질 수 있는 구조라, 문자에 기한을 넣은 것이 결정을
          끌어낸 계기가 됐습니다.
        </p>
        <Timeline steps={STEPS} />
      </section>

      <MidAd name="detail_mid" context="money" seed="jeonse-extension" className="mt-10" />

      <section className="mt-12">
        <h2 className={H2}>A씨가 집주인에게 보낸 문자 세 통</h2>
        <p className={P}>
          세 통에서 지킨 원칙은 하나였습니다. 재촉이 아니라 사정 설명으로 읽히게 하되, 기한은
          반드시 넣는다.
        </p>
        <ol className="mt-4 space-y-2.5 text-[15px] leading-[1.8] text-ink2">
          {RULES.map((t, i) => (
            <li key={t} className="flex gap-3">
              <span className="num mt-[3px] h-6 w-6 shrink-0 rounded-full bg-brandSoft text-center text-[13px] font-bold leading-6 text-brand">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>

        <h3 className="mt-8 text-[15px] font-bold">문자 1 · 방향 확인 (추석 직전)</h3>
        <blockquote className="mt-2 rounded-card border border-line bg-surface px-5 py-4 text-[14.5px] leading-[1.85] text-ink2">
          안녕하세요, 임대인님. ○○아파트 ○○호 세입자입니다. 내일부터 추석 연휴인데 편안한 한가위
          보내세요. 그동안 이 집에서 잘 지내고 있어 늘 감사한 마음입니다. 지난번 통화 때 말씀
          나눈 계약 건으로 조심스럽게 연락드립니다. 저희 전세대출과 보증보험 만기가 ○월 ○일이라,
          연휴 직후부터는 은행 절차를 진행해야 하는 상황입니다. 그래서 만기에 계약을 종료하실지,
          지금처럼 2년 더 연장해도 될지 방향을 여쭤보고자 합니다. 종료라면 저희도 연휴 직후부터
          다른 집을 알아보겠고, 연장이라면 은행 절차는 제가 번거롭지 않게 진행하겠습니다.
          재촉드리는 것 같아 송구하지만, 연휴가 끝나는 ○일까지 말씀해 주시면 큰 도움이 되겠습니다.
        </blockquote>

        <h3 className="mt-8 text-[15px] font-bold">문자 2 · 사정 설명 (기한이 지난 뒤)</h3>
        <blockquote className="mt-2 rounded-card border border-line bg-surface px-5 py-4 text-[14.5px] leading-[1.85] text-ink2">
          지난 3월에 매매 계획을 말씀해 주신 이후로 저희도 이사 가능성을 염두에 두고 준비해
          왔습니다. 이사를 하게 되면 매물 확인, 계약, 은행 일정을 평일에 빼두어야 해서 조금
          촉박한 상황입니다. 오늘과 내일도 매물을 보려고 연차를 빼둔 상태입니다. 가능하시면 어느
          방향으로 준비하면 될지만 말씀 부탁드립니다.
        </blockquote>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          “3월에 먼저 말씀해 주셔서 준비해 왔다”는 감사 표현이면서, 집주인이 먼저 퇴거 의사를
          비쳤다는 기록도 됩니다.
        </p>

        <h3 className="mt-8 text-[15px] font-bold">문자 3 · 한 달 연장 요청</h3>
        <blockquote className="mt-2 rounded-card border border-line bg-surface px-5 py-4 text-[14.5px] leading-[1.85] text-ink2">
          만기에 맞춰 이사하겠다고 말씀드렸는데 다시 연락드려 죄송합니다. 매물을 알아봤는데 입주
          가능한 날짜가 대부분 1~2월이고 가장 빠른 곳이 12월 중순이라 시간이 조금 더 필요합니다.
          혹시 가능하시다면 퇴거일을 ○월 ○일경으로 한 달 정도만 늦춰주실 수 있을까요? 보증금
          반환도 퇴거일에 맞춰 함께 미뤄지니 임대인님께서도 자금 준비에 여유가 생기실 것 같습니다.
          다만 전세대출을 이용 중이라 은행에 낼 한시적 연장 계약서가 필요합니다. 부동산에 오실
          필요 없이 제가 계약서를 준비해 편하신 시간에 찾아뵙고 서명만 받아오겠습니다.
        </blockquote>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          집주인에게 좋은 점(보증금 반환 한 달 유예)과 부담 최소화(직접 찾아가 서명)를 같이 넣은
          것이 통했습니다.
        </p>
      </section>

      <section className="mt-12">
        <h2 className={H2}>알아두면 흔들리지 않는 것</h2>
        <p className={P}>
          집이 팔려도 세입자는 불리하지 않습니다. 이 한 가지를 알고 있으면 집주인의 매도 소식에
          흔들릴 이유가 없습니다.
        </p>
        <div className="mt-5 space-y-6 text-[15px] leading-[1.85] text-ink2">
          <div>
            <h3 className="font-bold">대항력과 승계 (주택임대차보호법 제3조)</h3>
            <ul className="mt-2 space-y-1.5">
              {[
                "전입신고와 거주를 유지하면, 집이 팔려도 기존 계약은 새 집주인에게 그대로 넘어갑니다.",
                "새 집주인이 실거주하려 해도 계약 기간 중에는 나가라고 할 수 없습니다.",
                "새 집주인이 싫으면 매매 사실을 안 뒤 상당한 기간 안에 이의를 제기해 계약을 끝내고 기존 집주인에게 보증금을 청구할 수 있습니다.",
                "집주인이 바뀌면 은행과 보증기관에 임대인 변경을 알려야 보증 효력이 유지됩니다.",
              ].map((t) => <li key={t} className="flex gap-2.5"><span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden /><span>{t}</span></li>)}
            </ul>
          </div>
          <div>
            <h3 className="font-bold">묵시적 갱신</h3>
            <ul className="mt-2 space-y-1.5">
              {[
                "집주인이 만기 2개월 전까지 갱신 거절이나 조건 변경을 통지하지 않으면 같은 조건으로 2년 자동 연장됩니다.",
                "묵시적 갱신 상태에서 세입자는 언제든 3개월 전 통보로 나갈 수 있습니다. 새 2년 계약서를 쓰면 이 권리가 없습니다.",
                "반대로 이사할 때는 이 3개월 규정 때문에 만기일 반환이 당연하지 않을 수 있습니다. 집주인과 날짜를 합의해 문자로 남기는 게 중요합니다.",
                "“팔려고 내놨다”는 말이 갱신 거절 통지인지는 애매합니다. 확실하지 않으면 대한법률구조공단(132)에 통화 날짜와 내용을 말하고 확인받습니다.",
              ].map((t) => <li key={t} className="flex gap-2.5"><span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden /><span>{t}</span></li>)}
            </ul>
          </div>
          <div>
            <h3 className="font-bold">집 보여주기</h3>
            <ul className="mt-2 space-y-1.5">
              {[
                "계약서 특약이 없으면 매수 희망자에게 집을 보여 줄 법적 의무는 없습니다. 동의 없이 들어오면 주거침입입니다.",
                "거절해도 계약 해지 사유는 아닙니다.",
                "다만 이사가 확정됐고 집주인이 매도 대금으로 보증금을 돌려줄 계획이라면, 협조하는 게 내 보증금을 빨리 받는 길일 수 있습니다.",
              ].map((t) => <li key={t} className="flex gap-2.5"><span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden /><span>{t}</span></li>)}
            </ul>
          </div>
          <div>
            <h3 className="font-bold">HUG 보증과 재개발·재건축</h3>
            <ul className="mt-2 space-y-1.5">
              {[
                "전세금안심대출보증은 대출금뿐 아니라 임대차보증금 전액을 보증합니다. 집주인이 돈을 못 돌려줘도 HUG가 지급합니다.",
                "보증 기한은 임대차 계약 기간과 연동되어, 계약을 연장하면 보증도 함께 갱신해야 합니다.",
                "재개발 구역 세입자는 조건을 갖추면 주거이전비(가계지출비 4개월분)와 이사비를 받을 수 있습니다. 민간 재건축 세입자는 보통 대상이 아닙니다. 이 집은 재건축이라 해당이 없었습니다.",
              ].map((t) => <li key={t} className="flex gap-2.5"><span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden /><span>{t}</span></li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className={H2}>버팀목 전세대출 1개월 연장 절차 — 한시적 연장 계약서 + 연장 후 이사(목적물 변경)</h2>
        <p className={P}>
          대출 만기가 11월 18일인데 새 집 잔금이 12월 11일이면, 기존 대출을 12월 11일까지
          연장한 뒤 잔금일에 새 집으로 옮깁니다. 두 단계로 진행됩니다.
        </p>

        <h3 className="mt-6 text-[15px] font-bold">1단계 · 한시적 연장 계약서로 기한연장 (10월)</h3>
        <ul className="mt-2 space-y-2 text-[15px] leading-[1.85] text-ink2">
          {[
            "집주인과 종료일을 12월 11일로 명시한 한시적 연장 계약서를 씁니다. 보증금 반환일도 같은 날로 적습니다.",
            "“1개월 연장” 상품이 있는 게 아니라, 연장 기간을 계약 만기에 맞추는 방식입니다. 버팀목은 대출 만기를 전세 계약 만기에 맞추고, HUG 보증 대출의 만기는 임대차 만료일 + 1개월까지입니다.",
            "기한연장 때 원금의 10% 이상을 갚지 않으면 금리가 가산됩니다. 보통 연 0.2%p, 연장 기간이 1년 이하(HUG 전세금안심대출보증은 1년 1개월 이하)면 연 0.1%p입니다. 한 달이면 1만 원도 안 되니 10% 상환은 안 하는 게 낫습니다.",
            "은행에서 임대인의 국세·지방세 납세증명서를 요청할 수 있습니다. 홈택스·정부24에서 온라인 발급되니 집주인에게 미리 안내합니다.",
            "은행 창구가 묵시적 갱신에 임대인 날인을 요구하면, 보증기관 규정상 임대인 서명이 필수인지 먼저 확인합니다. 갱신계약 의향서 + 본인서명사실확인서로 처리한 전례가 있습니다.",
          ].map((t) => <li key={t} className="flex gap-2.5"><span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden /><span>{t}</span></li>)}
        </ul>

        <h3 className="mt-6 text-[15px] font-bold">2단계 · 목적물 변경 (11월)</h3>
        <ul className="mt-2 space-y-2 text-[15px] leading-[1.85] text-ink2">
          {[
            "목적물 변경은 기존 전세대출을 유지한 채 대출의 담보 주택만 새 집으로 바꾸는 것입니다. 중도상환수수료가 없습니다.",
            "만기 이후 이사라도 기존 대출을 유지하면 신규가 아니라 목적물 변경이며, 대출받은 같은 은행에서만 됩니다. 접수 시기는 은행마다 조금 다르니 기존 계약 만료 한 달 전쯤 먼저 물어봅니다.",
            "새 집 계약서, 계약금 5% 이상 납부 영수증, 확정일자가 있어야 신청할 수 있습니다.",
            "보증금이 커지면 증액도 가능하고, 증액분만 새로 심사합니다.",
            "은행 안내: 대출 만기가 계약 만기보다 앞서고 새 집 잔금이 그 뒤인 경우, 계약 만기까지 먼저 연장한 뒤 목적물 변경 때 추가 연장이 됩니다. 잔금 직전까지 연장해 두고 잔금 직후 바로 목적물 변경을 신청해 금리 변동을 한 번으로 끝내라는 것이 A씨가 은행에서 들은 조언입니다.",
          ].map((t) => <li key={t} className="flex gap-2.5"><span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden /><span>{t}</span></li>)}
        </ul>

        <h3 className="mt-6 text-[15px] font-bold">이사 당일 돈 흐름 (12월 11일)</h3>
        <ol className="mt-2 space-y-1.5 text-[15px] leading-[1.85] text-ink2">
          {[
            "기존 집 집주인이 보증금 1억 3,000만 원 반환 (대출분은 은행으로)",
            "기존 대출 1억 400만 원 상환, 본인 돈 2,600만 원 회수",
            "새 대출 실행 + 본인 돈으로 새 집 잔금",
            "당일 주민센터 전입신고, 새 등본을 은행에 제출",
          ].map((t, i) => (
            <li key={t} className="flex gap-3">
              <span className="num mt-[3px] h-6 w-6 shrink-0 rounded-full bg-brandSoft text-center text-[13px] font-bold leading-6 text-brand">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className={H2}>청년버팀목 요건 (2026년 9월 확인)</h2>
        <p className={P}>
          이사하면 새 집 기준으로 다시 봅니다. 나이는 신청일 기준이라, 만 34세가 끝나 가면 이사
          시점 자체가 대출을 좌우합니다.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[24rem] border-collapse text-[13.5px]">
            <tbody>
              {[
                ["나이", "신청일 기준 만 19~34세 (병역 이행 시 최대 만 39세)"],
                ["소득", "부부합산 연 5,000만 원 이하 (미혼이면 본인만)"],
                ["순자산", "3억 4,500만 원 이하 (2026년 기준)"],
                ["주택", "임차보증금 3억 원 이하, 전용 85㎡ 이하"],
                ["한도", "보증금의 80% 이내. 수도권은 2025년 6월 27일 대책 이후 2억 → 1억 5천만 원"],
                ["기본금리", "연소득 2천만 원 이하 2.2% · 4천만 원 이하 2.5% · 6천만 원 이하 2.9% · 7천 5백만 원 이하 3.3%"],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-line">
                  <th scope="row" className="w-24 py-2.5 pr-3 text-left font-semibold">{k}</th>
                  <td className="py-2.5 text-ink2">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          재직 1년 미만이어도 1개월 이상 재직하면 급여를 연환산해 소득을 봅니다. 대출 신청일부터
          실행일까지 같은 회사에 다니고 있어야 합니다. 우대금리와 은행별 차이는{" "}
          <Link href="/money/jeonse" className="underline underline-offset-4 hover:text-brand">
            전세자금대출 은행별 금리 비교
          </Link>
          에서 보세요.
        </p>
      </section>

      <section className="mt-12">
        <h2 className={H2}>돈 계산</h2>
        <p className={P}>
          1억 3,000만 원 집에서 1억 8,500만 원 집으로 옮기면, 이사 당일 본인 돈은 딱 맞고 매달
          고정비는 약 15만 원 늘어납니다.
        </p>
        <figure className="mt-5 overflow-x-auto">
          <figcaption className="text-[13.5px] font-semibold text-ink2">이사 당일 필요한 돈 (새 집 1억 8,500만 원)</figcaption>
          <table className="mt-3 w-full min-w-[22rem] border-collapse text-[13.5px]">
            <tbody>
              {[
                ["쓸 수 있는 돈", "3,950만", "보유 현금 1,150 + 두 달 저축 200 + 회수 2,600"],
                ["새 집 본인 몫 (20%)", "-3,700만", ""],
                ["새 대출 (80%)", "1억 4,800만", "청년버팀목 수도권 한도 안"],
                ["중개보수 (0.3% + 부가세)", "약 -60만", ""],
                ["이사비 + 입주청소", "약 -150~200만", "견적 2~3곳 비교"],
                ["남는 돈", "약 -10~+40만", ""],
              ].map(([k, v, n]) => (
                <tr key={k} className="border-b border-line">
                  <th scope="row" className={`${TD} text-left font-semibold`}>{k}</th>
                  <td className={`num ${TD} whitespace-nowrap font-semibold`}>{v}</td>
                  <td className={`${TD} text-muted`}>{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            계약금 5%(약 925만 원)는 기존 집 보증금을 돌려받기 전에 내야 하므로 보유 현금에서
            먼저 나갑니다. 비상금이 0에 가까워지니 12월 월급이 잔금 전에 들어오는지 확인해
            두는 게 좋습니다.
          </p>
        </figure>

        <figure className="mt-8 overflow-x-auto">
          <figcaption className="text-[13.5px] font-semibold text-ink2">매달 고정비 변화</figcaption>
          <table className="mt-3 w-full min-w-[24rem] border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b-2 border-line2 text-left text-[12.5px] text-muted">
                <th className={TH}>항목</th><th className={TH}>기존 집</th><th className={TH}>새 집</th><th className={TH}>차이</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["대출금", "1억 400만", "1억 4,800만", "+4,400만"],
                ["이자 (2.6%)", "약 22.5만", "약 32.1만", "+9.6만"],
                ["관리비", "8만 (정액)", "약 14만 (사용료 포함)", "+6만"],
                ["합계", "약 30.5만", "약 46.1만", "+15.6만"],
              ].map((r) => (
                <tr key={r[0]} className="border-b border-line">
                  <th scope="row" className={`${TD} text-left font-semibold`}>{r[0]}</th>
                  <td className={`num ${TD}`}>{r[1]}</td>
                  <td className={`num ${TD}`}>{r[2]}</td>
                  <td className={`num ${TD} font-semibold`}>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            새 대출 금리는 소득 구간으로 다시 정해지므로 2.6%와 다를 수 있습니다. 이자 외에 HUG
            보증료가 1년에 한 번 나갑니다.
          </p>
        </figure>

        <div className="mt-6 rounded-card border-l-[3px] border-brand bg-brandSoft/50 px-4 py-3">
          <p className="text-[13.5px] leading-relaxed text-ink2">
            <b>남는 것 vs 이사하는 것.</b> 돈만 보면 남는 쪽이 2년에 500~600만 원 유리했습니다.
            그래도 A씨가 이사를 택한 이유는 엘리베이터 없는 6층, 집주인의 실거주 결정, 그리고 청년버팀목
            나이 요건이 곧 끝나서 새 집으로 청년 대출을 받을 수 있는 시기가 사실상 마지막이었기
            때문입니다. 지자체가 따로 얹어 주는 전세 지원은{" "}
            <Link href="/housing/jeonse/youth" className="underline underline-offset-4 hover:text-brand">
              청년 전세자금 대출이자 지원
            </Link>
            에 모아 두었습니다.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className={H2}>새 집 고를 때 확인한 것</h2>
        <p className={P}>
          등기부 을구가 비어 있고 소유자가 20년 넘게 보유한 집이라 보증금 안전성은 좋았습니다.
          대신 전세가율이 높아 HUG 보증이 되는지 계약 전에 확인해야 했습니다.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b-2 border-line2 text-left text-[12.5px] text-muted">
                <th className={TH}>항목</th><th className={TH}>내용</th><th className={TH}>판단</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["전세가", "1억 8,500만 원", "최근 전세 실거래보다 약 500만 원 높음"],
                ["등기부 갑구", "개인 1인 소유, 2003년부터 보유", "갭투자 매물 아님"],
                ["등기부 을구", "기록사항 없음 (근저당·압류 없음)", "가장 중요한 부분, 통과"],
                ["매매 시세", "같은 평형 약 2억 1,000~2,400만 원", "전세가율 약 80~86%, 높은 편"],
                ["면적", "전용 48.84㎡ (약 15평), 방 2 + 욕실 1", "2인 거주 무난"],
                ["층", "2층, 20층 건물", "계단 부담 없음"],
                ["준공", "1995년", "결로·배관·샷시 확인 필요"],
                ["관리비", "정액 8만 + 사용료, 평균 약 14만", "겨울 난방비 추가 예상"],
              ].map((r) => (
                <tr key={r[0]} className="border-b border-line">
                  <th scope="row" className={`${TD} text-left font-semibold`}>{r[0]}</th>
                  <td className={`${TD} text-ink2`}>{r[1]}</td>
                  <td className={`${TD} text-muted`}>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-6 text-[15px] font-bold">계약 전 순서</h3>
        <ol className="mt-2 space-y-1.5 text-[15px] leading-[1.85] text-ink2">
          {[
            "인터넷등기소에서 등기부등본 열람 (700원). 을구에 근저당이 있으면 금액과 순위 확인.",
            "그 주소로 은행 가심사. 대출 한도와 HUG 보증 가능 여부, 예상 금리를 받아 둔다.",
            "집 보러 갈 때 베란다 벽 모서리·창틀 결로, 수압·온수, 방범창, 외풍을 확인한다.",
            "계약서 특약에 “전세대출 및 보증보험 불가 시 계약금 전액 반환”을 넣는다.",
            "잔금일을 기존 집 보증금 반환일과 같은 날로 맞춘다.",
            "계약 당일 확정일자를 받는다.",
          ].map((t, i) => (
            <li key={t} className="flex gap-3">
              <span className="num mt-[3px] h-6 w-6 shrink-0 rounded-full bg-brandSoft text-center text-[13px] font-bold leading-6 text-brand">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
          퇴거 정산: 관리비와 공과금은 이사 당일 기준으로 정산합니다. 관리비에 포함해 낸
          장기수선충당금은 집주인에게 돌려받을 수 있으니 관리사무소에서 납부 내역을 떼 둡니다.
        </p>
      </section>

      <section className="mt-12">
        <h2 className={H2}>만기 2개월 전 체크리스트</h2>
        <ul className="mt-4 space-y-2.5 text-[15px] leading-[1.8] text-ink2">
          {CHECK.map((t) => (
            <li key={t} className="flex gap-3">
              <span className="mt-[5px] flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-brand text-brand" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className={H2}>이 사례에서 배울 것</h2>
        <ol className="mt-4 space-y-2.5 text-[15px] leading-[1.85] text-ink2">
          {[
            "집주인의 결정을 기다리기만 하면 은행 일정이 먼저 끝납니다. 기한을 정해 묻는 건 무례가 아니라 필요한 일입니다.",
            "급한 이유를 “은행 대출 구조” 탓으로 두면 관계를 해치지 않으면서 결정을 끌어낼 수 있습니다.",
            "집주인에게 요청할 때는 상대에게 좋은 점(보증금 반환 유예)과 부담 최소화(직접 찾아가 서명)를 함께 말합니다.",
            "만기와 이사 날짜가 안 맞으면 한시적 연장 계약서 + 목적물 변경으로 해결됩니다. 처음부터 알았다면 덜 불안했을 겁니다.",
            "청년 대출은 나이 요건이 있어서, 언제 이사하느냐에 따라 받을 수 있는 대출이 달라집니다. 이사 시점 자체가 재테크 결정입니다.",
          ].map((t, i) => (
            <li key={t} className="flex gap-3">
              <span className="num mt-[3px] h-6 w-6 shrink-0 rounded-full bg-brandSoft text-center text-[13px] font-bold leading-6 text-brand">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </section>

      <Faq items={FAQ} />

      <section className="mt-12">
        <h2 className={H2}>확인한 곳</h2>
        <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-ink2">
          {[
            ["주택도시기금 청년전용 버팀목전세자금", "https://nhuf.molit.go.kr/FP/FP05/FP0502/FP05020701.jsp"],
            ["HUG 전세금안심대출보증 안내", "https://www.khug.or.kr/hug/web/ig/dl/igdl000001.jsp"],
            ["HUG 조건변경(기한연장·목적물 변경) 안내", "https://www.khug.or.kr/khmb/m/hg/gg/prop/propsub5.jsp"],
            ["HF 한국주택금융공사 조건변경 안내", "https://www.hf.go.kr/ko/sub02/sub02_01_08.do"],
            ["마이홈포털 청년전용 버팀목 전세자금대출", "https://www.myhome.go.kr/hws/portal/cont/selectYouthPolicyYouthOnlyCrutchLoanView.do"],
          ].map(([label, href]) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-brand">{label}</a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          이 글의 법·금융 내용은 실제 사례와 2026년 9월 30일에 확인한 공개 자료를 정리한
          것입니다. 사례의 금액과 날짜는 A씨의 경우이고, 한도·금리·요건은 해마다 바뀝니다.
          각자 상황은 대출받은 은행과 법률 상담(대한법률구조공단 132)으로 확인하세요.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/money/jeonse" className="btn btn-primary px-5 py-3">
          전세대출 은행별 금리 비교
        </Link>
        <Link href="/housing/jeonse/youth" className="btn px-5 py-3">
          청년 전세 지원 사업 보기
        </Link>
        <ShareButton title={TITLE} />
      </div>

      <AdSlot name="post_bottom" />

      <PromoBanner placement="jeonse-extension" context="money" />
      <RelatedLinks items={jeonsePostRelated()} />
    </article>
  );
}
