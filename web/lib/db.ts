import { createClient } from "@supabase/supabase-js";

// 읽기 전용. anon 키만 사용한다 — service_role 키는 절대 여기 넣지 않는다.
export const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export type Program = {
  id: number;
  kind: "welfare" | "business" | "event";
  source: string;
  title: string;
  summary: string | null;
  detail_url: string | null;
  org_name: string | null;
  dept_name: string | null;
  sido: string | null;
  sigungu: string | null;
  age_min: number | null;
  age_max: number | null;
  income_pct: number | null;
  employment: string[] | null;
  household: string[] | null;
  topics: string[] | null;
  apply_end: string | null;
  is_always_on: boolean;
  support_type: string | null;
  contact: string | null;
  norm_confidence: number | null;
};

export const EMPLOYMENT = ["미취업", "재직", "자영업", "구직중", "학생", "퇴직"];
export const HOUSEHOLD = [
  "저소득", "장애인", "한부모·조손", "다자녀",
  "다문화·탈북민", "보훈대상자", "1인가구", "임산부", "무주택",
];

/** 데이터가 실제로 있는 지역만 (시도 → 시군구) */
export async function getRegions() {
  const { data } = await db
    .from("regions_available")
    .select("sido,sigungu,n");

  const map = new Map<string, { name: string; n: number }[]>();
  for (const r of data ?? []) {
    if (!r.sido) continue;
    const list = map.get(r.sido) ?? [];
    if (r.sigungu) list.push({ name: r.sigungu, n: r.n });
    map.set(r.sido, list);
  }
  return Array.from(map.entries())
    .map(([sido, list]) => ({
      sido,
      sigungu: list.sort((a, b) => a.name.localeCompare(b.name, "ko")),
    }))
    .sort((a, b) => a.sido.localeCompare(b.sido, "ko"));
}

export async function getCoverage() {
  const { data } = await db.from("coverage").select("*");
  const row = (data ?? []).find((d) => d.kind === "welfare");
  return { usable: row?.usable ?? 0, total: row?.total ?? 0 };
}

export type WelfareQuery = {
  sido?: string;
  sigungu?: string;
  age?: number;
  employment?: string;
  household?: string[];
};

export async function matchWelfare(q: WelfareQuery, limit = 60) {
  const { data, error } = await db.rpc("match_welfare", {
    p_sido: q.sido || null,
    p_sigungu: q.sigungu || null,
    p_age: q.age ?? null,
    p_employment: q.employment || null,
    p_household: q.household?.length ? q.household : null,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as Program[];
}

/** 마감까지 남은 일수. 상시는 null */
export function daysLeft(p: Pick<Program, "apply_end" | "is_always_on">) {
  if (p.is_always_on || !p.apply_end) return null;
  const end = new Date(p.apply_end + "T23:59:59+09:00").getTime();
  return Math.ceil((end - Date.now()) / 86_400_000);
}
