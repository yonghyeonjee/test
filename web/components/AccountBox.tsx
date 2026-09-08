"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { createAccount, loginAccount } from "@/app/account/actions";
import { track } from "./Gtm";
import { deviceKey, setDeviceKey } from "@/lib/saved";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, o: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

/** 캡차 위젯. 키가 없으면 아무것도 그리지 않는다. */
function Captcha({ onToken }: { onToken: (t: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY || !box.current || id.current) return;
    const draw = () => {
      if (!window.turnstile || !box.current || id.current) return;
      id.current = window.turnstile.render(box.current, {
        sitekey: SITE_KEY,
        callback: onToken,
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
        theme: "light",
        size: "flexible",
      });
    };
    draw();
    const t = setInterval(draw, 400);
    return () => clearInterval(t);
  }, [onToken]);

  if (!SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="lazyOnload"
      />
      <div ref={box} className="mt-3" />
    </>
  );
}

export default function AccountBox({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [more, setMore] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r =
        mode === "signup"
          ? await createAccount({
              username, password,
              device: deviceKey() ?? crypto.randomUUID(),
              name, phone, email, consent, captcha: token,
            })
          : await loginAccount({ username, password, captcha: token });

      if (!r.ok) {
        setMsg(r.error ?? "실패했습니다.");
        window.turnstile?.reset();
        setToken(null);
        return;
      }
      if (r.device) setDeviceKey(r.device);
      track(mode === "signup" ? "account_create" : "account_login", {
        gave_contact: mode === "signup" ? Boolean(phone || email) : undefined,
      });
      setMsg(mode === "signup" ? "만들었습니다." : "불러왔습니다.");
      onDone?.();
      setTimeout(() => window.location.reload(), 600);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex gap-1 rounded-pill bg-ground p-1">
        {(["signup", "login"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setMsg(""); }}
            className={`flex-1 rounded-pill py-2 text-[13px] transition-colors ${
              mode === m ? "bg-surface font-bold shadow-card" : "text-muted"
            }`}
          >
            {m === "signup" ? "새로 만들기" : "불러오기"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <input
          value={username}
          onChange={(e) => setU(e.target.value)}
          placeholder="사용자명"
          autoComplete="username"
          className="field"
        />
        <input
          value={password}
          onChange={(e) => setP(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          type="password"
          placeholder="비밀번호"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="field"
        />
      </div>

      {mode === "signup" && (
        <>
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            className="mt-3 text-xs text-muted underline underline-offset-4 hover:text-brand"
          >
            {more ? "연락처 접기" : "연락처 남기기 (선택)"}
          </button>

          {more && (
            <div className="mt-2 rounded-card bg-surface2 p-3.5">
              <p className="text-xs leading-relaxed text-muted">
                지금은 아무것도 보내지 않습니다. 나중에 저장한 조건에 새 사업이
                올라오면 알려드리는 기능을 만들 때 쓰려는 것이며, 그때 다시
                안내드립니다. 비워두셔도 저장은 됩니다.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <input value={name} onChange={(e) => setName(e.target.value)}
                       placeholder="이름" className="field" />
                <input value={phone}
                       onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
                       placeholder="휴대폰 뒤 8자리" inputMode="numeric"
                       className="field num" />
                <input value={email} onChange={(e) => setEmail(e.target.value)}
                       placeholder="이메일" type="email" className="field" />
              </div>
              <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed">
                <input type="checkbox" checked={consent}
                       onChange={(e) => setConsent(e.target.checked)}
                       className="mt-0.5 h-4 w-4 shrink-0 accent-[#0D6B4F]" />
                <span className="text-muted">
                  지원사업 안내를 받기 위해 이름·휴대폰 뒤 8자리·이메일을
                  수집·이용하는 데 동의합니다. 언제든 삭제를 요청할 수 있고,
                  자세한 내용은 개인정보 처리방침에 있습니다.
                </span>
              </label>
            </div>
          )}
        </>
      )}

      <Captcha onToken={setToken} />

      <button
        type="button"
        onClick={submit}
        disabled={busy || username.length < 2 || password.length < 8}
        className="btn btn-primary mt-3 w-full py-3"
      >
        {mode === "signup" ? "만들고 저장 이어가기" : "불러오기"}
      </button>

      {msg && <p className="mt-2.5 text-xs text-brand">{msg}</p>}

      <p className="mt-3 text-[11px] leading-relaxed text-faint">
        비밀번호는 되돌릴 수 없는 형태로만 보관합니다. 잊으면 복구 코드로
        되찾아야 하니, 코드도 함께 적어두세요.
      </p>
    </div>
  );
}
