import { createClient } from "@supabase/supabase-js";
import { buildWithoutDb, emptyDbFetch } from "./buildNoDb";

/**
 * 서버 전용 Supabase 클라이언트(service_role 키).
 *
 * 브라우저가 anon 키로 직접 부르던 RPC(저장 조건·복구 코드·기록·계정)는
 * 이제 Next 의 API 경로가 대신 부른다. 그 함수들은 anon 의 EXECUTE 를
 * 거두고 service_role 에만 남긴다. 이 키는 절대 브라우저로 내려가지 않는다.
 */
export function svcDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_KEY 가 없습니다.");
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: buildWithoutDb ? emptyDbFetch : (u, i) => fetch(u, { ...i, cache: "no-store" }) } });
}

export const svcConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
