import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 비어 있는 환경변수 이름들. 설정이 끝났으면 빈 배열이다. */
export const missingDbEnv = (
  [
    ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_ANON_KEY],
  ] as const
)
  .filter(([, v]) => !v)
  .map(([k]) => k);

export const dbConfigured = missingDbEnv.length === 0;

export function dbEnvError() {
  return new Error(
    `Supabase 환경변수가 비어 있습니다: ${missingDbEnv.join(", ")}. ` +
      "Vercel > Settings > Environment Variables 에서 값을 넣고, " +
      "각 변수의 Production 스코프가 켜져 있는지 확인한다."
  );
}

// 읽기 전용. anon 키만 사용한다 — service_role 키는 절대 여기 넣지 않는다.
//
// 설정이 없을 때 createClient 는 "supabaseUrl is required" 만 던져서 어느 변수가
// 비었는지 알려주지 않는다. 그래서 직접 확인하고, 실제로 db 를 건드리는 순간에
// 변수 이름이 박힌 오류를 던진다. import 시점에 던지면 설정 안내 화면까지 같이
// 죽으므로 여기서는 던지지 않는다.
export const db = dbConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    })
  : (new Proxy(
      {},
      {
        get() {
          throw dbEnvError();
        },
      }
    ) as ReturnType<typeof createClient>);

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
  apply_start: string | null;
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
/** 공고에 실제로 붙어 있는 업종만. 없는 값을 늘어놓으면 빈 결과만 나온다. */
export const INDUSTRY = [
  "제조업", "음식점업", "정보통신업", "농림어업", "도소매업",
  "개인서비스업", "건설업", "운수·물류업", "숙박업",
  "전문·과학·기술서비스업", "교육서비스업", "예술·스포츠·여가업", "금융·보험업",
];

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
  industry?: string[];
};

export async function matchBusiness(q: BusinessQuery, limit = 60) {
  const { data, error } = await db.rpc("match_business", {
    p_sido: q.sido || null,
    p_biz_target: q.bizTarget || null,
    p_biz_field: q.bizField?.length ? q.bizField : null,
    p_biz_years: q.bizYears ?? null,
    p_industry: q.industry?.length ? q.industry : null,
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

// ── 홈 피드 / 통계 / 로깅 ────────────────────────────────

export type Bundle = {
  coverage: { welfare: number; business: number };
  settings: { closingDays: number; newDays: number; notice: string };
  areas: Area[];
  stats: { age: Stat[]; employment: Stat[]; household: Stat[] };
  regions: { sido: string; sigungu: { name: string; n: number }[] }[];
  sggIndex: Record<string, { sido: string; full: string }>;
  closingCount: number;
  closing: Program[];
  fresh: Program[];
};

/**
 * 홈에 필요한 자료를 한 번에 받아온다.
 *
 * 나눠서 부르면 조회 9번이고, Vercel 함수와 DB 가 멀면 왕복만 1.5초가 넘는다.
 * 서버에서 한 번에 묶어 오면 130ms 안에 끝난다.
 */
export async function getHomeBundle(): Promise<Bundle> {
  const { data } = await db.rpc("home_bundle");
  const b = (data ?? {}) as Record<string, any>;

  const regionRows = (b.regions ?? []) as
    { sido: string | null; sigungu: string | null; n: number }[];

  const map = new Map<string, { name: string; n: number }[]>();
  const idx: Record<string, { sido: string; full: string }> = {};
  for (const r of regionRows) {
    if (!r.sido) continue;
    const list = map.get(r.sido) ?? [];
    if (r.sigungu) {
      list.push({ name: r.sigungu, n: r.n });
      idx[r.sigungu] = { sido: r.sido, full: r.sigungu };
      const short = r.sigungu.replace(/(특별자치)?[시군구]$/, "");
      if (short.length >= 2 && !idx[short]) idx[short] = { sido: r.sido, full: r.sigungu };
    }
    map.set(r.sido, list);
  }

  const num = (v: unknown, d: number) => {
    const n = Number(String(v ?? "").replace(/"/g, ""));
    return Number.isFinite(n) ? n : d;
  };
  const st = (b.settings ?? {}) as Record<string, unknown>;

  return {
    coverage: {
      welfare: b.coverage?.welfare ?? 0,
      business: b.coverage?.business ?? 0,
    },
    settings: {
      closingDays: num(st.closing_days, 14),
      newDays: num(st.new_days, 7),
      notice: String(st.notice ?? "").replace(/^"|"$/g, ""),
    },
    areas: (b.areas ?? []) as Area[],
    stats: {
      age: (b.stat_age ?? []) as Stat[],
      employment: (b.stat_employment ?? []) as Stat[],
      household: (b.stat_household ?? []) as Stat[],
    },
    regions: Array.from(map.entries())
      .map(([sido, list]) => ({
        sido,
        sigungu: list.sort((a, b2) => a.name.localeCompare(b2.name, "ko")),
      }))
      .sort((a, b2) => a.sido.localeCompare(b2.sido, "ko")),
    sggIndex: idx,
    closingCount: Number(b.closing_count ?? 0),
    closing: (b.closing ?? []) as Program[],
    fresh: (b.fresh ?? []) as Program[],
  };
}


export async function feedClosing(kind: string | null = null, limit = 8) {
  const { data } = await db.rpc("feed_closing", { p_kind: kind, p_limit: limit });
  return (data ?? []) as Program[];
}

export async function feedNew(kind: string | null = null, limit = 8) {
  const { data } = await db.rpc("feed_new", { p_kind: kind, p_limit: limit });
  return (data ?? []) as Program[];
}

export type Stat = { label: string; n: number };

export async function getStats() {
  const [age, emp, hh] = await Promise.all([
    db.from("stat_age").select("label,n"),
    db.from("stat_employment").select("label,n"),
    db.from("stat_household").select("label,n"),
  ]);
  return {
    age: (age.data ?? []) as Stat[],
    employment: (emp.data ?? []) as Stat[],
    household: (hh.data ?? []) as Stat[],
  };
}

/** 시군구 이름 → 시도. 자유 입력 파서가 쓴다. */
export async function getSigunguIndex() {
  const { data } = await db.from("regions_available").select("sido,sigungu");
  const idx = new Map<string, { sido: string; full: string }>();
  for (const r of data ?? []) {
    if (!r.sigungu || !r.sido) continue;
    idx.set(r.sigungu, { sido: r.sido, full: r.sigungu });
    // "안산시" -> "안산" 으로도 찾을 수 있게
    const short = String(r.sigungu).replace(/(특별자치)?[시군구]$/, "");
    if (short.length >= 2 && !idx.has(short))
      idx.set(short, { sido: r.sido, full: r.sigungu });
  }
  return idx;
}

/**
 * 검색 조건을 기록한다. 개인 식별 정보는 담지 않는다.
 * IP·User-Agent·자유입력 원문·세션ID 없음. 나이는 10년 단위로 뭉갠다.
 */
export function logSearch(a: {
  kind: string;
  sido?: string;
  sigungu?: string;
  age?: number;
  employment?: string;
  household?: string[];
  bizTarget?: string;
  bizField?: string[];
  n: number;
  entry: string;
}) {
  // 응답을 기다리지 않는다. 통계 기록이 화면을 늦추면 안 된다.
  void db
    .rpc("log_search", {
      p_kind: a.kind,
      p_sido: a.sido ?? null,
      p_sigungu: a.sigungu ?? null,
      p_age: a.age ?? null,
      p_employment: a.employment ?? null,
      p_household: a.household?.length ? a.household : null,
      p_biz_target: a.bizTarget ?? null,
      p_biz_field: a.bizField?.length ? a.bizField : null,
      p_n: a.n,
      p_entry: a.entry,
    })
    .then(
      () => {},
      () => {}
    );
}

export async function getSettings() {
  const { data } = await db.from("settings_public").select("key,value");
  const m = new Map((data ?? []).map((d) => [d.key as string, d.value]));
  return {
    closingDays: Number(m.get("closing_days") ?? 14),
    newDays: Number(m.get("new_days") ?? 7),
    notice: String(m.get("notice") ?? "").replace(/^"|"$/g, ""),
  };
}

export type ApplyStatus = "closed" | "upcoming" | "ongoing" | "always";

export const STATUS_LABEL: Record<ApplyStatus, string> = {
  closed: "마감",
  upcoming: "예정",
  ongoing: "진행 중",
  always: "상시",
};

/** 서버가 어느 시간대에 있든 한국 날짜로 판단한다. "YYYY-MM-DD". */
function todayKST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date()
  );
}

/**
 * 접수 상태. apply_start / apply_end 는 date 라 문자열 비교로 충분하다.
 * 날짜가 아예 없는 공고는 "진행 중"으로 본다 — 원문에서 기간을 못 뽑은
 * 경우가 많아 마감으로 단정하면 멀쩡한 공고가 죽어 보인다.
 */
export function applyStatus(
  p: Pick<Program, "apply_start" | "apply_end" | "is_always_on">
): ApplyStatus {
  if (p.is_always_on) return "always";
  const today = todayKST();
  if (p.apply_end && p.apply_end < today) return "closed";
  if (p.apply_start && p.apply_start > today) return "upcoming";
  return "ongoing";
}

export function daysLeft(p: Pick<Program, "apply_end" | "is_always_on">) {
  if (p.is_always_on || !p.apply_end) return null;
  const end = new Date(p.apply_end + "T23:59:59+09:00").getTime();
  return Math.ceil((end - Date.now()) / 86_400_000);
}
