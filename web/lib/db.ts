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
  source_id: string;
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
  biz_target: string[] | null;
  biz_field: string[] | null;
  biz_years_min: number | null;
  biz_years_max: number | null;
  industry: string[] | null;
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

export const BIZ_TARGET = [
  "소상공인", "중소기업", "예비창업자", "창업기업",
  "중견기업", "협동조합", "사회적기업",
];

// 실제 데이터 분포순
export const BIZ_FIELD = [
  "경영", "기술", "금융", "판로", "수출", "인력", "시설", "창업",
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
  const pick = (k: string) =>
    (data ?? []).find((d) => d.kind === k)?.usable ?? 0;
  return { welfare: pick("welfare"), business: pick("business") };
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
export type BusinessQuery = {
  sido?: string;
  bizTarget?: string;
  bizField?: string[];
  bizYears?: number;
};

export async function matchBusiness(q: BusinessQuery, limit = 60) {
  const { data, error } = await db.rpc("match_business", {
    p_sido: q.sido || null,
    p_biz_target: q.bizTarget || null,
    p_biz_field: q.bizField?.length ? q.bizField : null,
    p_biz_years: q.bizYears ?? null,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as Program[];
}

/** 기업 지원사업이 있는 시도 (해당 없음 = 전국) */
export async function getBusinessRegions() {
  const { data } = await db
    .from("programs_public")
    .select("sido")
    .eq("kind", "business")
    .not("sido", "is", null);
  return Array.from(new Set((data ?? []).map((d) => d.sido as string)))
    .sort((a, b) => a.localeCompare(b, "ko"));
}


// ── 상세 / 지역 페이지 ────────────────────────────────────

export type Detail = Program & {
  target_text: string | null;
  criteria_text: string | null;
  benefit_text: string | null;
  apply_start: string | null;
  support_cycle: string | null;
  life_cycle: string[] | null;
  apply_method: string | null;
};

export async function getProgram(sourceId: string) {
  const { data } = await db
    .from("program_detail")
    .select("*")
    .eq("source_id", sourceId)
    .maybeSingle();
  return (data ?? null) as Detail | null;
}

/** 빌드 시 미리 만들어 둘 상세 페이지 목록 */
export async function getTopSourceIds(limit = 400) {
  const { data } = await db
    .from("programs_public")
    .select("source_id")
    .order("norm_confidence", { ascending: false })
    .limit(limit);
  return (data ?? []).map((d) => d.source_id as string);
}

/** 같은 지역의 다른 사업 */
export async function getRelated(p: Program, limit = 5) {
  let q = db
    .from("programs_public")
    .select("*")
    .eq("kind", p.kind)
    .neq("source_id", p.source_id)
    .limit(limit);
  q = p.sigungu ? q.eq("sigungu", p.sigungu) : p.sido ? q.eq("sido", p.sido) : q;
  const { data } = await q.order("norm_confidence", { ascending: false });
  return (data ?? []) as Program[];
}

export type Area = {
  sido: string;
  n: number;
  youth: number;
  senior: number;
  low_income: number;
  disabled: number;
  family: number;
};

export async function getAreas() {
  const { data } = await db.from("area_summary").select("*");
  return ((data ?? []) as Area[]).sort((a, b) => b.n - a.n);
}

export async function getArea(sido: string) {
  const { data } = await db
    .from("area_summary")
    .select("*")
    .eq("sido", sido)
    .maybeSingle();
  return (data ?? null) as Area | null;
}

export async function listByArea(sido: string, limit = 100) {
  const { data } = await db
    .from("programs_public")
    .select("*")
    .eq("kind", "welfare")
    .eq("sido", sido)
    .order("norm_confidence", { ascending: false })
    .limit(limit);
  return (data ?? []) as Program[];
}

export function ageLabel(p: Pick<Program, "age_min" | "age_max">) {
  if (p.age_min !== null && p.age_max !== null) return `만 ${p.age_min}~${p.age_max}세`;
  if (p.age_min !== null) return `만 ${p.age_min}세 이상`;
  if (p.age_max !== null) return `만 ${p.age_max}세 이하`;
  return null;
}

export function daysLeft(p: Pick<Program, "apply_end" | "is_always_on">) {
  if (p.is_always_on || !p.apply_end) return null;
  const end = new Date(p.apply_end + "T23:59:59+09:00").getTime();
  return Math.ceil((end - Date.now()) / 86_400_000);
}
