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
import Toc from "@/components/Toc";
import { Timeline } from "@/components/YouthSavingsArt";
import { jeonsePostRelated } from "@/lib/related";
import { ORG_ID, pageGraph } from "@/lib/schema";
import { SITE_URL } from "@/lib/seo";

/**
 * 블로그 글. 전세 만기에 집주인이 집을 팔겠다고 할 때 버팀목 대출 세입자가
 * 어떻게 움직이면 되는지를 안내한다. 사례는 여러 경우를 섞어 각색한 것이고,
 * 제도 숫자(한도·금리·요건)는 2026년 9월에 확인한 값이다. 해마다 바뀌는
 * 숫자는 기준일과 함께 적는다.
 */
export const revalidate = 86400;

const PATH = "/story/jeonse-extension";
const UPDATED = "2026-10-02";
const TITLE = "버팀목 전세대출 1개월 연장, 연장 후 이사까지 — 집주인이 집을 판다고 할 때 세입자가 할 일";
const DESC =
  "버팀목 전세대출을 1개월만 연장하고 이사하려면 한시적 연장 계약서로 기한연장한 뒤 잔금일에 목적물 " +
  "변경을 합니다. 집주인이 집을 판다고 할 때 집주인에게 보낼 문자, 은행 서류, 10% 상환 대신 붙는 " +
  "가산금리, 돈 계산까지 순서대로 안내합니다.";

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
    publishedTime: "2026-09-30",
    modifiedTime: UPDATED,
  },
};

const H2 = "sec-title text-[1.0625rem] font-extrabold";
const P = "mt-2 text-[15px] leading-[1.85] text-ink2";
const TH = "py-2 pr-3 font-semibold";
const TD = "py-2.5 pr-3 align-top";
const Dot = () => <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />;
const Num = ({ i }: { i: number }) => (
  <span className="num mt-[3px] h-6 w-6 shrink-0 rounded-full bg-brandSoft text-center text-[13px] font-bold leading-6 text-brand">{i + 1}</span>
);

const STEPS = [
  { when: "만기 2개월 전", what: "집주인에게 방향을 묻는다", detail: "종료인지 연장인지만, 답할 날짜를 정해 문자로 묻습니다. 보증금 대부분이 대출이면 은행 절차가 먼저 돌아가므로 이 시점을 넘기지 않습니다." },
  { when: "답이 없으면 일주일 뒤", what: "사정을 설명하며 다시 묻는다", detail: "재촉이 아니라 사정 설명으로 읽히게 씁니다. 이사라면 평일 일정을 빼야 한다는 점을 알립니다." },
  { when: "방향이 정해지면", what: "새 집을 알아보고 입주일을 맞춘다", detail: "입주 가능한 날짜가 만기보다 늦으면 여기서 한 달 연장을 요청합니다. 집주인에게도 보증금 반환이 한 달 늦춰지는 이점이 있습니다." },
  { when: "만기 1개월 전", what: "은행에 기한연장 신청", detail: "종료일을 새 집 잔금일로 적은 한시적 연장 계약서를 내고 대출 만기를 그날까지 늘립니다." },
  { when: "새 집 계약 뒤", what: "목적물 변경 신청", detail: "새 집 계약서, 계약금 영수증, 확정일자를 갖춰 대출받은 은행에 냅니다. 기존 대출은 그대로 두고 담보 주택만 바꿉니다." },
  { when: "잔금일", what: "보증금 반환 → 잔금 → 전입신고", detail: "기존 집 보증금을 돌려받아 대출을 갚고, 새 대출과 본인 돈으로 잔금을 치른 뒤 그날 전입신고를 합니다." },
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
    crumbs: [{ name: "블로그", path: "/story" }, { name: "버팀목 전세대출 1개월 연장" }],
    about: {
      "@type": "BlogPosting",
      "@id": `${SITE_URL}${PATH}#post`,
      headline: TITLE,
      description: DESC,
      dateModified: UPDATED,
      datePublished: "2026-09-30",
      inLanguage: "ko-KR",
      keywords: "버팀목 전세대출 1개월 연장, 버팀목 연장 후 이사, 버팀목 목적물 변경, 청년버팀목 이사, 한시적 연장 계약서",
      author: { "@id": ORG_ID },
      publisher: { "@id": ORG_ID },
      url: `${SITE_URL}${PATH}`,
    },
  });

  return (
    <article className="py-4">
      <JsonLd data={ld} />

      <nav aria-label="위치" className="text-[13px] text-muted">
        <Link href="/story" className="hover:text-brand">블로그</Link>
        {" · "}
        <span className="text-ink2">버팀목 전세대출 1개월 연장</span>
      </nav>

      <header className="mt-3">
        <h1 className="display text-[1.75rem] leading-tight">
          버팀목 전세대출 1개월 연장, 그리고 연장 후 이사
        </h1>
        <p className="num mt-2 text-xs text-faint">{UPDATED} 기준 · 사례는 여러 경우를 섞어 각색했습니다</p>
        <p className="mt-3 text-[15.5px] leading-[1.85] text-ink2">
          <strong>버팀목 전세대출</strong>에는 “1개월 연장” 상품이 따로 없습니다. 집주인과 종료일을 새 집 잔금일로
          적은 <strong>한시적 연장 계약서</strong>를 쓰고 그날까지 <strong>기한연장</strong>한 뒤, 잔금일에{" "}
          <a href="#procedure" className="underline underline-offset-4 decoration-brand/40 hover:text-brand"><strong>목적물 변경</strong></a>으로 대출을
          새 집에 옮기는 방식입니다. 전세 만기를 앞두고 집주인이 집을 팔겠다고 할 때{" "}
          <a href="#steps" className="underline underline-offset-4 decoration-brand/40 hover:text-brand">어떤 순서로 움직이면 되는지</a>,{" "}
          <a href="#messages" className="underline underline-offset-4 decoration-brand/40 hover:text-brand">집주인에게 보낼 문자</a>와 은행 서류,{" "}
          <a href="#money" className="underline underline-offset-4 decoration-brand/40 hover:text-brand">돈 계산</a>까지 차례로 안내합니다.
        </p>
        <div className="mt-5 flex justify-center"><ArtJeonse /></div>
      </header>

      <Toc items={[{ id: "glance", label: "한눈에" }, { id: "when", label: "이런 상황에서 씁니다" }, { id: "steps", label: "순서대로 하면 됩니다" }, { id: "messages", label: "집주인에게 보낼 문자, 이렇게" }, { id: "facts", label: "알아두면 흔들리지 않는 것" }, { id: "procedure", label: "1개월 연장 절차 (한시적 연장 + 목적물 변경)" }, { id: "requirements", label: "청년버팀목 요건 (2026년 9월 확인)" }, { id: "money", label: "돈 계산은 이렇게" }, { id: "newhome", label: "새 집 고를 때 확인할 것" }, { id: "checklist", label: "만기 2개월 전 체크리스트" }, { id: "summary", label: "정리" }, { id: "faq", label: "자주 묻는 질문" }, { id: "sources", label: "확인한 곳" }]} />

      <section id="glance" className="mt-8 scroll-mt-24">
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

      <section id="when" className="mt-12 scroll-mt-24">
        <h2 className={H2}>이런 상황에서 씁니다</h2>
        <p className={P}>
          전세 만기를 두 달쯤 앞둔 어느 날, 집주인에게서 연락이 옵니다. 집을 내놓을 생각인데
          만기에 나가 줄 수 있겠느냐는 말입니다. 보증금의 대부분이{" "}
          <a href="#requirements" className="underline underline-offset-4 decoration-brand/40 hover:text-brand"><strong>청년버팀목</strong> 대출</a>이라면 세입자
          쪽은 일정을 마음대로 정할 수 없습니다. 연장하려면 <strong>만기 한 달 전</strong>부터 은행에 신청해야
          하고, 이사하려면 새 집 계약서와 <strong>확정일자</strong>가 있어야 대출을 옮길 수 있습니다. 어느 쪽이든
          집주인의 결정이 먼저 나와야 움직일 수 있는데, 집주인은 매매가 정해지지 않았다며 답을
          미룹니다.
        </p>
        <p className={P}>
          여기서 갈 수 있는 길은 셋입니다. 그대로 2년 연장하거나, 만기에 맞춰 이사하거나, 새 집
          입주일이 만기보다 늦으면 한 달쯤 늦춰 이사하는 것입니다. 이 글은 세 번째 길을 고른
          세입자의 흐름을 따라갑니다. 집주인이 답을 미루는 동안 문자 몇 통으로 방향을 끌어내고,
          한 달 연장 합의를 받아 대출을 새 집으로 옮기는 과정입니다. 금액과 날짜는 여러 경우를
          섞어 각색한 것이니 흐름으로 읽어 주세요.
        </p>
        <div className="mt-4 rounded-card border-l-[3px] border-brand bg-brandSoft/50 px-4 py-3">
          <p className="text-[13.5px] leading-relaxed text-ink2">
            <b>먼저 확인할 것.</b> 대출의 보증기관이{" "}
            <a href="https://www.khug.or.kr/hug/web/ig/dl/igdl000001.jsp" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 decoration-brand/40 hover:text-brand">HUG(전세금안심대출보증)</a>인지{" "}
            <a href="https://www.hf.go.kr/ko/sub02/sub02_01_08.do" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 decoration-brand/40 hover:text-brand">HF(주택금융공사)</a>인지에
            따라 연장·변경 서류가 다릅니다. 대출 만기가 임대차 만기와 같은 날인지도 봅니다. HUG
            보증 대출은 보통 임대차 만료일 + 1개월이 대출 만기입니다.
          </p>
        </div>
      </section>

      <section id="steps" className="mt-12 scroll-mt-24">
        <h2 className={H2}>순서대로 하면 됩니다</h2>
        <p className={P}>
          핵심은 두 가지입니다. <strong>집주인에게는 기한을 정해 묻고</strong>, <strong>은행에는 서류를 먼저 확정한 뒤</strong>
          요청합니다. 문자 쓰는 법은 <a href="#messages" className="underline underline-offset-4 decoration-brand/40 hover:text-brand">아래 예시</a>, 은행 절차는{" "}
          <a href="#procedure" className="underline underline-offset-4 decoration-brand/40 hover:text-brand">1개월 연장 절차</a>에 있습니다. 집주인이 답을 미루는 동안 은행 일정이 먼저 끝나 버리는 것이 가장 흔한
          실패입니다.
        </p>
        <Timeline steps={STEPS} />
      </section>

      <MidAd name="detail_mid" context="money" seed="jeonse-extension" className="mt-10" />

      <section id="messages" className="mt-12 scroll-mt-24">
        <h2 className={H2}>집주인에게 보낼 문자, 이렇게</h2>
        <p className={P}>
          지킬 원칙은 하나입니다. 재촉이 아니라 사정 설명으로 읽히게 하되, 기한은 반드시 넣습니다.
          아래 예시는 ○○ 자리에 날짜와 호수를 넣어 그대로 써도 됩니다. 말투는 평소 집주인과
          주고받던 대로 바꾸세요.
        </p>
        <ol className="mt-4 space-y-2.5 text-[15px] leading-[1.8] text-ink2">
          {RULES.map((t, i) => <li key={t} className="flex gap-3"><Num i={i} /><span>{t}</span></li>)}
        </ol>

        <h3 className="mt-8 text-[15px] font-bold">문자 예시 1 · 방향 확인 (만기 2개월 전)</h3>
        <blockquote className="mt-2 rounded-card border border-line bg-surface px-5 py-4 text-[14.5px] leading-[1.85] text-ink2">
          안녕하세요, 임대인님. ○○아파트 ○○호에 사는 세입자입니다. 덕분에 이 집에서 잘 지내고
          있습니다. 얼마 전 말씀하신 매매 건과 관련해 한 가지 여쭙고 싶어 연락드립니다. 저희는
          전세대출을 쓰고 있어서 만기(○월 ○일) 한 달 전에는 은행에 연장이든 이사든 서류를 내야
          합니다. 그래서 만기에 계약을 마무리하실 생각이신지, 아니면 지금처럼 더 계셔도 되는지
          방향만 먼저 알려 주시면 감사하겠습니다. 어느 쪽이든 저희는 맞춰 준비하겠습니다. 번거로우시겠지만
          ○월 ○일까지 답 주시면 은행 일정에 맞출 수 있을 것 같습니다.
        </blockquote>

        <h3 className="mt-8 text-[15px] font-bold">문자 예시 2 · 사정 설명 (기한이 지난 뒤)</h3>
        <blockquote className="mt-2 rounded-card border border-line bg-surface px-5 py-4 text-[14.5px] leading-[1.85] text-ink2">
          지난번 매매 말씀을 듣고 저희도 이사 쪽으로 미리 알아보고 있습니다. 다만 이사를 하려면
          집 보러 다니는 날과 계약, 은행 방문을 평일에 잡아야 해서 일정이 빠듯합니다. 결정이
          어려우시면 지금 생각하시는 방향만이라도 알려 주시면 그에 맞춰 움직이겠습니다.
        </blockquote>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          “말씀을 듣고 준비하고 있다”는 한마디는 감사 표현이면서, 집주인이 먼저 퇴거 뜻을 비쳤다는
          기록도 됩니다. 통화 대신 문자로 남기는 이유입니다.
        </p>

        <h3 className="mt-8 text-[15px] font-bold">문자 예시 3 · 한 달 연장 요청</h3>
        <blockquote className="mt-2 rounded-card border border-line bg-surface px-5 py-4 text-[14.5px] leading-[1.85] text-ink2">
          만기에 맞춰 나가겠다고 말씀드렸는데, 사정이 생겨 다시 연락드립니다. 알아본 집들의
          입주일이 대부분 만기보다 한 달쯤 늦어서, 퇴거일을 ○월 ○일 무렵으로 조금만 미뤄 주실 수
          있을지 여쭙습니다. 보증금 반환도 그날에 맞추면 되니 임대인님 자금 준비에도 여유가
          생기실 것 같습니다. 전세대출 은행에 낼 한시적 연장 계약서가 한 장 필요한데, 제가 준비해서
          편하신 시간에 찾아뵙고 서명만 받겠습니다. 부동산에 나오실 필요는 없습니다.
        </blockquote>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          집주인에게 좋은 점(보증금 반환 한 달 유예)과 부담 최소화(직접 찾아가 서명)를 같이 넣는
          것이 요령입니다. 요청만 있고 상대의 이점이 없는 문자는 답이 늦습니다.
        </p>
      </section>

      <section id="facts" className="mt-12 scroll-mt-24">
        <h2 className={H2}>알아두면 흔들리지 않는 것</h2>
        <p className={P}>
          <strong>집이 팔려도 세입자는 불리하지 않습니다.</strong> <strong>대항력</strong>과 <strong>묵시적 갱신</strong>,
          이 두 가지를 알고 있으면 집주인의 매도 소식에 흔들릴 이유가 없습니다.
        </p>
        <div className="mt-5 space-y-6 text-[15px] leading-[1.85] text-ink2">
          {[
            ["대항력과 승계 (주택임대차보호법 제3조)", [
              "전입신고와 거주를 유지하면, 집이 팔려도 기존 계약은 새 집주인에게 그대로 넘어갑니다.",
              "새 집주인이 실거주하려 해도 계약 기간 중에는 나가라고 할 수 없습니다.",
              "새 집주인이 싫으면 매매 사실을 안 뒤 상당한 기간 안에 이의를 제기해 계약을 끝내고 기존 집주인에게 보증금을 청구할 수 있습니다.",
              "집주인이 바뀌면 은행과 보증기관에 임대인 변경을 알려야 보증 효력이 유지됩니다.",
            ]],
            ["묵시적 갱신", [
              "집주인이 만기 2개월 전까지 갱신 거절이나 조건 변경을 통지하지 않으면 같은 조건으로 2년 자동 연장됩니다.",
              "묵시적 갱신 상태에서 세입자는 언제든 3개월 전 통보로 나갈 수 있습니다. 새 2년 계약서를 쓰면 이 권리가 없습니다.",
              "반대로 이사할 때는 이 3개월 규정 때문에 만기일 반환이 당연하지 않을 수 있습니다. 집주인과 날짜를 합의해 문자로 남기는 게 중요합니다.",
              "“팔려고 내놨다”는 말이 갱신 거절 통지인지는 애매합니다. 확실하지 않으면 대한법률구조공단(132)에 통화 날짜와 내용을 말하고 확인받습니다.",
            ]],
            ["집 보여주기", [
              "계약서 특약이 없으면 매수 희망자에게 집을 보여 줄 법적 의무는 없습니다. 동의 없이 들어오면 주거침입입니다.",
              "거절해도 계약 해지 사유는 아닙니다.",
              "다만 이사가 확정됐고 집주인이 매도 대금으로 보증금을 돌려줄 계획이라면, 협조하는 게 내 보증금을 빨리 받는 길일 수 있습니다.",
            ]],
            ["HUG 보증과 재개발·재건축", [
              "전세금안심대출보증은 대출금뿐 아니라 임대차보증금 전액을 보증합니다. 집주인이 돈을 못 돌려줘도 HUG가 지급합니다.",
              "보증 기한은 임대차 계약 기간과 연동되어, 계약을 연장하면 보증도 함께 갱신해야 합니다.",
              "재개발 구역 세입자는 조건을 갖추면 주거이전비(가계지출비 4개월분)와 이사비를 받을 수 있습니다. 민간 재건축 세입자는 보통 대상이 아닙니다.",
            ]],
          ].map(([h, items]) => (
            <div key={h as string}>
              <h3 className="font-bold">{h}</h3>
              <ul className="mt-2 space-y-1.5">
                {(items as string[]).map((t) => <li key={t} className="flex gap-2.5"><Dot /><span>{t}</span></li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="procedure" className="mt-12 scroll-mt-24">
        <h2 className={H2}>버팀목 전세대출 1개월 연장 절차 — 한시적 연장 계약서 + 연장 후 이사(목적물 변경)</h2>
        <p className={P}>
          대출 만기가 계약 만기와 비슷한데 새 집 잔금이 그보다 한 달쯤 뒤라면, 기존 대출을
          잔금일까지 <strong>기한연장</strong>한 뒤 잔금일에 <strong>목적물 변경</strong>으로 새 집에 옮깁니다. 두 단계로
          진행되고, 어느 쪽도 <a href="#requirements" className="underline underline-offset-4 decoration-brand/40 hover:text-brand">청년버팀목 요건</a>을 새 집 기준으로 다시 봅니다.
        </p>

        <h3 className="mt-6 text-[15px] font-bold">1단계 · 한시적 연장 계약서로 기한연장</h3>
        <ul className="mt-2 space-y-2 text-[15px] leading-[1.85] text-ink2">
          {[
            "집주인과 종료일을 새 집 잔금일로 명시한 한시적 연장 계약서를 씁니다. 보증금 반환일도 같은 날로 적습니다.",
            "“1개월 연장” 상품이 있는 게 아니라, 연장 기간을 계약 만기에 맞추는 방식입니다. 버팀목은 대출 만기를 전세 계약 만기에 맞추고, HUG 보증 대출의 만기는 임대차 만료일 + 1개월까지입니다.",
            "기한연장 때 원금의 10% 이상을 갚지 않으면 금리가 가산됩니다. 보통 연 0.2%p, 연장 기간이 1년 이하(HUG 전세금안심대출보증은 1년 1개월 이하)면 연 0.1%p입니다. 한 달이면 1만 원도 안 되니 10% 상환은 안 하는 게 낫습니다.",
            "은행에서 임대인의 국세·지방세 납세증명서를 요청할 수 있습니다. 홈택스·정부24에서 온라인 발급되니 집주인에게 미리 안내합니다.",
            "은행 창구가 묵시적 갱신에 임대인 날인을 요구하면, 보증기관 규정상 임대인 서명이 필수인지 먼저 확인합니다. 갱신계약 의향서 + 본인서명사실확인서로 처리되는 경우가 있습니다.",
          ].map((t) => <li key={t} className="flex gap-2.5"><Dot /><span>{t}</span></li>)}
        </ul>

        <h3 className="mt-6 text-[15px] font-bold">2단계 · 목적물 변경</h3>
        <ul className="mt-2 space-y-2 text-[15px] leading-[1.85] text-ink2">
          {[
            "목적물 변경은 기존 전세대출을 유지한 채 대출의 담보 주택만 새 집으로 바꾸는 것입니다. 중도상환수수료가 없습니다.",
            "만기 이후 이사라도 기존 대출을 유지하면 신규가 아니라 목적물 변경이며, 대출받은 같은 은행에서만 됩니다. 접수 시기는 은행마다 조금 다르니 기존 계약 만료 한 달 전쯤 먼저 물어봅니다.",
            "새 집 계약서, 계약금 5% 이상 납부 영수증, 확정일자가 있어야 신청할 수 있습니다.",
            "보증금이 커지면 증액도 가능하고, 증액분만 새로 심사합니다.",
            "대출 만기가 계약 만기보다 앞서고 새 집 잔금이 그 뒤인 경우, 계약 만기까지 먼저 연장한 뒤 목적물 변경 때 추가 연장이 됩니다. 잔금 직전까지 연장해 두고 잔금 직후 바로 목적물 변경을 신청하면 금리 변동을 한 번으로 끝낼 수 있습니다.",
          ].map((t) => <li key={t} className="flex gap-2.5"><Dot /><span>{t}</span></li>)}
        </ul>

        <h3 className="mt-6 text-[15px] font-bold">잔금일 돈 흐름</h3>
        <ol className="mt-2 space-y-1.5 text-[15px] leading-[1.85] text-ink2">
          {[
            "기존 집 집주인이 보증금 반환 (대출분은 은행으로)",
            "기존 대출 상환, 본인 돈 회수",
            "새 대출 실행 + 본인 돈으로 새 집 잔금",
            "당일 주민센터 전입신고, 새 등본을 은행에 제출",
          ].map((t, i) => <li key={t} className="flex gap-3"><Num i={i} /><span>{t}</span></li>)}
        </ol>
      </section>

      <section id="requirements" className="mt-12 scroll-mt-24">
        <h2 className={H2}>청년버팀목 요건 (2026년 9월 확인)</h2>
        <p className={P}>
          이사하면 새 집 기준으로 다시 봅니다. 나이는 <strong>신청일 기준</strong>이라, <strong>만 34세</strong>가 끝나 가면 이사
          시점 자체가 대출을 좌우합니다. 한도는 <strong>보증금의 80%</strong>, 수도권은 <strong>1억 5천만 원</strong>까지입니다.
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

      <section id="money" className="mt-12 scroll-mt-24">
        <h2 className={H2}>돈 계산은 이렇게</h2>
        <p className={P}>
          예를 들어 보증금 1억 5천만 원 집(대출 1억 2천만 원, 본인 돈 3천만 원)에서 1억 8천만 원
          집으로 옮긴다고 해 봅시다. 이사 당일 본인 돈은 아슬아슬하게 맞고, 매달 고정비는 15만 원쯤
          늘어납니다. 숫자는 설명을 위한 예시이니 내 보증금과 대출 비율로 바꿔 계산해 보세요.
        </p>
        <figure className="mt-5 overflow-x-auto">
          <figcaption className="text-[13.5px] font-semibold text-ink2">이사 당일 필요한 돈 (예시 · 새 집 1억 8천만 원)</figcaption>
          <table className="mt-3 w-full min-w-[22rem] border-collapse text-[13.5px]">
            <tbody>
              {[
                ["쓸 수 있는 돈", "약 3,900만", "보유 현금 + 이사 전까지 저축 + 기존 집에서 회수하는 본인 돈 3,000만"],
                ["새 집 본인 몫 (20%)", "-3,600만", ""],
                ["새 대출 (80%)", "1억 4,400만", "청년버팀목 수도권 한도(1억 5천만) 안"],
                ["중개보수 (0.3% + 부가세)", "약 -60만", ""],
                ["이사비 + 입주청소", "약 -150~200만", "견적 2~3곳 비교"],
                ["남는 돈", "거의 0", "비상금이 바닥나는 구간"],
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
            계약금 5%는 기존 집 보증금을 돌려받기 전에 내야 하므로 보유 현금에서 먼저 나갑니다.
            월급이 잔금 전에 들어오는지, 이사비 견적이 얼마인지 미리 확인해 두는 게 좋습니다.
          </p>
        </figure>

        <figure className="mt-8 overflow-x-auto">
          <figcaption className="text-[13.5px] font-semibold text-ink2">매달 고정비 변화 (예시)</figcaption>
          <table className="mt-3 w-full min-w-[24rem] border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b-2 border-line2 text-left text-[12.5px] text-muted">
                <th className={TH}>항목</th><th className={TH}>기존 집</th><th className={TH}>새 집</th><th className={TH}>차이</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["대출금", "1억 2,000만", "1억 4,400만", "+2,400만"],
                ["이자 (기존 2.5% → 새 집 2.9% 기준)", "약 25만", "약 35만", "+10만"],
                ["관리비", "약 9만", "약 14만", "+5만"],
                ["합계", "약 34만", "약 49만", "+15만 안팎"],
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
            새 대출 금리는 소득 구간으로 다시 정해집니다. 예시는 기존 2.5%, 새 집 2.9%로 두었습니다. 이자 외에 HUG 보증료가 1년에 한 번 나갑니다.
          </p>
        </figure>

        <div className="mt-6 rounded-card border-l-[3px] border-brand bg-brandSoft/50 px-4 py-3">
          <p className="text-[13.5px] leading-relaxed text-ink2">
            <b>남는 것 vs 이사하는 것.</b> 돈만 보면 남는 쪽이 2년에 수백만 원 유리한 경우가
            많습니다. 그래도 이사를 고르는 이유는 집의 불편, 집주인의 실거주 결정, 그리고
            청년버팀목 나이 요건이 곧 끝나 청년 대출로 옮길 수 있는 시기가 마지막이라는 점입니다. 지자체가 따로 얹어 주는 전세 지원은{" "}
            <Link href="/housing/jeonse/youth" className="underline underline-offset-4 hover:text-brand">
              청년 전세자금 대출이자 지원
            </Link>
            에 모아 두었습니다.
          </p>
        </div>
      </section>

      <section id="newhome" className="mt-12 scroll-mt-24">
        <h2 className={H2}>새 집 고를 때 확인할 것</h2>
        <p className={P}>
          <strong>보증금 안전</strong>이 첫째, 대출과 보증이 되는지가 둘째입니다. <strong>전세가율</strong>이 높으면 집은 멀쩡해도
          HUG 보증이 안 나올 수 있으니 계약 전에 은행에서 먼저 확인합니다. 은행별 금리는{" "}
          <Link href="/money/jeonse" className="underline underline-offset-4 decoration-brand/40 hover:text-brand">전세자금대출 금리 비교</Link>, 지자체 이자 지원은{" "}
          <Link href="/housing/jeonse/youth" className="underline underline-offset-4 decoration-brand/40 hover:text-brand">청년 전세 지원</Link>에서 봅니다.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b-2 border-line2 text-left text-[12.5px] text-muted">
                <th className={TH}>항목</th><th className={TH}>확인할 것</th><th className={TH}>왜</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["등기부 갑구", "소유자가 누구인지, 얼마나 오래 보유했는지", "최근에 산 집이면 갭투자 매물일 수 있습니다"],
                ["등기부 을구", "근저당·압류·가압류가 있는지, 있으면 금액과 순위", "가장 중요한 부분. 비어 있으면 통과"],
                ["전세가율", "전세가 ÷ 같은 평형 매매 시세", "80%를 넘으면 보증 가능 여부를 먼저 확인"],
                ["준공연도", "20년 넘었으면 결로·배관·샷시", "겨울 난방비와 수리비로 돌아옵니다"],
                ["관리비", "정액 + 사용료 평균", "구축일수록 사용료 비중이 큽니다"],
                ["층·구조", "엘리베이터, 방 수, 채광", "매일 겪는 불편은 돈으로 환산해 둡니다"],
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
          ].map((t, i) => <li key={t} className="flex gap-3"><Num i={i} /><span>{t}</span></li>)}
        </ol>
        <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
          퇴거 정산: 관리비와 공과금은 이사 당일 기준으로 정산합니다. 관리비에 포함해 낸
          장기수선충당금은 집주인에게 돌려받을 수 있으니 관리사무소에서 납부 내역을 떼 둡니다.
        </p>
      </section>

      <section id="checklist" className="mt-12 scroll-mt-24">
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

      <section id="summary" className="mt-12 scroll-mt-24">
        <h2 className={H2}>정리</h2>
        <ol className="mt-4 space-y-2.5 text-[15px] leading-[1.85] text-ink2">
          {[
            "집주인의 결정을 기다리기만 하면 은행 일정이 먼저 끝납니다. 기한을 정해 묻는 건 무례가 아니라 필요한 일입니다.",
            "급한 이유를 “은행 대출 구조” 탓으로 두면 관계를 해치지 않으면서 결정을 끌어낼 수 있습니다.",
            "집주인에게 요청할 때는 상대에게 좋은 점(보증금 반환 유예)과 부담 최소화(직접 찾아가 서명)를 함께 말합니다.",
            "만기와 이사 날짜가 안 맞으면 한시적 연장 계약서 + 목적물 변경으로 해결됩니다. 처음부터 알고 있으면 덜 불안합니다.",
            "청년 대출은 나이 요건이 있어서, 언제 이사하느냐에 따라 받을 수 있는 대출이 달라집니다. 이사 시점 자체가 재테크 결정입니다.",
          ].map((t, i) => <li key={t} className="flex gap-3"><Num i={i} /><span>{t}</span></li>)}
        </ol>
      </section>

      <Faq items={FAQ} />

      <section id="sources" className="mt-12 scroll-mt-24">
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
          이 글의 법·금융 내용은 2026년 9월 30일에 확인한 공개 자료를 정리한 것입니다. 사례의
          금액과 날짜는 여러 경우를 섞어 각색한 것이고, 한도·금리·요건은 해마다 바뀝니다. 각자
          상황은 대출받은 은행과 법률 상담(대한법률구조공단 132)으로 확인하세요.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/money/jeonse" className="btn btn-primary px-5 py-3">전세대출 은행별 금리 비교</Link>
        <Link href="/housing/jeonse/youth" className="btn px-5 py-3">청년 전세 지원 사업 보기</Link>
        <ShareButton title={TITLE} />
      </div>

      <AdSlot name="post_bottom" />

      <PromoBanner placement="jeonse-extension" context="money" />
      <RelatedLinks items={jeonsePostRelated()} />
    </article>
  );
}
