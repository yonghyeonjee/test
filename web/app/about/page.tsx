import type { Metadata } from "next";
import { IllusAbout } from "@/components/Illus";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import RelatedLinks from "@/components/RelatedLinks";
import { HowItWorksArt, TrustIcon } from "@/components/Infographic";
import { IntroVideo } from "@/components/Video";
import { aboutRelated } from "@/lib/related";
import { ORG_ID, pageGraph } from "@/lib/schema";
import { SITE_NAME, t, withOg } from "@/lib/seo";

const DESC =
  "K나라지원은 흩어져 있는 정부·지자체 지원사업 중에서 내 조건에 해당되는 것만 골라 보여줍니다. 회원가입도 주민등록번호도 필요 없습니다.";

export const metadata: Metadata = withOg({
  title: "K나라지원 소개 — 무엇을 하는 곳이고, 무엇을 받지 않는가",
  description: DESC,
  alternates: { canonical: "/about" },
});

const USES = [
  {
    who: "혼자 사는 어르신",
    what: "돌봄, 의료비, 각종 요금 감면처럼 신청해야만 받는 지원이 많습니다. 나이와 사는 곳만 넣으면 해당되는 것만 나옵니다.",
  },
  {
    who: "사회 초년생·청년",
    what: "월세, 자산형성, 취업 준비 지원은 나이 한두 살로 갈립니다. 내 나이를 넣어 지금 되는 것만 확인하세요.",
  },
  {
    who: "아이 키우는 집",
    what: "가구 상황에 따라 열리는 지원이 따로 있습니다. 한부모, 다자녀 조건을 넣으면 그에 맞는 사업만 남습니다.",
  },
  {
    who: "작은 사업체·창업자",
    what: "자금, 판로, 인력, 기술 지원이 부처와 지자체에 흩어져 있습니다. 업종과 지역으로 한 번에 좁혀 보세요.",
  },
];

/** 소개 쪽은 AboutPage 로 적고, 다루는 것은 layout 이 이미 낸 Organization(#org)을 가리킨다. */
function aboutLd() {
  const ld = pageGraph({ path: "/about", name: "K나라지원 소개", description: DESC });
  const page = (ld["@graph"] as Record<string, unknown>[])[0];
  page["@type"] = "AboutPage";
  page.about = { "@id": ORG_ID };
  return ld;
}

/** 자료 출처와 받아 오는 주기. 수집 워크플로(.github/workflows)와 맞춘다. */
const SOURCES = [
  { what: "지원사업", from: "복지로(중앙부처·지자체 복지서비스), 기업마당, 소상공인24 공개 자료를 매일 받아 옵니다." },
  { what: "공공기관 채용", from: "인사혁신처 나라일터와 잡알리오(공공기관 채용정보시스템)의 공고를 매일 받아 옵니다." },
  { what: "공공기관 사업·행사·시설", from: "기획재정부 알리오 플러스 공개 자료를 주 1회 받아 옵니다." },
  { what: "자격증·시험 일정", from: "한국산업인력공단 큐넷의 종목과 시험 일정을 주 1회 받아 옵니다." },
];

export default function About() {
  return (
    <div className="py-4">
      <JsonLd data={aboutLd()} />
      <div className="flex items-start justify-between gap-6">
        <h1 className="display text-[2rem] leading-tight sm:text-[2.4rem]">
          받을 수 있는 지원만
          <br />
          골라서 보여드립니다
        </h1>
        <div className="hidden h-32 w-44 shrink-0 sm:block"><IllusAbout /></div>
      </div>

      <p className="mt-5 max-w-[36rem] text-[1.0625rem] leading-relaxed text-ink2">
        지원금은 대부분 <b className="font-bold">신청해야만</b> 받습니다. 가만히
        있으면 자격이 있어도 그냥 지나갑니다. 그런데 어떤 사업이 있는지 알아보려면
        부처별, 지자체별로 흩어진 공고를 일일이 뒤져야 합니다. {SITE_NAME}은 그
        수고를 대신합니다.
      </p>

      <section className="band-deep -mx-5 mt-10 grid items-center gap-8 px-6 py-9 text-white sm:mx-0 sm:rounded-card sm:px-10 md:grid-cols-[1fr_1fr]">
        <div>
          <p className="eyebrow !text-[#C4B5FD]">어떻게 돌아가나</p>
          <h2 className="display mt-2 text-[1.5rem] leading-tight">세 단계, 회원가입 없이</h2>
          <ol className="mt-4 space-y-2.5 text-[14.5px] leading-relaxed text-[#C7C3EA]">
            <li><b className="text-white">1.</b> 사는 곳과 나이를 넣습니다. 가구 사정과 취업 상태는 골라도, 안 골라도 됩니다.</li>
            <li><b className="text-white">2.</b> 공고 원문에서 추려낸 조건으로 걸러, 해당되는 공고만 남깁니다.</li>
            <li><b className="text-white">3.</b> 원문 링크로 넘어가 소득·재산 기준까지 확인하고 신청합니다.</li>
          </ol>
        </div>
        <div className="aspect-[6/5] max-h-64"><HowItWorksArt /></div>
      </section>

      <div className="mt-8"><IntroVideo rel="video/intro.mp4" poster="/poster.jpg" title="K나라지원 1분 안내" /></div>

      <section className="mt-12">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          무엇이 좋아지나
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            {
              t: "찾는 시간이 줄어듭니다",
              d: "여러 사이트를 돌 필요 없이 한 화면에서 끝납니다. 조건을 한 줄로 적으면 됩니다.",
            },
            {
              t: "해당되는 것만 남습니다",
              d: "나이·지역·가구 상황을 넣으면 나와 상관없는 공고는 아예 빠집니다.",
            },
            {
              t: "마감을 놓치지 않습니다",
              d: "진행 중인지 마감됐는지 한눈에 보이고, 곧 끝나는 사업은 따로 표시합니다.",
            },
          ].map((c) => (
            <div key={c.t} className="card p-5">
              <b className="text-[15px]">{c.t}</b>
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          아무것도 요구하지 않습니다
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-4">
          {([
            ["lock", "개인정보 미저장"], ["source", "출처 10곳 명시"], ["link", "원문 링크 필수"], ["clock", "매일 새벽 갱신"],
          ] as const).map(([ic, t]) => (
            <div key={ic} className="flex items-center gap-2.5 text-[14px] font-bold text-ink2">
              <TrustIcon name={ic} />{t}
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-[36rem] leading-relaxed text-ink2">
          회원가입, 로그인, 주민등록번호, 소득 자료 — 하나도 필요 없습니다.
          조회하려고 개인정보를 넘길 이유가 없다고 봅니다. 사는 곳과 나이 정도만
          넣으면 되고, 그 값도 저장하지 않습니다. 조건을 저장해 두고 다음에 다시
          열고 싶으실 때만 이름과 연락처를 여쭙습니다.
        </p>
        <p className="mt-3 max-w-[36rem] leading-relaxed text-ink2">
          휴대폰에서 바로 열리고, 글자가 작아 불편하면 화면 위쪽의{" "}
          <b className="font-bold">가가 크게</b> 버튼으로 키울 수 있습니다. 찾은
          지원사업은 공유하기로 가족에게 그대로 보낼 수 있습니다.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          이런 분들이 씁니다
        </h2>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {USES.map((u) => (
            <div key={u.who} className="card p-5">
              <dt className="font-bold">{u.who}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">{u.what}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 2026-10-17: 자료 출처와 자동으로 만드는 것을 밝힌다. 사이트 전체가 구글 색인에서 빠진 뒤, 누가 어떻게 만드는
          사이트인지 알 수 있게 했다. 운영자 연락처는 주인이 알려 주면 넣는다(지어내지 않는다). */}
      <section className="mt-12">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          자료는 어디서 오고, 어떻게 만드나
        </h2>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {SOURCES.map((x) => (
            <div key={x.what} className="card p-5">
              <dt className="font-bold">{x.what}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">{x.from}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 max-w-[36rem] leading-relaxed text-ink2">
          공고와 사업 쪽은 위 공개 자료를 프로그램이 정리해 보여 주는 것입니다. 채용 공고의{" "}
          <b className="font-bold">공고 요약</b>은 첨부된 공고문을 AI가 읽어 항목으로 뽑은 것이라 틀릴 수 있습니다.
          읽을거리의 통계 글과 오늘의 채용 브리핑도 모아 둔 자료로 자동으로 씁니다. 지원금 안내 글 일부는 사람이 직접 씁니다.
        </p>
        <p className="mt-3 max-w-[36rem] leading-relaxed text-ink2">
          어느 쪽이든 신청하기 전에는 공고 원문을 기준으로 확인하세요. 모든 공고와 사업 쪽에 원문 링크가 있습니다.
        </p>
      </section>

      {/* 2026-10-30: 운영 원칙. 검색엔진과 사람 모두에게 "누가 어떤 기준으로 고치는 사이트인지"가 보이게. 연락처는 주인이
          알려 주기 전에는 적지 않는다(지어내지 않는다). */}
      <section className="mt-12">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
          운영 원칙 — 무엇을 보태고, 무엇은 하지 않나
        </h2>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            { t: "원문을 옮겨 적지 않습니다", d: "공고문·사업 안내문 본문을 복사해 싣지 않습니다. 항목으로 추린 요약과 원문 링크만 둡니다. 원문이 기준이라는 말을 모든 쪽에 적습니다." },
            { t: "이 사이트가 센 숫자를 보탭니다", d: "기관이 최근 1년에 공고를 몇 건 냈는지, 공고가 몰리는 달, 접수 기간이 평소보다 긴지 짧은지, 같은 지역에 접수 중인 사업 수처럼 원문에는 없는 것을 자료에서 직접 세어 붙입니다." },
            { t: "언제 자료인지 적습니다", d: "공고 쪽에는 원천에서 마지막으로 확인한 날을, 목록 쪽에는 오늘 기준 접수 중·마감 임박 건수를 적습니다. 끝난 공고는 끝났다고 먼저 알립니다." },
            { t: "틀리면 원천을 따라 고칩니다", d: "나라일터·복지로 등 원천이 바뀌면 다음 수집 때 그대로 반영됩니다(채용은 하루 다섯 번, 사업은 매일 새벽). 사람이 쓴 글은 고친 날을 글머리에 적습니다." },
            { t: "자동으로 만든 것은 자동이라고 밝힙니다", d: "공고 요약은 AI가 첨부 공고문을 읽어 뽑은 것, 통계 글은 모아 둔 자료로 프로그램이 쓴 것임을 그 쪽에 적습니다. 사람이 쓴 글과 섞지 않습니다." },
            { t: "개인정보를 모으지 않습니다", d: "조회 조건은 저장하지 않고, 방문 기록은 어느 검색엔진에서 어느 화면으로 왔는지만 셉니다. 광고는 화면 위아래 두 자리로 제한합니다." },
          ].map((c) => (
            <div key={c.t} className="card p-5">
              <dt className="font-bold">{c.t}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">{c.d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Link href="/" className="btn btn-primary mt-12 w-full py-4">
        내 조건으로 찾아보기
      </Link>

      <RelatedLinks items={aboutRelated()} />

      <p className="mt-8 text-xs leading-relaxed text-muted">
        {SITE_NAME}은 공공데이터를 정리해 안내하는 민간 서비스로, 정부·지자체가
        운영하는 공식 서비스가 아닙니다. 신청 자격의 최종 확인과 접수는 공고
        원문이나 관할 주민센터를 통해 하시기 바랍니다.
      </p>
    </div>
  );
}
