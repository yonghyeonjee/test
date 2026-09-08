"use client";

import { useState } from "react";
import AccountBox from "./AccountBox";
import { claimRecoveryCode, getRecoveryCode } from "@/lib/saved";

/**
 * 저장한 조건 되찾기.
 *
 * 이름·전화번호를 받지 않는다. 저장 조건에는 저소득·장애인·한부모 같은
 * 항목이 들어가므로, 아는 사람이 열어볼 수 있는 열쇠를 쓰면 안 된다.
 * 추측이 불가능한 8자리 코드로 대신한다.
 */
export default function Recovery({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const issue = async () => {
    setBusy(true);
    try {
      const c = await getRecoveryCode();
      setCode(c);
      if (!c) setMsg("먼저 조건을 하나 저장해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const claim = async () => {
    setBusy(true);
    setMsg("");
    try {
      const ok = await claimRecoveryCode(input);
      if (ok) {
        setMsg("불러왔습니다.");
        setTimeout(() => window.location.reload(), 700);
      } else {
        setMsg("코드를 확인해주세요. 8자리입니다.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-xs text-muted underline underline-offset-4 hover:text-brand ${
          compact ? "" : "mt-2"
        }`}
      >
        저장한 조건 옮기기 · 되찾기
      </button>
    );

  return (
    <div className="card mt-3 p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-bold">저장한 조건 옮기기</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-faint hover:text-ink"
        >
          닫기
        </button>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-muted">
        휴대폰에서 저장한 걸 컴퓨터에서 보거나, 브라우저 기록을 지운 뒤 되찾을
        때 씁니다. 이름이나 연락처는 필요 없습니다.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold text-muted">이 기기의 코드 받기</p>
          {code ? (
            <p className="num mt-2 select-all rounded-ctl bg-brandSoft px-3 py-2.5
                          text-center text-lg font-extrabold tracking-[.25em] text-brand">
              {code}
            </p>
          ) : (
            <button
              type="button"
              onClick={issue}
              disabled={busy}
              className="btn btn-ghost mt-2 w-full py-2.5 text-[13px]"
            >
              코드 만들기
            </button>
          )}
          <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
            적어두거나 화면을 찍어두세요. 이 코드를 아는 사람은 저장 목록을 볼
            수 있으니 남에게 알려주지 마세요.
          </p>
        </div>

        <div>
          <p className="text-xs font-bold text-muted">다른 기기 코드 넣기</p>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && claim()}
            placeholder="ABCD2345"
            maxLength={9}
            className="field num mt-2 text-center text-lg font-bold tracking-[.25em]"
          />
          <button
            type="button"
            onClick={claim}
            disabled={busy || input.length < 8}
            className="btn btn-primary mt-2 w-full py-2.5 text-[13px]"
          >
            불러오기
          </button>
        </div>
      </div>

      {msg && <p className="mt-3 text-xs text-brand">{msg}</p>}

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-[13px] font-bold">사용자명으로 관리하기</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          코드를 적어두기 번거로우면 사용자명과 비밀번호를 정해두세요. 어느
          기기에서든 같은 저장 목록을 불러올 수 있습니다.
        </p>
        <div className="mt-3">
          <AccountBox />
        </div>
      </div>
    </div>
  );
}
