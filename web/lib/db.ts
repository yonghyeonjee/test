import { unstable_cache } from "next/cache";
import { expandQuery } from "./keywords";
import { createClient } from "@supabase/supabase-js";
import { svcConfigured, svcDb } from "./svcDb";
import { buildWithoutDb, emptyDbFetch } from "./buildNoDb";

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
      ...(buildWithoutDb ? { global: { fetch: emptyDbFetch } } : {}),
    })
  : (new Proxy(
      {},
      {
        get() {
          throw dbEnvError();
        },
      }
    ) as ReturnType<typeof createClient>);

/**
 * 캐시에 남기지 않는 같은 클라이언트. 사람마다 다른 조회(조건 검색·검색어)와 쓰기(검색 기록)에 쓴다.
 *
 * Next 14 는 fetch 결과를 기본으로 데이터 캐시에 저장한다. 검색 조건 조합마다 저장이 하나씩 쌓여
 * Vercel 의 ISR Writes 를 무료 한도(월 20만)의 다섯 배 넘게 썼다. 다시 쓰일 일이 거의 없는 결과라
 * 저장하지 않는다. 쪽 단위 캐시(revalidate)가 있는 화면에서는 쓰지 않는다 — no-store 가 그 쪽을
 * 요청마다 그리는 동적 화면으로 바꾼다.
 */
export const dbLive = dbConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
      global: { fetch: buildWithoutDb ? emptyDbFetch : (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }) },
    })
  : db;

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

// 화면(클라이언트)이 쓰는 상수와 순수 함수는 lib/consts.ts 에 있다. 여기서 다시
// 내보내 서버 쪽 호출은 그대로 두되, 클라이언트 컴포넌트는 consts 를 직접 가져온다
// — 이 모듈을 가져오면 supabase-js(300KB)가 브라우저 번들에 딸려 온다.
export {
  EMPLOYMENT, HOUSEHOLD, BIZ_TARGET, INDUSTRY, BIZ_FIELD,
  STATUS_LABEL, applyStatus, daysLeft, ageLabel, type ApplyStatus,
} from "./consts";
import { applyStatus } from "./consts";

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
  /** 본문에서 찾을 말. "신혼 전세" */
  q?: string;
};

export async function matchWelfare(q: WelfareQuery, limit = 60, live = false) {
  const { data, error } = await (live ? dbLive : db).rpc("match_welfare", {
    p_sido: q.sido || null,
    p_sigungu: q.sigungu || null,
    p_age: q.age ?? null,
    p_employment: q.employment || null,
    p_household: q.household?.length ? q.household : null,
    p_limit: limit,
    p_q: expandQuery(q.q),
  });
  if (error) throw error;
  return (data ?? []) as Program[];
}

/** 조건에 걸리는 복지 사업의 전체 건수. 목록은 60건까지만 받으므로 따로 센다. */
export async function countWelfare(q: WelfareQuery, live = false): Promise<number> {
  const { data, error } = await (live ? dbLive : db).rpc("count_welfare", {
    p_sido: q.sido || null,
    p_sigungu: q.sigungu || null,
    p_age: q.age ?? null,
    p_employment: q.employment || null,
    p_household: q.household?.length ? q.household : null,
    p_q: expandQuery(q.q),
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/** 마감까지 남은 일수. 상시는 null */
export type BusinessQuery = {
  sido?: string;
  bizTarget?: string;
  bizField?: string[];
  bizYears?: number;
  industry?: string[];
  q?: string;
};

export async function matchBusiness(q: BusinessQuery, limit = 60, live = false) {
  const { data, error } = await (live ? dbLive : db).rpc("match_business", {
    p_sido: q.sido || null,
    p_biz_target: q.bizTarget || null,
    p_biz_field: q.bizField?.length ? q.bizField : null,
    p_biz_years: q.bizYears ?? null,
    p_industry: q.industry?.length ? q.industry : null,
    p_limit: limit,
    p_q: expandQuery(q.q),
  });
  if (error) throw error;
  return (data ?? []) as Program[];
}

export async function countBusiness(q: BusinessQuery, live = false): Promise<number> {
  const { data, error } = await (live ? dbLive : db).rpc("count_business", {
    p_sido: q.sido || null,
    p_biz_target: q.bizTarget || null,
    p_biz_field: q.bizField?.length ? q.bizField : null,
    p_biz_years: q.bizYears ?? null,
    p_industry: q.industry?.length ? q.industry : null,
    p_q: expandQuery(q.q),
  });
  if (error) throw error;
  return Number(data ?? 0);
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

/** 공고에 딸린 서식·공고문(file)과 접수·안내 누리집(site). pipeline/sources.py 가 채운다. */
export type Attach = { name: string; url: string; kind: "file" | "site"; ext?: string };

export type Detail = Program & {
  attach: Attach[] | null;
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
    .select("source_id,updated_at")
    .order("norm_confidence", { ascending: false })
    .limit(limit);
  // 사이트맵이 <lastmod> 를 적으려면 언제 바뀌었는지가 있어야 한다.
  return (data ?? []).map((d) => ({
    id: d.source_id as string,
    updated: (d.updated_at as string | null) ?? null,
  }));
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
  const { data, error } = await db
    .from("programs_public")
    .select("*")
    .eq("kind", "welfare")
    .eq("sido", sido)
    .order("first_seen_at", { ascending: false })
    .order("norm_confidence", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`지역 목록: ${error.message}`);
  return (data ?? []) as Program[];
}

/** 분야(topics) 하나로 전국 목록. 확신도 순. */
export async function listByTopic(topic: string, limit = 60) {
  const { data, error } = await db
    .from("programs_public")
    .select("*")
    .eq("kind", "welfare")
    .contains("topics", [topic])
    .order("first_seen_at", { ascending: false })
    .order("norm_confidence", { ascending: false })
    .limit(limit);
  // 오류를 삼키면 "건수는 74건인데 목록은 0건" 같은 모양이 조용히 생긴다.
  // 실제로 뷰에 없는 칸(first_seen_at)으로 정렬하다 그렇게 됐다.
  if (error) throw new Error(`분야 목록: ${error.message}`);
  return (data ?? []) as Program[];
}

/** 분야별 건수. 홈 격자에 쓴다. 분야 수만큼 HEAD 요청을 보낸다. */
async function loadTopicCounts(): Promise<Record<string, number>> {
  const { TOPICS } = await import("./topics");
  const rows = await Promise.all(
    TOPICS.map(async (t) => {
      const { count, error } = await db
        .from("programs_public")
        .select("id", { count: "exact", head: true })
        .eq("kind", "welfare")
        .contains("topics", [t.key]);
      // 실패를 0으로 바꾸면 그 0이 캐시에 남는다. 던져서 캐시에 안 남긴다.
      if (error) throw new Error(`분야 건수: ${error.message}`);
      return [t.key, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(rows);
}

/**
 * 홈이 열릴 때마다 분야 15개에 HEAD 요청을 하나씩 보내고 있었다 — 하루
 * 1,700번, DB 호출 수 1위. 자료는 모두에게 같으니 15분에 한 번이면 된다.
 */
export const countByTopic = unstable_cache(loadTopicCounts, ["topic-counts"], {
  revalidate: 900,
});


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
  /** closing 이 기준일(closingDays) 안에 걸린 게 아니라 마감일 가까운 순일 때 참. */
  closingFallback: boolean;
  fresh: Program[];
};

/**
 * 홈에 필요한 자료를 한 번에 받아온다.
 *
 * 나눠서 부르면 조회 9번이고, Vercel 함수와 DB 가 멀면 왕복만 1.5초가 넘는다.
 * 서버에서 한 번에 묶어 오면 130ms 안에 끝난다.
 */
async function loadHomeBundle(): Promise<Bundle> {
  const { data, error } = await db.rpc("home_bundle");
  // 실패를 조용히 빈 자료로 바꾸면 그 빈 자료가 15분 동안 캐시에 남는다 —
  // "개인 복지 0건" 첫 화면이 그렇게 나왔다. 여기서는 던지고, 밖에서 받는다.
  if (error || !data) throw new Error(`home_bundle: ${error?.message ?? "빈 응답"}`);
  const b = data as Record<string, any>;

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
    closingFallback: Boolean(b.closing_fallback),
    fresh: (b.fresh ?? []) as Program[],
  };
}

/**
 * 첫 화면은 검색어(searchParams)를 읽어서 요청마다 새로 그린다. 그래서
 * 캐시를 걸지 않으면 누가 들어올 때마다 DB 를 한 번씩 다녀온다 — 서울에서
 * 휴대폰으로 열면 이 왕복만으로 눈에 띄게 느리다.
 *
 * 자료 자체는 모두에게 같으니 15분에 한 번만 다녀오면 된다. 화면 그리는
 * 일은 그대로 두고, 자료 가져오는 일만 캐시한다.
 */
const cachedHomeBundle = unstable_cache(loadHomeBundle, ["home-bundle"], {
  revalidate: 900,
});

const emptyBundle = (): Bundle => ({
  coverage: { welfare: 0, business: 0 },
  settings: { closingDays: 14, newDays: 7, notice: "" },
  areas: [],
  stats: { age: [], employment: [], household: [] },
  regions: [],
  sggIndex: {},
  closingCount: 0,
  closing: [],
  closingFallback: false,
  fresh: [],
});

/**
 * DB 를 못 읽은 요청만 빈 화면을 받고, 캐시에는 남지 않는다. 다음 요청이
 * 다시 다녀온다.
 */
export async function getHomeBundle(): Promise<Bundle> {
  try {
    return await cachedHomeBundle();
  } catch (e) {
    console.warn("[home] 자료를 읽지 못했다:", e instanceof Error ? e.message : e);
    return emptyBundle();
  }
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
  // 응답을 기다리지 않는다. 통계 기록이 화면을 늦추면 안 된다. 쓰기라 캐시에 남기지 않는다.
  // anon 키의 실행 권한은 거뒀으니 서버 키로 부른다.
  if (!svcConfigured()) return;
  void svcDb()
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

