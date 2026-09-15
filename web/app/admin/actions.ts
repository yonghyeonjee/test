"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { COOKIE_NAME, isLoggedIn, sessionCookie, verify } from "@/lib/auth";
import { collectAll, collectOne, COLLECT_KEYS, type CollectKey, type CollectResult } from "@/lib/collectors";
import { dispatchCollect } from "@/lib/ghDispatch";
import { probeSite, type SiteProbe } from "@/lib/gojobsSite";
import { probeOpenQst } from "@/lib/openQst";
import { probe, type RunReport, probePaging, type PageProbe } from "@/lib/jobsIngest";
import { parseAds, parseSeo } from "@/lib/settings";

/** 쓰기는 서비스 키로만. 브라우저에 절대 내려가지 않는다. */
function admin() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_KEY 미설정");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}

// 무차별 대입 방지: 5회 실패 시 15분 잠금.
// 서버리스라 인스턴스마다 카운터가 따로 있어 실제로는 이보다 관대하다.
// 400ms 지연이 더 실질적인 방어다.
const FAILS = new Map<string, { n: number; until: number }>();
const LIMIT = 5;
const LOCK_MS = 15 * 60_000;

export async function login(_: unknown, form: FormData) {
  const user = String(form.get("user") ?? "").trim();
  const pass = String(form.get("pass") ?? "").trim();
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

/**
 * JSON 설정(seo, ads) 저장. 모양을 한 번 걸러서 넣는다 — 화면이 기대하는
 * 항목만 남기고 나머지는 버린다. 없던 키면 만든다.
 */
export async function saveJsonSetting(key: "seo" | "ads", value: unknown) {
  if (!isLoggedIn()) return { error: "로그인이 필요합니다." };
  const clean = key === "seo" ? parseSeo(value) : parseAds(value);
  const { error } = await admin()
    .from("site_settings")
    .upsert({ key, value: clean as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  revalidatePath("/admin");
  return { error: null };
}

/**
 * 수집을 GitHub Actions 에 넘긴다. 창을 닫아도 거기서 끝까지 돈다.
 * 토큰이 없으면 null — 화면이 예전처럼 창 안에서 회차를 돌린다.
 */
export async function runInBackground(
  source: CollectKey | "all",
): Promise<{ configured: boolean; ok: boolean; url?: string; reason?: string }> {
  if (!isLoggedIn()) return { configured: false, ok: false, reason: "로그인이 필요합니다." };
  await setStop(false);
  const r = await dispatchCollect(source);
  if (r === null) return { configured: false, ok: false };
  return r.ok ? { configured: true, ok: true, url: r.url } : { configured: true, ok: false, reason: r.reason };
}

/**
 * 전체 수집. 채용부터 자격증·공공기관·금리까지 한 번에.
 *
 * 중지 단추는 stop 플래그를 DB 에 세운다. 이미 도는 함수를 밖에서 죽일 수는
 * 없지만, 다음 항목으로 넘어가기 전에 이 값을 보고 멈춘다.
 */
export async function runCollectAll(keys?: CollectKey[]): Promise<{ error: string | null; results: CollectResult[] }> {
  if (!isLoggedIn()) return { error: "로그인이 필요합니다.", results: [] };
  await setStop(false);
  const results = await collectAll(45_000, keys ?? COLLECT_KEYS);
  revalidatePath("/", "layout");
  return { error: null, results };
}

export async function runCollectOne(key: CollectKey): Promise<{ error: string | null; results: CollectResult[] }> {
  if (!isLoggedIn()) return { error: "로그인이 필요합니다.", results: [] };
  await setStop(false);
  // 함수 상한이 60초다. 한 항목만 돌려도 예산을 줘야 뒤쪽 쪽을 기다리다
  // 통째로 죽지 않는다. 못 끝낸 만큼은 다음에 누르면 이어받는다.
  const r = await collectOne(key, { pages: 4, budgetMs: 45_000 });
  revalidatePath("/", "layout");
  return { error: null, results: [r] };
}

/** 수집을 멈춘다. 도는 중인 항목은 끝내고 그다음부터 멈춘다. */
export async function stopCollect(): Promise<{ error: string | null }> {
  if (!isLoggedIn()) return { error: "로그인이 필요합니다." };
  await setStop(true);
  return { error: null };
}

async function setStop(on: boolean) {
  try {
    await admin().from("site_settings").upsert(
      { key: "collect_stop", value: { on, at: new Date().toISOString() } as never, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  } catch {
    /* 중지 표시 실패로 수집을 막지 않는다 */
  }
}

/** 연결과 항목 이름만 빠르게 확인한다. */
/**
 * 뒤쪽 쪽번호가 어디부터 안 되는지 본다. 25초 안에 끝난다.
 * 이 표를 보고 "몇 건씩, 어느 쪽까지" 읽을지 정한다.
 */
export async function probePagingLimits(): Promise<{ error: string | null; probes: PageProbe[] }> {
  if (!isLoggedIn()) return { error: "로그인이 필요합니다.", probes: [] };
  try {
    return { error: null, probes: await probePaging("gojobs") };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), probes: [] };
  }
}

/**
 * 공개문제 API 가 어떤 이름으로 오는지 찍어 본다.
 *
 * 문서에 한글 설명만 있고 영문 파라미터 이름이 없었다. 짐작해서 짜면
 * 지난번처럼 틀리니, 실제 응답을 보고 짠다.
 */
export async function probeOpenQuestions(): Promise<{ error: string | null; steps: SiteProbe[] }> {
  if (!isLoggedIn()) return { error: "로그인이 필요합니다.", steps: [] };
  try {
    return { error: null, steps: await probeOpenQst() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), steps: [] };
  }
}

/** 나라일터 사이트에서 직접 받아올 수 있는지 본다. robots.txt 부터 본다. */
export async function probeGojobsSite(): Promise<{ error: string | null; steps: SiteProbe[] }> {
  if (!isLoggedIn()) return { error: "로그인이 필요합니다.", steps: [] };
  try {
    return { error: null, steps: await probeSite() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), steps: [] };
  }
}

export async function probeJobsApi(): Promise<{ error: string | null; reports: RunReport[] }> {
  if (!isLoggedIn()) return { error: "로그인이 필요합니다.", reports: [] };
  const reports: RunReport[] = [];
  for (const s of ["gojobs", "worldjob"] as const) {
    try {
      reports.push(await probe(s));
    } catch (e) {
      reports.push({ source: s, ok: false, reason: e instanceof Error ? e.message : String(e), pages: [], saved: 0 });
    }
  }
  return { error: null, reports };
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
