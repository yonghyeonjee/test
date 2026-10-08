import type { Metadata } from "next";
import Link from "next/link";
import AccountBox from "@/components/AccountBox";
import SavedList from "@/components/SavedList";
import { myAccount } from "./actions";
import ContactForm from "./ContactForm";
import LogoutButton from "./LogoutButton";

/**
 * 내 계정. 로그인하면 저장한 조건·연락처·알림 수신 설정을 한곳에서 본다.
 * 로그인 전에는 만들기·불러오기 상자. 계정은 선택이다 — 없어도 이 브라우저 열쇠로 저장은 된다.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "내 계정 — K나라지원", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const me = await myAccount();
  return (
    <div className="mx-auto max-w-[40rem] py-6">
      <h1 className="text-[1.25rem] font-extrabold tracking-[-.02em]">내 계정</h1>
      {!me || !me.account ? (
        <>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            사용자명과 비밀번호를 정해두면 어느 기기에서든 같은 저장 목록을 불러오고, 새 공고 알림을 받을 수 있습니다.
            이름이나 주민등록번호는 받지 않습니다.
          </p>
          <div className="card mt-4 p-4 sm:p-5">
            <AccountBox />
          </div>
          <p className="mt-4 text-[12.5px] text-faint">
            계정 없이도 이 브라우저에서는 조건이 저장됩니다. <Link href="/" className="underline underline-offset-4">첫 화면</Link>에서 조건을 고르고 저장을 누르세요.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-[14px] text-muted">
            <b className="text-ink">{me.account.username}</b> 님으로 로그인돼 있습니다.
          </p>
          <section className="card mt-4 p-4 sm:p-5">
            <h2 className="text-[15px] font-extrabold tracking-[-.02em]">저장한 조건</h2>
            <p className="mt-1 text-[12.5px] text-muted">첫 화면에서 조건을 고르고 저장을 누르면 여기 쌓입니다.</p>
            <div className="mt-3"><SavedList /></div>
          </section>
          <section className="card mt-4 p-4 sm:p-5">
            <h2 className="text-[15px] font-extrabold tracking-[-.02em]">연락처 · 알림</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              저장한 조건에 새 공고가 올라오면 하루 한 번 이메일로 모아 보내는 기능을 준비하고 있습니다.
              동의를 켜두면 시작할 때 바로 받습니다. 언제든 끌 수 있습니다.
            </p>
            <ContactForm device={me.device} initial={{
              name: me.account.display_name ?? "", phone: me.account.phone_tail ?? "", email: me.account.email ?? "",
              consent: me.account.notify_consent,
            }} />
          </section>
          <div className="mt-6 flex items-center justify-between text-[12.5px] text-muted">
            <span>만든 날 {new Date(me.account.created_at).toLocaleDateString("ko-KR")}</span>
            <LogoutButton />
          </div>
        </>
      )}
    </div>
  );
}
