import type { Metadata } from "next";
import Link from "next/link";
import SavedItems from "@/components/SavedItems";
import SavedList from "@/components/SavedList";
import { myAccount } from "@/app/account/actions";

/**
 * 저장한 공고·사업과 조건을 한곳에서. 로그인 없이도 이 브라우저 열쇠로 보이고,
 * 계정이 있으면 어느 기기에서든 같은 목록이다. 색인하지 않는다(robots HIDDEN).
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "저장한 공고·사업 — K나라지원", robots: { index: false, follow: false } };

export default async function SavedPage() {
  const me = await myAccount();
  return (
    <div className="mx-auto max-w-[40rem] py-6">
      <h1 className="text-[1.25rem] font-extrabold tracking-[-.02em]">저장한 공고·사업</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        공고나 사업 쪽에서 <b className="text-ink">저장</b>을 누른 것들입니다. 마감이 지난 것은 흐리게 보입니다.
      </p>
      <section className="card mt-4 p-4 sm:p-5">
        <SavedItems variant="list" />
      </section>

      <section className="card mt-4 p-4 sm:p-5">
        <h2 className="text-[15px] font-extrabold tracking-[-.02em]">저장한 조건</h2>
        <p className="mt-1 text-[12.5px] text-muted">첫 화면에서 조건을 고르고 저장을 누르면 여기 쌓입니다.</p>
        <div className="mt-3"><SavedList /></div>
      </section>

      <section className="card mt-4 p-4 text-[13.5px] leading-relaxed sm:p-5">
        {me?.account ? (
          <p><b>{me.account.username}</b> 님 계정에 저장돼 있습니다. 다른 기기에서도 같은 사용자명으로 불러오면 그대로 보입니다. <Link href="/account" className="underline underline-offset-4">내 계정</Link></p>
        ) : (
          <p>
            지금은 이 브라우저에만 매여 있습니다. 사용자명과 비밀번호를 정해두면 휴대폰과 컴퓨터 어디서든 같은 목록을 불러옵니다.
            이름이나 연락처는 받지 않습니다. <Link href="/account" className="font-semibold text-brand underline underline-offset-4">계정 만들기 · 불러오기</Link>
          </p>
        )}
      </section>
    </div>
  );
}
