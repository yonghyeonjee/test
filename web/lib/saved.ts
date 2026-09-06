import { createClient } from "@supabase/supabase-js";

/** 저장·열람은 서비스 키로만. anon 키로는 이 표를 아예 읽을 수 없다. */
export function svc() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_KEY 미설정");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}

export const digits = (s: string) => (s || "").replace(/\D/g, "");

/**
 * 열람 키로 쓸 8자리. 휴대폰이면 010 을 뺀 뒷자리와 같아진다.
 * 하이픈을 넣든 안 넣든, 010 을 적든 안 적든 같은 값이 나오게 뒤에서 자른다.
 */
export function phoneTail(raw: string) {
  const d = digits(raw);
  if (d.length < 8) return "";
  return d.slice(-8);
}

/** 이름은 공백만 정리해서 맞춘다. 띄어쓰기 때문에 못 찾는 일이 없도록. */
export const normName = (s: string) => (s || "").replace(/\s+/g, "").trim();

/** 사업자등록번호 10자리 검증식. 오타를 걸러 준다. */
export function validBizNo(raw: string) {
  const d = digits(raw);
  if (d.length !== 10) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * w[i];
  sum += Math.floor((Number(d[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(d[9]);
}

export const validEmail = (s: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((s || "").trim());

export type SavedRow = {
  id: number;
  kind: "welfare" | "business";
  label: string | null;
  query: string;
  created_at: string;
};
