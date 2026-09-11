import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description:
    `${SITE_NAME}는 찾아보기만 할 때는 아무것도 받지 않습니다. 저장 목록을 쓰실 때만 ` +
    "사용자명을 만들고, 이름·연락처는 그때도 선택입니다. 주민등록번호는 어떤 경우에도 " +
    "받지 않습니다.",
  alternates: { canonical: `${SITE_URL}/privacy` },
};

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 border-b border-line pb-2 text-[15px] font-bold">
      {children}
    </h2>
  );
}

export default function Privacy() {
  return (
    <article className="pb-6">
      <nav className="mb-6 text-xs text-muted">
        <Link href="/" className="hover:text-brand">지원찾기</Link>
        {" / "}개인정보 처리방침
      </nav>

      <h1 className="text-[1.75rem] font-extrabold leading-tight">
        개인정보 처리방침
      </h1>

      <div className="card mt-6 p-5">
        <p className="text-[15px] font-bold">
          지원찾기는 회원가입이 없습니다.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          이름, 연락처, 주민등록번호, 소득·재산 자료를 받지 않습니다.
          보조금24처럼 행정정보를 연계하지 않으므로, 저희는 이용자가 누구인지
          알 수 없습니다.
        </p>
      </div>

      <H>1. 어떤 경우에도 받지 않는 것</H>
      <ul className="mt-3 space-y-1.5 text-sm leading-relaxed">
        {[
          "생년월일 · 주민등록번호",
          "주소 (사는 지역은 시·군·구까지만)",
          "소득 · 재산 · 가족관계 등 행정정보",
          "IP 주소 · 브라우저 정보 (저희 서버에는 남기지 않습니다)",
          "검색창에 직접 입력하신 문장",
        ].map((s) => (
          <li key={s} className="flex gap-2">
            <span className="text-brand">·</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm leading-relaxed text-muted">
        그냥 찾아보기만 하실 때는 아무것도 받지 않습니다. 저장 목록을 쓰실 때만
        사용자명과 비밀번호를 만들고, 이름·연락처는 그때도 선택입니다 —{" "}
        <b className="font-bold text-ink2">4·5항</b>에 적어 두었습니다.
      </p>

      <H>2. 기록하는 것 — 조건 통계</H>
      <p className="mt-3 text-sm leading-relaxed">
        어떤 조건이 많이 쓰이는지, 어떤 조건에서 결과가 하나도 안 나오는지
        알아야 데이터의 빈 곳을 채울 수 있습니다. 이를 위해 아래 항목만
        남깁니다.
      </p>

      <div className="card mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {[
              ["지역", "시·도 및 시·군·구"],
              ["나이", "10년 단위로만 (예: 28세 → 20대)"],
              ["취업 상태", "미취업 · 재직 등 선택지"],
              ["가구 상황", "저소득 · 장애인 등 선택지"],
              ["결과 수", "몇 건이 나왔는지"],
              ["유입 경로", "검색창 · 목록 · 지역페이지 중 어디"],
            ].map(([k, v]) => (
              <tr key={k}>
                <th className="w-28 bg-surface2 px-4 py-3 text-left text-xs font-bold text-muted">
                  {k}
                </th>
                <td className="px-4 py-3">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm leading-relaxed">
        이 기록에는 이용자를 구분할 수 있는 값이 없습니다. 세션 번호나 쿠키
        식별자를 붙이지 않으므로, 같은 사람이 두 번 검색해도 같은 사람인지
        저희는 알 수 없습니다. 나이를 10년 단위로 뭉개는 것도 같은
        이유입니다. 따라서 이 기록은{" "}
        <b className="font-bold">개인정보에 해당하지 않는 통계 자료</b>입니다.
      </p>

      <H>3. 쿠키와 방문 분석</H>
      <p className="mt-3 text-sm leading-relaxed">
        어느 화면이 잘 쓰이고 어디서 사람들이 떠나는지 알기 위해 Google Tag
        Manager 와 그에 연결된 분석 도구를 사용합니다. 이 도구들은 방문 기록을
        구분하려고 쿠키를 심습니다.
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        분석 도구로 넘어가는 것은 <b className="font-bold">어떤 화면을
        보았는가</b>까지입니다. 검색창에 입력하신 문장, 저장한 조건의 내용,
        사용자명이나 연락처는 넘기지 않습니다.
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        원치 않으시면 브라우저의 추적 차단 기능이나 확장 프로그램으로 막을 수
        있습니다. 막아도 지원금 검색과 저장 기능은 그대로 동작합니다.
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        따로, 어느 사이트를 거쳐 오셨는지(리퍼러 주소의 <b className="font-bold">
        도메인만</b>), 처음 열린 페이지, 링크에 붙은 캠페인 표시(utm)를 방문당
        한 번 저희 서버에 남깁니다. 어떤 경로로 알리는 것이 도움이 되는지 보기
        위해서이며, 전체 주소·IP·브라우저 정보는 남기지 않습니다.
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        이 밖에 관리자 화면(<code className="rounded bg-surface2 px-1">/admin</code>)에
        로그인할 때 인증용 쿠키를 하나 쓰며, 8시간 뒤 만료됩니다.
      </p>

      <H>4. 저장한 조건</H>
      <p className="mt-3 text-sm leading-relaxed">
        결과 화면에서 <b className="font-bold">저장</b>을 누르면 그 조건이
        저희 서버에 보관됩니다. 브라우저를 정리해도 남기고, 나중에 새 사업이
        올라왔을 때 알려드리는 바탕으로 쓰기 위해서입니다.
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        누구의 것인지는 <b className="font-bold">브라우저가 만든 무작위 번호</b>
        하나로만 구분합니다. 이름·연락처를 받지 않으므로 그 번호로는 누구인지
        알 수 없습니다. 번호는 이 브라우저에만 있고, 지우면 저장 목록도 더는
        보이지 않습니다.
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        기기를 바꾸거나 브라우저 기록을 지운 뒤 되찾을 수 있도록{" "}
        <b className="font-bold">8자리 복구 코드</b>를 발급받을 수 있습니다.
        이 코드도 무작위이며 개인정보가 아닙니다. 이름이나 전화번호를 열쇠로
        쓰지 않는 이유는, 저장 조건에 소득·장애·가구 상황처럼 민감한 항목이
        들어가기 때문입니다. 아는 사람이 남의 것을 열어볼 수 있으면 안 됩니다.
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        나중에 새 지원사업을 메일이나 문자로 알려드리는 기능을 붙이게 되면,
        그때 필요한 항목과 보관 기간을 명시하고 따로 동의를 받겠습니다.
        동의 없이 먼저 받아두는 일은 하지 않습니다.
      </p>

      <H>5. 선택 항목 — 이름·연락처</H>
      <p className="mt-3 text-sm leading-relaxed">
        사용자명과 비밀번호로 저장 목록을 관리하실 때, 이름·휴대폰 뒤 8자리·
        이메일을 <b className="font-bold">선택으로</b> 남길 수 있습니다.
        비워두셔도 저장 기능은 그대로 씁니다.
      </p>

      <div className="card mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {[
              ["수집 항목", "이름, 휴대폰 뒤 8자리, 이메일 (모두 선택)"],
              ["이용 목적", "저장한 조건에 새 지원사업이 올라왔을 때 안내"],
              ["보관 기간", "삭제 요청 시 또는 3년간 접속이 없을 때까지"],
              ["동의 거부", "가능하며, 거부해도 저장 기능은 그대로 이용"],
            ].map(([k, v]) => (
              <tr key={k}>
                <th className="w-28 bg-surface2 px-4 py-3 text-left text-xs font-bold text-muted">
                  {k}
                </th>
                <td className="px-4 py-3">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm leading-relaxed">
        <b className="font-bold">지금은 아무것도 발송하지 않습니다.</b> 알림
        기능을 실제로 켜기 전에, 본인 연락처가 맞는지 확인하는 절차를 먼저
        붙이겠습니다. 확인을 거치지 않은 번호나 주소로는 보내지 않습니다 —
        남의 연락처를 적어 넣는 일을 막기 위해서입니다.
      </p>

      <p className="mt-2 text-sm leading-relaxed">
        비밀번호는 되돌릴 수 없는 형태(scrypt)로만 보관하며, 저희도 원문을 알 수
        없습니다.
      </p>

      <H>6. 자동 가입 방지</H>
      <p className="mt-3 text-sm leading-relaxed">
        계정을 만들거나 불러올 때 Cloudflare Turnstile 로 사람인지 확인합니다.
        이 도구는 광고 추적을 하지 않으며, 대부분의 경우 아무것도 누르지 않아도
        통과됩니다.
      </p>

      <H>7. 검색 조건은 주소창에 있습니다</H>
      <p className="mt-3 text-sm leading-relaxed">
        조회 조건은 서버가 아니라 주소(URL)에 담깁니다. 그래서 링크를 저장하거나
        공유하면 같은 결과를 다시 볼 수 있습니다. 다만 그 주소를 다른 사람에게
        보내면 조건도 함께 전달되니, 필요할 때만 공유하세요.
      </p>

      <H>8. 정보를 넘기지 않습니다</H>
      <p className="mt-3 text-sm leading-relaxed">
        제3자에게 정보를 제공하거나 판매하지 않습니다. 애초에 넘길 개인정보가
        없습니다. 화면에서 &lsquo;원문에서 확인하고 신청하기&rsquo;를 누르면
        복지로나 기업마당 등 공식 사이트로 이동하며, 그때부터는 해당 기관의
        방침이 적용됩니다.
      </p>

      <H>9. 데이터 보관</H>
      <p className="mt-3 text-sm leading-relaxed">
        조건 통계는 Supabase(서울 리전 외 해외 리전 포함)에 저장되며,
        서비스 개선 목적 외에는 쓰지 않습니다. 통계로서 가치가 없어진 기록은
        주기적으로 지웁니다.
      </p>

      <H>10. 문의</H>
      <p className="mt-3 text-sm leading-relaxed">
        방침에 대한 문의, 저장한 조건이나 연락처의 삭제 요청은 아래로 연락
        주세요. 사용자명을 알려주시면 해당 계정의 자료를 지워드립니다. 계정
        없이 이용하신 검색 통계는 개인을 식별할 수 있는 값이 없어, 특정인의
        기록만 찾아 지우는 것은 기술적으로 불가능합니다.
      </p>

      <p className="mt-8 text-xs text-muted">
        시행일 2026-09-06 · 방침이 바뀌면 이 페이지에 먼저 알립니다.
      </p>

      <Link href="/" className="btn btn-ghost mt-10">
        지원금 찾으러 가기
      </Link>
    </article>
  );
}
