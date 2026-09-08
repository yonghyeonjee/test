"use server";

import { createClient } from "@supabase/supabase-js";
import { verifyCaptcha } from "@/lib/captcha";
import { hash, verify, weak } from "@/lib/password";

/** 계정 관련 쓰기는 전부 서버에서. 서비스 키는 브라우저로 내려가지 않는다. */
function svc() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_KEY 가 없습니다.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}

export type Result = { ok: boolean; error?: string; device?: string };

const USERNAME = /^[가-힣a-zA-Z0-9_]{2,20}$/;

export async function createAccount(form: {
  username: string;
  password: string;
  device: string;
  name?: string;
  phone?: string;
  email?: string;
  consent?: boolean;
  captcha?: string | null;
}): Promise<Result> {
  if (!(await verifyCaptcha(form.captcha ?? null)))
    return { ok: false, error: "사람인지 확인에 실패했습니다. 다시 시도해주세요." };

  const username = form.username.trim();
  if (!USERNAME.test(username))
    return { ok: false, error: "사용자명은 한글·영문·숫자 2~20자입니다." };

  const bad = weak(form.password);
  if (bad) return { ok: false, error: bad };

  // 연락처를 넣었으면 동의가 있어야 한다. 동의 없이 받아두지 않는다.
  const gaveContact = Boolean(form.phone || form.email);
  if (gaveContact && !form.consent)
    return { ok: false, error: "연락처를 남기시려면 안내 수신에 동의해주세요." };

  const db = svc();

  const { data: taken } = await db.rpc("account_taken", { p_username: username });
  if (taken) return { ok: false, error: "이미 쓰이는 사용자명입니다." };

  const { error } = await db.rpc("account_create", {
    p_username: username,
    p_hash: await hash(form.password),
    p_device: form.device,
    p_name: form.name?.trim() || null,
    p_phone: form.phone?.replace(/[^0-9]/g, "") || null,
    p_email: form.email?.trim() || null,
    p_consent: Boolean(form.consent && gaveContact),
  });
  if (error)
    return { ok: false, error: "만들지 못했습니다. 잠시 뒤 다시 시도해주세요." };

  return { ok: true, device: form.device };
}

export async function loginAccount(form: {
  username: string;
  password: string;
  captcha?: string | null;
}): Promise<Result> {
  if (!(await verifyCaptcha(form.captcha ?? null)))
    return { ok: false, error: "사람인지 확인에 실패했습니다. 다시 시도해주세요." };

  const db = svc();
  const { data } = await db.rpc("account_probe", { p_username: form.username });
  const row = (data ?? [])[0] as
    | { hash: string; device: string; locked: boolean }
    | undefined;

  // 없는 사용자명에도 같은 시간을 쓴다. 존재 여부를 알려주지 않는다.
  if (!row) {
    await hash(form.password);
    return { ok: false, error: "사용자명 또는 비밀번호가 다릅니다." };
  }
  if (row.locked)
    return { ok: false, error: "실패가 많아 잠겼습니다. 15분 뒤 다시 시도해주세요." };

  const ok = await verify(form.password, row.hash);
  await db.rpc("account_mark", { p_username: form.username, p_ok: ok });

  return ok
    ? { ok: true, device: row.device }
    : { ok: false, error: "사용자명 또는 비밀번호가 다릅니다." };
}

export async function updateContact(form: {
  device: string;
  name?: string;
  phone?: string;
  email?: string;
  consent: boolean;
}): Promise<Result> {
  const gave = Boolean(form.phone || form.email);
  if (gave && !form.consent)
    return { ok: false, error: "연락처를 남기시려면 안내 수신에 동의해주세요." };

  await svc().rpc("account_update_contact", {
    p_device: form.device,
    p_name: form.name?.trim() || null,
    p_phone: form.phone?.replace(/[^0-9]/g, "") || null,
    p_email: form.email?.trim() || null,
    p_consent: form.consent && gave,
  });
  return { ok: true };
}
