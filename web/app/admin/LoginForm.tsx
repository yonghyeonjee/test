"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login } from "./actions";

/**
 * 배경 영상은 환경변수로만 넣는다.
 *   NEXT_PUBLIC_LOGIN_VIDEO   .mp4 직접 주소
 *   NEXT_PUBLIC_LOGIN_CREDIT  출처 표기 (Pexels 등은 표기가 예의)
 *   NEXT_PUBLIC_LOGIN_CREDIT_URL
 * 비워두면 CSS 그라데이션만 나온다. 영상이 없어도 화면이 완성돼 있어야
 * CDN 이 막히거나 파일이 사라져도 깨지지 않는다.
 */
const VIDEO = process.env.NEXT_PUBLIC_LOGIN_VIDEO || "/login-bg.mp4";
const CREDIT = process.env.NEXT_PUBLIC_LOGIN_CREDIT || "";
const CREDIT_URL = process.env.NEXT_PUBLIC_LOGIN_CREDIT_URL || "";

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
    <div className="-mx-5 grid min-h-[calc(100vh-6rem)] overflow-hidden
                    sm:mx-0 sm:grid-cols-[1.15fr_1fr] sm:rounded-card">
      {/* 왼쪽: 분위기 패널 */}
      <div className="hero relative hidden flex-col justify-between p-9 text-white sm:flex">
        {VIDEO && (
          <video
            autoPlay muted loop playsInline preload="metadata"
            poster="/poster.jpg"
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          >
            <source src={VIDEO} type="video/mp4" />
          </video>
        )}
        <div className="relative">
          <p className="text-[11px] font-bold tracking-[.3em] text-[#8FCFB0]">
            지원찾기
          </p>
        </div>

        <div className="relative">
          <h2 className="text-[1.7rem] font-extrabold leading-tight">
            무엇을 찾다가
            <br />
            빈손으로 돌아갔는지
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#A9CFBC]">
            결과가 0건이던 조건이 곧 다음에 채울 데이터입니다.
          </p>
          <div className="mt-7 flex gap-7 text-sm">
            {[
              ["조건 통계", "지역 · 나이대"],
              ["빈 결과", "데이터 구멍"],
              ["운영 설정", "즉시 반영"],
            ].map(([a, b]) => (
              <div key={a}>
                <b className="block font-extrabold">{a}</b>
                <small className="text-[#A9CFBC]">{b}</small>
              </div>
            ))}
          </div>
        </div>

        {CREDIT && (
          <a href={CREDIT_URL || "#"} target="_blank" rel="noopener noreferrer"
             className="relative text-[11px] text-white/45 hover:text-white/80">
            {CREDIT}
          </a>
        )}
      </div>

      {/* 오른쪽: 로그인 */}
      <div className="flex items-center justify-center bg-surface px-6 py-14">
        <form action={action} className="w-full max-w-[19rem]">
          <p className="text-[11px] font-bold tracking-[.25em] text-brand">
            SIGN IN
          </p>
          <h1 className="mt-2 text-2xl font-extrabold">관리자</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            지원찾기 운영 화면입니다. 내부용이며 검색엔진에 노출되지 않습니다.
          </p>

          <label className="mt-7 block text-xs font-bold text-muted">아이디</label>
          <input name="user" autoComplete="username" className="field mt-1.5" />

          <label className="mt-4 block text-xs font-bold text-muted">비밀번호</label>
          <input name="pass" type="password" autoComplete="current-password"
                 className="field mt-1.5" />

          {state?.error && (
            <p className="mt-4 rounded-ctl bg-alertSoft px-3 py-2.5 text-sm text-alert">
              {state.error}
            </p>
          )}

          <Submit />

          <p className="mt-5 text-[11px] leading-relaxed text-faint">
            5회 실패하면 15분 동안 잠깁니다.
          </p>
        </form>
      </div>
    </div>
  );
}
