"use client";

import { useState } from "react";
import { updateContact } from "./actions";

export default function ContactForm({ device, initial }: {
  device: string;
  initial: { name: string; phone: string; email: string; consent: boolean };
}) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [consent, setConsent] = useState(initial.consent);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await updateContact({ device, name, phone, email, consent });
      setMsg(r.ok ? "저장했습니다." : r.error ?? "저장하지 못했습니다.");
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름 (선택)" className="field" />
        <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
               placeholder="휴대폰 뒤 8자리 (선택)" inputMode="numeric" className="field num" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" type="email" className="field" />
      </div>
      <label className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#5A4BE0]" />
        <span className="text-muted">
          지원사업 안내를 받기 위해 이름·휴대폰 뒤 8자리·이메일을 수집·이용하는 데 동의합니다.
          언제든 끌 수 있고, 끄면 연락처도 지웁니다.
        </span>
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="btn btn-primary px-4 py-2 text-[13.5px]">저장</button>
        {msg && <span className="text-[12.5px] text-brand">{msg}</span>}
      </div>
    </div>
  );
}
