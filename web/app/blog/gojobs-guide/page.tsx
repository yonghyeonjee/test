import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import Faq from "@/components/Faq";
import { GojobsHero, HBars, WeekBars } from "@/components/GojobsArt";
import JsonLd from "@/components/JsonLd";
import MidAd from "@/components/MidAd";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import ShareButton from "@/components/ShareButton";
import Toc from "@/components/Toc";
import { postRelated } from "@/lib/related";
import { ORG_ID, pageGraph } from "@/lib/schema";
import { SITE_URL } from "@/lib/seo";

/**
 * 나라일터 안내 글.
 *
 * "나라일터" 로 검색하는 사람은 대부분 공고를 찾으러 온다. 공식 사이트 설명을
 * 되풀이하는 대신, 우리가 매일 받아 두는 공고 3만여 건에서 센 숫자 —
 * 접수 기간이 얼마나 짧은지, 어떤 자리가 많은지, 언제 올라오는지 — 를
 * 보여 준다. 그건 다른 데 없는 내용이고, 그래서 검색에 남는다.
 *
 * 숫자는 2026-09-28 기준 최근 1년(2025-09-28 ~) 등록 공고에서 센 것이다.
 * 같은 질의를 다시 돌려 갱신할 때 UPDATED 와 함께 바꾼다.
 */

const PATH = "/blog/gojobs-guide";
const UPDATED = "2026-09-28";
const TITLE = "나라일터 채용공고, 절반이 7일 안에 마감됩니다 — 놓치지 않고 찾는 법";
const DESC =
  "나라일터 공고 3만 2천 건을 세어 보니 절반이 접수 시작 일주일 안에 마감됐습니다. 공무직·기간제·" +
  "임기제 공고가 언제 올라오고 어디서 지원하는지, 오늘 접수 중인 공고까지 한 번에 확인하세요.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    "나라일터", "나라일터 채용", "나라일터 공고", "나라일터 홈페이지", "나라일터 이용방법",
    "gojobs.go.kr", "공무직 채용", "기간제 채용", "임기제 공무원 채용", "공공기관 채용 공고",
    "인사혁신처 채용", "기간제 교사 채용", "나라일터 모바일",
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

// ── 최근 1년 공고에서 센 숫자 ────────────────────────────────
const YEAR_TOTAL = 32406;
const YEAR_ORGS = 4048;

const DAYS = [
  { label: "3일 이내", n: 5293 },
  { label: "4~7일", n: 10590 },
  { label: "8~14일", n: 12804 },
  { label: "15~30일", n: 3310 },
  { label: "31일 이상", n: 267 },
];

const HIRE = [
  { label: "국가(중앙부처)", n: 16834 },
  { label: "교육(교육청·학교)", n: 7411 },
  { label: "지자체", n: 4282 },
  { label: "공공기관", n: 3862 },
];

const ROLES = [
  { label: "공무직", n: 5322 },
  { label: "기간제 교사·교원", n: 4971 },
  { label: "임기제 공무원", n: 4550 },
  { label: "시설·경비·안전", n: 2046 },
  { label: "인턴·체험형", n: 1511 },
  { label: "연구원", n: 1470 },
  { label: "경력경쟁채용", n: 787 },
  { label: "상담·복지", n: 603 },
  { label: "조리·급식", n: 490 },
  { label: "청소·환경미화", n: 410 },
];

const WEEK = [7275, 5962, 5931, 5913, 7075, 179, 71];

const MONTHS = [
  { label: "1월", n: 3323 }, { label: "2월", n: 3591 }, { label: "3월", n: 3090 },
  { label: "4월", n: 2912 }, { label: "5월", n: 2282 }, { label: "6월", n: 2754 },
  { label: "7월", n: 2935 }, { label: "8월", n: 2631 }, { label: "9월", n: 2163 },
  { label: "10월", n: 1840 }, { label: "11월", n: 2216 }, { label: "12월", n: 2669 },
];

const REGIONS = [
  { label: "서울", n: 4056 }, { label: "인천", n: 2513 }, { label: "경기", n: 1963 },
  { label: "부산", n: 1168 }, { label: "충남", n: 673 }, { label: "경북", n: 583 },
  { label: "강원", n: 549 }, { label: "경남", n: 470 },
];

const STEPS = [
  {
    h: "1. 공고를 찾는다",
    p: "나라일터 「일반채용 > 모집공고」에서 기관·지역·채용 유형으로 거릅니다. 비회원도 공고는 다 볼 수 있습니다. 나라지원에서는 같은 공고를 지역별·기관별·직무별로 묶어 두었고, 접수 중인 것만 볼 수도 있습니다.",
  },
  {
    h: "2. 첨부파일을 연다",
    p: "목록의 몇 줄은 요약일 뿐입니다. 자격 요건, 우대 사항, 제출 서류, 접수처는 대개 첨부된 공고문(HWP·PDF)에만 있습니다. 첨부를 열지 않고 지원 준비를 시작하면 서류에서 걸립니다.",
  },
  {
    h: "3. 접수 방법을 확인한다",
    p: "나라일터에서 바로 원서를 내는 공고(개방형 직위 등)는 일부이고, 공무직·기간제는 기관이 정한 방법 — 이메일, 등기우편, 방문, 기관 채용 시스템 — 으로 접수하는 경우가 대부분입니다. 마감 '시각'까지 봐야 합니다. 18:00 마감이 흔합니다.",
  },
  {
    h: "4. 마감 전에 낸다",
    p: "최근 1년 공고의 절반이 등록 후 7일 안에 마감됐습니다. 서류를 미리 만들어 두고, 관심 기관은 알림을 걸어 두는 편이 맞습니다.",
  },
];

const FAQ = [
  {
    q: "나라일터는 어떤 사이트인가요?",
    a: "인사혁신처가 운영하는 공직 채용 정보 사이트(gojobs.go.kr)입니다. 중앙부처, 지방자치단체, 교육청과 학교, 공공기관의 공무직·기간제·임기제·경력경쟁 채용 공고가 올라오고, 공무원 인사교류와 대체인력 관련 서비스도 함께 있습니다.",
  },
  {
    q: "나라일터에서 바로 지원할 수 있나요?",
    a: "공고에 따라 다릅니다. 개방형 직위처럼 나라일터에서 이력서를 쓰고 접수하는 공고도 있지만, 공무직·기간제 공고는 기관이 정한 방법(이메일·우편·방문·기관 시스템)으로 접수하는 경우가 대부분입니다. 공고문에 적힌 접수처를 따르세요.",
  },
  {
    q: "회원가입을 해야 하나요?",
    a: "공고를 보는 데는 필요 없습니다. 나라일터에서 직접 원서를 내거나 관심 공고를 저장하는 기능은 회원에게 열려 있습니다.",
  },
  {
    q: "접수 기간은 보통 얼마나 되나요?",
    a: "최근 1년 공고 3만 2천여 건을 세어 보면 등록일부터 마감일까지 중앙값이 8일입니다. 절반이 7일 안에, 열에 아홉이 2주 안에 마감됩니다. 한 달 넘게 여는 공고는 1%뿐입니다.",
  },
  {
    q: "공고는 주로 언제 올라오나요?",
    a: "월요일과 금요일에 가장 많고, 토·일요일에는 거의 올라오지 않습니다. 달로는 1~3월이 가장 많고 10월이 가장 적습니다. 학교·교육청의 기간제 교원 공고가 학기 전에 몰리는 영향이 큽니다.",
  },
  {
    q: "잡알리오·클린아이 잡플러스와는 무엇이 다른가요?",
    a: "잡알리오(job.alio.go.kr)는 기획재정부 소관 공공기관의 정규·계약직 채용을, 클린아이 잡플러스는 지방 공공기관 채용을 모읍니다. 나라일터는 중앙부처·지자체·교육청의 공무직·기간제·임기제 공고가 중심입니다. 셋을 다 봐야 공공 부문 채용 전체가 보입니다.",
  },
  {
    q: "모바일로도 볼 수 있나요?",
    a: "인사혁신처가 나라일터를 모바일 체계로 개편해, 휴대폰으로 공고를 보고 개방형 직위 이력서 작성과 원서 접수까지 할 수 있습니다. 나라지원도 휴대폰 화면에 맞춰져 있어 접수 중인 공고를 바로 볼 수 있습니다.",
  },
];

export default function GojobsGuidePage() {
  const dated = DAYS.reduce((s, b) => s + b.n, 0);
  const withinWeek = Math.round(((DAYS[0].n + DAYS[1].n) / dated) * 100);
  const withinTwoWeeks = Math.round(((DAYS[0].n + DAYS[1].n + DAYS[2].n) / dated) * 100);

  const ld = pageGraph({
    path: PATH,
    name: TITLE,
    description: DESC,
    dateModified: UPDATED,
    crumbs: [{ name: "지원금 안내", path: "/blog" }, { name: "나라일터 이용법" }],
    about: {
      "@type": "BlogPosting",
      "@id": `${SITE_URL}${PATH}#post`,
      headline: TITLE,
      description: DESC,
      dateModified: UPDATED,
      datePublished: UPDATED,
      inLanguage: "ko-KR",
      keywords: "나라일터, 나라일터 채용, 공무직 채용, 기간제 채용, 임기제 공무원, 공공기관 채용 공고",
      author: { "@id": ORG_ID },
      publisher: { "@id": ORG_ID },
      url: `${SITE_URL}${PATH}`,
      about: { "@type": "WebSite", name: "나라일터", url: "https://www.gojobs.go.kr" },
    },
  });

  return (
    <article className="py-4">
      <JsonLd data={ld} />

      <nav aria-label="위치" className="text-[13px] text-muted">
        <Link href="/blog" className="hover:text-brand">지원금 안내</Link>
        {" · "}
        <span className="text-ink2">나라일터 이용법</span>
      </nav>

      <header className="mt-3">
        <h1 className="display text-[1.75rem] leading-tight">
          나라일터 채용공고, 절반이 7일 안에 마감됩니다
        </h1>
        <p className="num mt-2 text-xs text-faint">{UPDATED} 기준</p>
        <p className="mt-3 text-[15.5px] leading-[1.85] text-ink2">
          나라일터(gojobs.go.kr)는 인사혁신처가 운영하는 공직 채용 공고 사이트입니다. 중앙부처와
          지자체, 교육청과 학교, 공공기관이 뽑는 공무직·기간제·임기제 자리가 여기 올라옵니다.
          나라지원은 이 공고를 매일 새로 받아 지역·기관·직무로 묶어 보여 주는데, 그렇게 쌓인
          최근 1년치 <b className="font-bold">{YEAR_TOTAL.toLocaleString("ko-KR")}건</b>을 세어
          보니 처음 쓰는 사람이 알아 두면 좋은 것이 몇 가지 보였습니다.
        </p>
        <div className="mt-5"><GojobsHero /></div>
      </header>

      <Toc items={[{ id: "glance", label: "한눈에" }, { id: "steps", label: "지원하는 순서" }, { id: "deadline", label: "접수 기간은 생각보다 짧습니다" }, { id: "roles", label: "어떤 자리가 올라오나" }, { id: "when", label: "언제 올라오나" }, { id: "where", label: "어디 자리가 많나" }, { id: "pitfalls", label: "처음 쓰면 막히는 곳" }, { id: "services", label: "나라일터에 있는 다른 서비스" }, { id: "faq", label: "자주 묻는 질문" }, { id: "sources", label: "확인한 곳" }]} />

      <section id="glance" className="mt-8 scroll-mt-24">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">한눈에</h2>
        <dl className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {[
            ["운영", "인사혁신처 (www.gojobs.go.kr)"],
            ["올라오는 공고", "공무직·기간제·임기제·경력경쟁·인턴 등 공직 채용"],
            ["최근 1년", `${YEAR_TOTAL.toLocaleString("ko-KR")}건 · ${YEAR_ORGS.toLocaleString("ko-KR")}개 기관`],
            ["접수 기간", `중앙값 8일 · 절반이 7일 안에 마감`],
            ["공고 보기", "비회원도 가능 · 첨부 공고문이 원본"],
            ["접수", "공고마다 다름 (이메일·우편·방문·기관 시스템·나라일터)"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-card bg-ground px-4 py-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 text-[14.5px] font-semibold leading-snug">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="steps" className="mt-12 scroll-mt-24">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">지원하는 순서</h2>
        <ol className="mt-4 grid gap-3">
          {STEPS.map((s) => (
            <li key={s.h} className="card p-5">
              <h3 className="text-[15px] font-extrabold">{s.h}</h3>
              <p className="mt-1.5 text-[14.5px] leading-[1.8] text-ink2">{s.p}</p>
            </li>
          ))}
        </ol>
        <div className="mt-3 rounded-card border-l-[3px] border-brand bg-brandSoft/50 px-4 py-3">
          <p className="text-[13.5px] leading-relaxed text-ink2">
            목록에는 「서류전형 합격자 및 면접 일정」 같은 <b>안내 공고</b>도 섞여 있습니다. 최근 1년에
            1,380건이었습니다. 제목에 &lsquo;합격자&rsquo;·&lsquo;면접&rsquo;이 있으면 지원할 수 있는 공고가
            아닙니다. 나라지원은 이런 공고를 열면 맨 위에 그 사실부터 알려 줍니다.
          </p>
        </div>
      </section>

      <MidAd name="detail_mid" context="job" seed="gojobs-guide" className="mt-10" />

      <section id="deadline" className="mt-12 scroll-mt-24">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">접수 기간은 생각보다 짧습니다</h2>
        <p className="mt-2 text-[15px] leading-[1.85] text-ink2">
          등록일부터 마감일까지 며칠인지 세어 봤습니다. 절반({withinWeek}%)이 일주일 안에,
          열에 아홉({withinTwoWeeks}%)이 2주 안에 마감됩니다. 3일 안에 닫히는 공고도 여섯 건 중 한 건입니다.
          &ldquo;주말에 천천히 써야지&rdquo; 하면 이미 끝나 있는 이유입니다.
        </p>
        <div className="card mt-4 p-4">
          <HBars bars={DAYS} pct ariaLabel="등록일부터 마감일까지 걸린 날수 분포. 3일 이내 16%, 4~7일 33%, 8~14일 40%, 15~30일 10%, 31일 이상 1%" />
          <p className="mt-2 text-xs text-muted">최근 1년 공고 중 등록일·마감일이 모두 있는 {dated.toLocaleString("ko-KR")}건</p>
        </div>
      </section>

      <section id="roles" className="mt-12 scroll-mt-24">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">어떤 자리가 올라오나</h2>
        <p className="mt-2 text-[15px] leading-[1.85] text-ink2">
          제목으로 갈라 보면 공무직, 기간제 교사·교원, 임기제 공무원 세 가지가 가장 많습니다.
          정규 공무원 시험은 여기가 아니라 사이버국가고시센터에 있고, 나라일터는 그 바깥의
          자리 — 계약직, 대체 인력, 전문 임기제, 인턴 — 가 중심입니다.
        </p>
        <div className="card mt-4 p-4">
          <HBars bars={ROLES} ariaLabel="직무별 공고 수. 공무직 5,322건, 기간제 교사·교원 4,971건, 임기제 공무원 4,550건, 시설·경비·안전 2,046건, 인턴 1,511건, 연구원 1,470건, 경력경쟁채용 787건, 상담·복지 603건, 조리·급식 490건, 청소·환경미화 410건" />
          <p className="mt-2 text-xs text-muted">공고 제목의 낱말로 가른 것이라 어느 갈래에도 안 든 공고가 따로 8천여 건 있습니다.</p>
        </div>
        <div className="card mt-3 p-4">
          <h3 className="text-[14px] font-bold">누가 뽑나</h3>
          <HBars bars={HIRE} pct ariaLabel="채용 주체별 비율. 국가(중앙부처) 52%, 교육(교육청·학교) 23%, 지자체 13%, 공공기관 12%" className="mt-2" />
        </div>
      </section>

      <section id="when" className="mt-12 scroll-mt-24">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">언제 올라오나</h2>
        <p className="mt-2 text-[15px] leading-[1.85] text-ink2">
          공고는 근무일에 올라옵니다. 월요일과 금요일이 가장 많고 토·일요일은 거의 없습니다.
          그러니 <b className="font-bold">월요일 아침과 금요일 오후</b>에 한 번씩 보면 대부분을 놓치지 않습니다.
        </p>
        <div className="card mt-4 p-4">
          <WeekBars counts={WEEK} />
        </div>
        <p className="mt-4 text-[15px] leading-[1.85] text-ink2">
          달로는 1~3월이 가장 많습니다. 새 학기를 앞두고 학교와 교육청의 기간제 교원 공고가
          몰리고, 새해 예산으로 뽑는 공무직·임기제 자리도 이때 나옵니다. 10월이 가장 조용합니다.
        </p>
        <div className="card mt-3 p-4">
          <HBars bars={MONTHS} ariaLabel="월별 공고 등록 건수. 1월 3,323건, 2월 3,591건, 3월 3,090건, 4월 2,912건, 5월 2,282건, 6월 2,754건, 7월 2,935건, 8월 2,631건, 9월 2,163건, 10월 1,840건, 11월 2,216건, 12월 2,669건" />
        </div>
      </section>

      <section id="where" className="mt-12 scroll-mt-24">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">어디 자리가 많나</h2>
        <p className="mt-2 text-[15px] leading-[1.85] text-ink2">
          공고의 절반 남짓은 근무지를 따로 적지 않습니다(중앙부처처럼 전국 단위이거나, 공고문
          안에만 적은 경우). 근무지가 적힌 공고 가운데는 서울·인천·경기가 절반을 넘습니다.
          지역별로 보려면 나라지원의 <Link href="/jobs/region" className="underline underline-offset-4 hover:text-brand">지역별 채용</Link> 화면이 빠릅니다.
        </p>
        <div className="card mt-4 p-4">
          <HBars bars={REGIONS} ariaLabel="근무지가 적힌 공고의 지역별 건수. 서울 4,056건, 인천 2,513건, 경기 1,963건, 부산 1,168건, 충남 673건, 경북 583건, 강원 549건, 경남 470건" />
        </div>
      </section>

      <section id="pitfalls" className="mt-12 scroll-mt-24">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">처음 쓰면 막히는 곳</h2>
        <ul className="mt-4 space-y-3 text-[15px] leading-[1.8] text-ink2">
          {[
            ["내용이 첨부파일에만 있다", "목록 화면은 제목·기관·기간이 전부입니다. 자격과 서류는 첨부 공고문을 열어야 보입니다. 휴대폰이라면 HWP 를 열 수 있는 앱이 필요합니다."],
            ["접수처가 기관마다 다르다", "같은 '공무직 채용'이어도 어떤 곳은 이메일, 어떤 곳은 등기우편만 받습니다. 접수 방법과 마감 시각은 공고문의 '접수 방법' 항목이 기준입니다."],
            ["합격자 발표가 목록에 섞인다", "「합격자 발표」「면접 일정」 공고는 지원할 수 있는 공고가 아닙니다. 제목을 먼저 보세요."],
            ["마감이 짧다", "절반이 일주일 안에 닫힙니다. 이력서·경력증명서·자격증 사본은 미리 파일로 만들어 두면 하루면 냅니다."],
            ["기관명이 길고 낯설다", "'○○교육청 학교행정지원본부 학교채용지원팀' 처럼 부서까지 붙습니다. 나라지원은 기관별 화면에서 그 기관이 그동안 낸 공고와 접수 기간을 함께 보여 줍니다."],
          ].map(([h, p]) => (
            <li key={h} className="rounded-card bg-ground px-4 py-3">
              <b className="block text-[14.5px] font-extrabold">{h}</b>
              <span className="mt-1 block text-[14.5px]">{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="services" className="mt-12 scroll-mt-24">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">나라일터에 있는 다른 서비스</h2>
        <p className="mt-2 text-[15px] leading-[1.85] text-ink2">
          채용 공고 말고도 공무원을 위한 메뉴가 같이 있습니다. 구직자라면 몰라도 되지만, 이름이
          보이면 무엇인지는 알아 두는 편이 낫습니다.
        </p>
        <ul className="mt-4 space-y-2 text-[14.5px] leading-[1.8] text-ink2">
          <li><b>인사교류</b> — 같은 직렬·계급의 공무원이 희망 부처·지역 조건이 맞는 상대와 자리를 맞바꾸는 제도입니다. 모바일 개편 때 조건에 맞는 상대를 자동으로 추천하는 기능이 붙었습니다.</li>
          <li><b>대체인력</b> — 휴직 등으로 빈 자리를 채울 인력 풀입니다. 기간제 채용 공고 가운데 상당수가 이 성격입니다.</li>
          <li><b>개방형 직위</b> — 민간 경력자도 지원하는 과장·국장급 자리입니다. 이 공고는 나라일터에서 이력서를 쓰고 바로 접수합니다.</li>
        </ul>
      </section>

      <Faq items={FAQ} />

      <section id="sources" className="mt-12 scroll-mt-24">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">확인한 곳</h2>
        <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-ink2">
          {[
            ["나라일터 (인사혁신처)", "https://www.gojobs.go.kr"],
            ["정책브리핑 — '모바일 나라일터' 개시", "https://www.korea.kr/news/policyNewsView.do?newsId=148895696"],
            ["인사혁신처 인사교류 안내", "https://www.mpm.go.kr/mpm/info/infoBiz/bizHr04/"],
            ["잡알리오 (기획재정부 공공기관 채용정보)", "https://job.alio.go.kr"],
          ].map(([label, href]) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noopener noreferrer"
                 className="underline underline-offset-4 hover:text-brand">{label}</a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          건수와 비율은 나라지원이 {UPDATED} 기준 최근 1년 동안 받아 둔 나라일터 공고에서 센 것입니다.
          공고 제목으로 직무를 가른 것이라 오차가 있습니다. 지원 자격과 접수 방법은 반드시 각 공고문에서
          확인하세요.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/jobs/status/open?via=gojobs-guide" className="btn btn-primary px-5 py-3">
          지금 접수 중인 공고 보기
        </Link>
        <ShareButton title={TITLE} />
      </div>

      <AdSlot name="post_bottom" />

      <PromoBanner placement="gojobs-guide" context="job" />
      <RelatedLinks items={postRelated("national-employment-support")} />
    </article>
  );
}
