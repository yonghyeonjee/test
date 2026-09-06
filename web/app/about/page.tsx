import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, t } from "@/lib/seo";

export const metadata: Metadata = {
  title: t("서비스 소개 — 받을 수 있는 지원만 골라서"),
  description:
    "나라지원은 흩어져 있는 정부·지자체 지원사업 중에서 내 조건에 해당되는 것만 골라 보여줍니다. 회원가입도 주민등록번호도 필요 없습니다.",
  alternates: { canonical: "/about" },
};

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

export default function About() {
  return (
    <div className="py-4">
      <h1 className="text-[1.75rem] font-extrabold leading-tight">
        받을 수 있는 지원만
        <br />
        골라서 보여드립니다
      </h1>

      <p className="mt-5 max-w-[36rem] text-[1.0625rem] leading-relaxed text-ink2">
        지원금은 대부분 <b className="font-bold">신청해야만</b> 받습니다. 가만히
        있으면 자격이 있어도 그냥 지나갑니다. 그런데 어떤 사업이 있는지 알아보려면
        부처별, 지자체별로 흩어진 공고를 일일이 뒤져야 합니다. {SITE_NAME}은 그
        수고를 대신합니다.
      </p>

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
        <p className="mt-4 max-w-[36rem] leading-relaxed text-ink2">
          회원가입, 로그인, 주민등록번호, 소득 자료 — 하나도 필요 없습니다.
          조회하려고 개인정보를 넘길 이유가 없다고 봅니다. 사는 곳과 나이 정도만
          넣으면 되고, 그 값도 저장하지 않습니다.
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

      <Link href="/" className="btn btn-primary mt-12 w-full py-4">
        내 조건으로 찾아보기
      </Link>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        {SITE_NAME}은 공공데이터를 정리해 안내하는 민간 서비스로, 정부·지자체가
        운영하는 공식 서비스가 아닙니다. 신청 자격의 최종 확인과 접수는 공고
        원문이나 관할 주민센터를 통해 하시기 바랍니다.
      </p>
    </div>
  );
}
