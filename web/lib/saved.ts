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

/** 010-1234-5678 처럼 보기 좋게. 자릿수가 안 맞으면 원본 그대로 둔다. */
export function fmtPhone(raw: string) {
  const d = digits(raw);
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

/** 123-45-67890 */
export function fmtBizNo(raw: string | null) {
  if (!raw) return null;
  const d = digits(raw);
  if (d.length !== 10) return raw;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** 저장된 조건을 사람이 읽는 문장으로. 주소 파라미터를 그대로 풀어 쓴다. */
export function describeQuery(query: string) {
  const sp = new URLSearchParams(query);
  const bits: string[] = [];
  const push = (v: string | null) => v && bits.push(v);

  push(sp.get("sigungu") ?? sp.get("sido"));
  const age = sp.get("age");
  if (age) bits.push(`${age}세`);
  push(sp.get("emp"));
  bits.push(...sp.getAll("hh"));

  push(sp.get("target"));
  const years = sp.get("years");
  if (years) bits.push(`업력 ${years}년`);
  bits.push(...sp.getAll("ind"));
  bits.push(...sp.getAll("field"));

  return bits;
}
