/**
 * 관리자 화면에서 저장 내역을 읽기 좋게 만드는 것들.
 * 저장 자체는 lib/saved.ts(브라우저 쪽)가 맡고, 여기는 표시 전용이다.
 */

const digits = (s: string) => (s || "").replace(/\D/g, "");

/** 뒷자리만 보관하므로 그대로 보여준다. 앞자리는 애초에 저장하지 않는다. */
export function fmtPhoneTail(raw: string | null) {
  const d = digits(raw ?? "");
  if (!d) return null;
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return d;
}

/** 저장된 주소를 사람이 읽는 조각으로 되돌린다. */
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

export const when = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
