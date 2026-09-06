"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { findSaved, type FindState } from "@/app/saved/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary shrink-0 px-6">
      {pending ? "찾는 중…" : "찾기"}
    </button>
  );
}

const fmt = (iso: string) => iso.slice(0, 10);

export default function SavedLookup() {
  const [state, action] = useFormState<FindState, FormData>(findSaved, {});

  return (
    <>
      <form action={action} className="card mt-7 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
        <div className="mt-4 flex justify-end">
          <Submit />
        </div>
        {state.error && (
          <p className="mt-3 text-sm font-bold text-alert">{state.error}</p>
        )}
      </form>

      {state.asked && !state.error && state.rows?.length === 0 && (
        <div className="card mt-4 p-8 text-center">
          <p className="leading-relaxed text-muted">
            저장된 조건을 찾지 못했습니다.
            <br />
            저장하실 때 넣으신 이름·번호와 같은지 확인해주세요.
          </p>
        </div>
      )}

      {!!state.rows?.length && (
        <div className="mt-4 grid gap-3">
          {state.rows.map((r) => (
            <Link
              key={r.id}
              href={`/?${r.query}`}
              className="card card-link block p-5"
            >
              <div className="flex items-center gap-2">
                <span className="badge badge-open">
                  {r.kind === "business" ? "기업 지원사업" : "개인 복지"}
                </span>
                <span className="num text-xs text-muted">{fmt(r.created_at)} 저장</span>
              </div>
              <b className="mt-2 block text-[1.0625rem]">
                {r.label ?? "저장한 조건"}
              </b>
              <span className="mt-1 block text-sm text-muted">
                눌러서 이 조건으로 다시 찾기
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
