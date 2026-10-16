"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login } from "./actions";
import { BrandMark } from "@/components/Illus";

/**
 * 관리자 로그인. 가운데 작은 카드 하나.
 *
 * 2026-10-16 까지는 왼쪽에 영상 패널(login-bg.mp4)을 두고 오른쪽에 폼을 둔 두 기둥이었다.
 * 영상이 패널 안에 어긋나게 떠서 "이게 뭐냐"는 말을 들었다. 운영자 혼자 쓰는 화면에
 * 분위기 패널은 필요 없다. 영상·포스터 파일은 더 쓰지 않는다.
 */
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary mt-6 w-full" disabled={pending}>
      {pending ? "확인 중..." : "로그인"}
    </button>
  );
}

export default function LoginForm() {
  const [state, action] = useFormState(login, { error: null as string | null });

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center py-10">
      <form action={action} className="card w-full max-w-[22rem] p-7 sm:p-8">
        <div className="flex items-center gap-2">
          <BrandMark className="h-7 w-7" />
          <span className="display text-[1.1rem] text-ink"><span className="text-brand">K</span>나라지원</span>
        </div>
        <h1 className="mt-5 text-[1.375rem] font-extrabold tracking-[-.02em]">관리자 로그인</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          운영 화면입니다. 검색엔진에 노출되지 않습니다.
        </p>

        <label htmlFor="admin-user" className="mt-6 block text-xs font-bold text-muted">아이디</label>
        <input id="admin-user" name="user" autoComplete="username" className="field mt-1.5" />

        <label htmlFor="admin-pass" className="mt-4 block text-xs font-bold text-muted">비밀번호</label>
        <input id="admin-pass" name="pass" type="password" autoComplete="current-password" className="field mt-1.5" />

        {state?.error && (
          <p className="mt-4 rounded-ctl bg-alertSoft px-3 py-2.5 text-sm text-alert">{state.error}</p>
        )}

        <Submit />

        <p className="mt-4 text-[11.5px] leading-relaxed text-faint">5회 실패하면 15분 동안 잠깁니다.</p>
      </form>
    </div>
  );
}
