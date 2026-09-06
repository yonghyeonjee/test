"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveSearch, type SaveState } from "@/app/saved/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full py-3.5">
      {pending ? "저장하는 중…" : "이 조건 저장하기"}
    </button>
  );
}

/**
 * 찾은 조건을 남겨 두고 다음에 다시 여는 기능.
 * 개인과 기업 양쪽에서 같이 쓴다 — 기업일 때만 사업자등록번호를 묻는다.
 */
export default function SaveSearch({ kind }: { kind: "welfare" | "business" }) {
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<SaveState, FormData>(saveSearch, {});

  const query = sp.toString();

  if (state.ok)
    return (
      <div className="card mt-6 p-5">
        <p className="font-bold text-brand">{state.ok}</p>
        <Link href="/saved" className="btn btn-ghost mt-4">
          저장한 조건 보기
        </Link>
      </div>
    );

  if (!open)
    return (
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost">
          이 조건 저장하기
        </button>
        <Link href="/saved" className="text-sm text-muted underline underline-offset-4 hover:text-brand">
          저장한 조건 보기
        </Link>
      </div>
    );

  return (
    <form action={action} className="card mt-6 p-5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="query" value={query} />

      <h2 className="text-[1.0625rem] font-bold">이 조건 저장하기</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        다음에 이름과 휴대폰 번호만 넣으면 지금 조건을 그대로 다시 엽니다.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-bold">이름</span>
          <input name="name" required autoComplete="name" className="field mt-1.5" />
        </label>
        <label className="block">
          <span className="text-sm font-bold">휴대폰 번호</span>
          <input
            name="phone"
            required
            inputMode="numeric"
            autoComplete="tel"
            placeholder="010-1234-5678"
            className="field mt-1.5"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold">이메일</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="field mt-1.5"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold">
            사업자등록번호
            {kind === "business" ? (
              <span className="ml-1 font-normal text-muted">선택</span>
            ) : (
              <span className="ml-1 font-normal text-muted">있으면</span>
            )}
          </span>
          <input
            name="biz_no"
            inputMode="numeric"
            placeholder="000-00-00000"
            className="field mt-1.5"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-bold">
            메모 <span className="ml-1 font-normal text-muted">선택</span>
          </span>
          <input
            name="label"
            placeholder="예: 어머니 조건"
            className="field mt-1.5"
          />
        </label>
      </div>

      <label className="mt-5 flex items-start gap-2.5 text-sm leading-relaxed">
        <input name="agree" type="checkbox" required className="mt-1 h-4 w-4 shrink-0 accent-brand" />
        <span className="text-muted">
          조회 조건을 다시 열어드리고 지원사업 안내를 보내드리기 위해 이름,
          휴대폰 번호, 이메일, 사업자등록번호를 수집·이용하는 데 동의합니다.
          보관 기간과 파기 방법은{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-brand">
            개인정보 처리방침
          </Link>
          에 적어 두었습니다.
        </span>
      </label>

      {state.error && (
        <p className="mt-4 text-sm font-bold text-alert">{state.error}</p>
      )}

      <div className="mt-5 flex gap-2">
        <Submit />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn btn-ghost shrink-0"
        >
          닫기
        </button>
      </div>
    </form>
  );
}
