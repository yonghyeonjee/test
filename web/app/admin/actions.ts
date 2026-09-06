"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { COOKIE_NAME, isLoggedIn, sessionCookie, verify } from "@/lib/auth";

/** 쓰기는 서비스 키로만. 브라우저에 절대 내려가지 않는다. */
function admin() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_KEY 미설정");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}

// 무차별 대입 방지: 5회 실패 시 15분 잠금 (Datacenter 와 같은 정책)
const FAILS = new Map<string, { n: number; until: number }>();
const LIMIT = 5;
const LOCK_MS = 15 * 60_000;

export async function login(_: unknown, form: FormData) {
  const user = String(form.get("user") ?? "");
  const pass = String(form.get("pass") ?? "");
  const now = Date.now();

  const rec = FAILS.get(user);
  if (rec && rec.until > now) {
    const min = Math.ceil((rec.until - now) / 60_000);
    return { error: `실패가 많아 잠겼습니다. ${min}분 뒤에 다시 시도하세요.` };
  }

  await new Promise((r) => setTimeout(r, 400)); // 속도 자체를 늦춘다

  if (!verify(user, pass)) {
    const n = (rec && rec.until <= now ? 0 : rec?.n ?? 0) + 1;
    FAILS.set(user, { n, until: n >= LIMIT ? now + LOCK_MS : 0 });
    const left = LIMIT - n;
    return {
      error:
        left > 0
          ? `아이디 또는 비밀번호가 다릅니다. (${left}회 남음)`
          : "실패가 많아 15분간 잠겼습니다.",
    };
  }

  FAILS.delete(user);
  cookies().set(sessionCookie());
  revalidatePath("/admin");
  return { error: null };
}

export async function logout() {
  cookies().delete(COOKIE_NAME);
  revalidatePath("/admin");
}

export async function saveSetting(key: string, value: string) {
  if (!isLoggedIn()) return { error: "로그인이 필요합니다." };
  const allowed = ["min_confidence", "closing_days", "new_days", "notice"];
  if (!allowed.includes(key)) return { error: "허용되지 않은 항목입니다." };

  const num = ["min_confidence", "closing_days", "new_days"].includes(key);
  const parsed = num ? Number(value) : value;
  if (num && !Number.isFinite(parsed as number))
    return { error: "숫자를 넣어주세요." };

  await admin()
    .from("site_settings")
    .update({ value: parsed as never, updated_at: new Date().toISOString() })
    .eq("key", key);

  revalidatePath("/admin");
  revalidatePath("/");
  return { error: null };
}

/** 목록에서 특정 사업을 내린다 (확신도를 0 으로) */
export async function hideProgram(sourceId: string) {
  if (!isLoggedIn()) return { error: "로그인이 필요합니다." };
  await admin()
    .from("programs")
    .update({ norm_confidence: 0, norm_notes: "관리자 비노출" })
    .eq("source_id", sourceId);
  revalidatePath("/");
  return { error: null };
}

export async function refreshCache() {
  if (!isLoggedIn()) return { error: "로그인이 필요합니다." };
  revalidatePath("/", "layout");
  return { error: null };
}
