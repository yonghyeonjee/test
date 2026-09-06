import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description:
    `${SITE_NAME}는 회원가입 없이 이용할 수 있으며 이름·연락처·주민등록번호를 ` +
    "수집하지 않습니다. 어떤 정보를 어떻게 다루는지 정리했습니다.",
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

      <H>1. 수집하지 않는 것</H>
      <ul className="mt-3 space-y-1.5 text-sm leading-relaxed">
        {[
          "이름 · 생년월일 · 주민등록번호",
          "전화번호 · 이메일 · 주소",
          "소득 · 재산 · 가족관계 등 행정정보",
          "IP 주소 · 브라우저 정보(User-Agent) · 접속 기기 식별자",
          "로그인 정보 (계정 자체가 없습니다)",
          "검색창에 직접 입력하신 문장",
        ].map((s) => (
          <li key={s} className="flex gap-2">
            <span className="text-brand">·</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>

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

      <H>3. 쿠키</H>
      <p className="mt-3 text-sm leading-relaxed">
        일반 이용자에게는 쿠키를 심지 않습니다. 광고나 추적 도구도 넣지
        않습니다. 관리자 화면(<code className="rounded bg-surface2 px-1">/admin</code>)에
        로그인할 때만 인증용 쿠키를 하나 사용하며, 8시간 뒤 만료됩니다.
      </p>

      <H>4. 검색 조건은 주소창에 있습니다</H>
      <p className="mt-3 text-sm leading-relaxed">
        조회 조건은 서버가 아니라 주소(URL)에 담깁니다. 그래서 링크를 저장하거나
        공유하면 같은 결과를 다시 볼 수 있습니다. 다만 그 주소를 다른 사람에게
        보내면 조건도 함께 전달되니, 필요할 때만 공유하세요.
      </p>

      <H>5. 정보를 넘기지 않습니다</H>
      <p className="mt-3 text-sm leading-relaxed">
        제3자에게 정보를 제공하거나 판매하지 않습니다. 애초에 넘길 개인정보가
        없습니다. 화면에서 &lsquo;원문에서 확인하고 신청하기&rsquo;를 누르면
        복지로나 기업마당 등 공식 사이트로 이동하며, 그때부터는 해당 기관의
        방침이 적용됩니다.
      </p>

      <H>6. 데이터 보관</H>
      <p className="mt-3 text-sm leading-relaxed">
        조건 통계는 Supabase(서울 리전 외 해외 리전 포함)에 저장되며,
        서비스 개선 목적 외에는 쓰지 않습니다. 통계로서 가치가 없어진 기록은
        주기적으로 지웁니다.
      </p>

      <H>7. 문의</H>
      <p className="mt-3 text-sm leading-relaxed">
        방침에 대한 문의나 기록 삭제 요청은 아래로 연락 주세요. 다만 개인을
        식별할 수 있는 기록 자체가 없어, 특정인의 기록만 찾아 지우는 것은
        기술적으로 불가능합니다.
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
