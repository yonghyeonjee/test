import { createClient } from "@supabase/supabase-js";
import { callAlio, toBusiness, toEvent, toFacility, type AlioItem } from "./alioplus";
import { ingest, type LastRun } from "./jobsIngest";
import { getLicenses } from "./qnet";
import { getRentRates } from "./rentRate";

/**
 * 매일 도는 수집기들을 한자리에 모은다.
 *
 * 화면이 요청할 때마다 공공 API 를 부르면 그쪽이 느리거나 죽었을 때 우리
 * 화면도 같이 느려지고 비어 보인다. 매일 한 번 받아 DB 에 넣고, 화면은
 * DB 만 본다. API 가 죽어도 어제 자료가 보인다.
 *
 * 채용(나라일터·월드잡)은 쪽수가 많아 이어 읽어야 하므로 jobsIngest 가 맡고,
 * 여기서는 한 번에 다 받아 오는 것들을 맡는다.
 */

export type CollectKey =
  | "gojobs" | "worldjob"
  | "license" | "agency_business" | "agency_event" | "agency_facility" | "jeonse";

export type CollectResult = {
  key: CollectKey; ok: boolean; saved: number; reason?: string; elapsedMs: number;
  /** 이어 읽을 것이 남았나 (채용만) */
  more?: boolean;
};

export const COLLECT_LABEL: Record<CollectKey, string> = {
  gojobs: "나라일터 채용",
  worldjob: "해외취업",
  license: "국가자격 종목",
  agency_business: "공공기관 사업",
  agency_event: "공공기관 행사",
  agency_facility: "공공기관 시설",
  jeonse: "전세대출 금리",
};

export const COLLECT_KEYS = Object.keys(COLLECT_LABEL) as CollectKey[];

function svc() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) throw new Error("SUPABASE_SERVICE_KEY / NEXT_PUBLIC_SUPABASE_URL 미설정");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function upsert(table: string, rows: Record<string, unknown>[], conflict: string) {
  const db = svc();
  for (let i = 0; i < rows.length; i += 300) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 300) as never[], { onConflict: conflict });
    if (error) throw new Error(`${table} 저장 실패: ${error.message}`);
  }
}

// ── 국가자격 종목 ──────────────────────────────────────────
async function collectLicense(): Promise<{ saved: number }> {
  const b = await getLicenses();
  if (!b.ok) throw new Error(b.reason ?? "종목을 받지 못했다");
  const rows = b.all.filter((l) => l.code).map((l) => ({
    code: l.code, name: l.name, kind: l.kind, kind_name: l.kindName,
    series: l.series, field: l.field, sub_field: l.subField,
    fetched_at: new Date().toISOString(),
  }));
  await upsert("license_items", rows, "code");
  return { saved: rows.length };
}

// ── 공공기관 사업·행사·시설 ─────────────────────────────────
/** 주소에서 시·도를 읽어 낸다. 화면의 지역 거르기가 이 값을 쓴다. */
const SIDO_SHORT = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원",
  "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
const sidoOf = (addr: string | null) =>
  SIDO_SHORT.find((s) => (addr ?? "").includes(s)) ?? null;

const alioRow = (kind: string, it: AlioItem) => ({
  id: `${kind}:${it.id}`.slice(0, 500),
  kind, title: it.title, org: it.org, cate: it.cate, target: it.target,
  descr: it.desc, address: it.address, start_date: it.start, end_date: it.end,
  url: it.url, tags: it.tags, sido: sidoOf(it.address),
  fetched_at: new Date().toISOString(),
});

async function collectAgency(kind: "business" | "event" | "facility"): Promise<{ saved: number }> {
  const res = await callAlio(kind, {}, 1000, 0);
  if (!res.ok) throw new Error(res.reason);
  const to = kind === "business" ? toBusiness : kind === "event" ? toEvent : toFacility;
  const seen = new Set<string>();
  const rows = res.rows
    .map(to)
    .filter((x): x is AlioItem => !!x)
    .map((it) => alioRow(kind, it))
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  await upsert("agency_items", rows, "id");
  return { saved: rows.length };
}

// ── 전세자금대출 금리 ──────────────────────────────────────
async function collectJeonse(): Promise<{ saved: number }> {
  const board = await getRentRates();
  if (!board.ok) throw new Error(board.reason ?? "금리를 받지 못했다");
  const now = new Date().toISOString();
  const rows = board.banks.flatMap((b) =>
    (b.tiers.length ? b.tiers : [{ ratio: null, base: null, extra: null, rate: null }]).map((t, i) => ({
      id: `${b.bank}|${i}`,
      bank: b.bank, ratio: t.ratio, base: t.base, extra: t.extra, rate: t.rate,
      call_center: b.callCenter, ymd_from: board.from, ymd_to: board.to, fetched_at: now,
    })),
  );
  await upsert("rate_rows", rows, "id");
  // 은행이 빠지면 옛 줄이 남는다. 이번에 안 온 것은 지운다.
  await svc().from("rate_rows").delete().lt("fetched_at", now);
  return { saved: rows.length };
}

/** 중지 단추가 눌렸나. 도는 항목을 죽이지는 못하고, 다음 항목으로 안 넘어간다. */
async function stopRequested() {
  try {
    const { data } = await svc().from("site_settings").select("value").eq("key", "collect_stop").maybeSingle();
    return Boolean((data?.value as { on?: boolean } | null)?.on);
  } catch {
    return false;
  }
}

/** 하나를 돌린다. 예외는 결과로 바꿔 돌려준다 — 하나가 죽어도 나머지는 돈다. */
export async function collectOne(key: CollectKey, opts: { pages?: number } = {}): Promise<CollectResult> {
  const t0 = Date.now();
  try {
    if (key === "gojobs" || key === "worldjob") {
      const r = await ingest(key, { pages: opts.pages ?? 4, by: "admin" });
      if (!r.ok) throw new Error(r.reason ?? "실패");
      return { key, ok: true, saved: r.saved, elapsedMs: Date.now() - t0, more: !r.cursor?.done };
    }
    const run =
      key === "license" ? collectLicense
      : key === "jeonse" ? collectJeonse
      : () => collectAgency(key.replace("agency_", "") as "business" | "event" | "facility");
    const { saved } = await run();
    return { key, ok: true, saved, elapsedMs: Date.now() - t0 };
  } catch (e) {
    return { key, ok: false, saved: 0, reason: e instanceof Error ? e.message : String(e), elapsedMs: Date.now() - t0 };
  }
}

/**
 * 전부 돌린다. 시간 예산을 넘기면 남은 것은 건너뛰고 그렇게 보고한다.
 * 한 번에 다 못 해도 다음 호출이 이어받으므로 화면이 멈추는 것보다 낫다.
 */
export async function collectAll(budgetMs = 45_000, keys: CollectKey[] = COLLECT_KEYS): Promise<CollectResult[]> {
  const t0 = Date.now();
  const out: CollectResult[] = [];
  for (const key of keys) {
    if (await stopRequested()) {
      out.push({ key, ok: false, saved: 0, reason: "중지 눌림 — 건너뜀", elapsedMs: 0 });
      continue;
    }
    if (Date.now() - t0 > budgetMs) {
      out.push({ key, ok: false, saved: 0, reason: "시간이 모자라 건너뜀 — 다시 누르면 이어집니다", elapsedMs: 0 });
      continue;
    }
    out.push(await collectOne(key, { pages: 3 }));
  }
  return out;
}

export type { LastRun };
