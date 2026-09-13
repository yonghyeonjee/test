import { createClient } from "@supabase/supabase-js";
import { COLLECT_KEYS, type CollectKey, type CollectResult } from "./collectorMeta";
import { callAlio, toBusiness, toEvent, toFacility, type AlioItem } from "./alioplus";
import { ingest, type LastRun } from "./jobsIngest";
import { ingestSite } from "./gojobsSite";
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

export { COLLECT_KEYS, COLLECT_LABEL } from "./collectorMeta";
export type { CollectKey, CollectResult } from "./collectorMeta";

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
export async function collectOne(
  key: CollectKey, opts: { pages?: number; budgetMs?: number } = {},
): Promise<CollectResult> {
  const t0 = Date.now();
  try {
    // 나라일터는 사이트에서 받는다. API 는 오래된 것부터 주고 최신이
    // 2,901쪽 뒤인데 그 깊이가 응답하지 않는다(offset 에 비례해 느려져
    // 마지막 쪽은 60초를 넘긴다 — 함수 상한이 60초다). 재 봤고, 안 된다.
    if (key === "gojobs") {
      const r = await ingestSite(5, opts.budgetMs ?? 40_000);
      if (!r.ok) throw new Error(r.reason ?? "받아온 것이 없습니다");
      // 쪽 넘김이 안 되면 1쪽(최신 10건)만 매일 쌓인다. 그것도 쓸모는 있지만
      // 그렇다는 사실은 알려 준다.
      const note = r.paging === false ? " · 1쪽만 됩니다(쪽 넘김 불가)" : "";
      return { key, ok: true, saved: r.saved, elapsedMs: Date.now() - t0,
               more: r.paging !== false, reason: note || undefined };
    }
    if (key === "worldjob") {
      const r = await ingest(key, { pages: opts.pages ?? 4, by: "admin", budgetMs: opts.budgetMs });
      if (!r.ok) throw new Error(r.reason ?? "실패");
      // 한 쪽도 못 받았으면 "0건 저장"이 아니라 실패다. 이유를 그대로 올린다.
      const errs = r.pages.filter((pg) => pg.err);
      if (r.saved === 0 && errs.length)
        return { key, ok: false, saved: 0, elapsedMs: Date.now() - t0,
                 reason: `${errs.length}쪽을 못 받았습니다 — ${errs[0].err}` };
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

/** 정해진 시간을 넘기면 기다리지 않고 그렇게 보고한다. 남은 일은 다음 호출이 잇는다. */
function withDeadline(key: CollectKey, budgetMs: number, work: Promise<CollectResult>) {
  const t0 = Date.now();
  return Promise.race([
    work,
    new Promise<CollectResult>((resolve) =>
      setTimeout(() => resolve({
        key, ok: false, saved: 0, elapsedMs: Date.now() - t0,
        reason: "시간이 모자라 멈췄습니다 — 다시 누르면 이어집니다",
      }), budgetMs),
    ),
  ]);
}

/**
 * 전부 돌린다. **나란히** 돌린다.
 *
 * 차례로 돌렸더니 나라일터 하나가 예산 45초를 통째로 먹고, 나머지 여섯은
 * 손도 못 대고 "시간이 모자라 건너뜀"만 나왔다. 하는 일이 거의 다 남의 서버를
 * 기다리는 것(네트워크)이라 차례를 지킬 이유가 없다. 한꺼번에 띄우면 전체가
 * 가장 느린 하나만큼만 걸린다.
 *
 * 대신 하나가 늘어져 함수 상한(60초)을 넘기지 않게 각자에게 마감을 준다.
 */
export async function collectAll(budgetMs = 45_000, keys: CollectKey[] = COLLECT_KEYS): Promise<CollectResult[]> {
  if (await stopRequested())
    return keys.map((key) => ({ key, ok: false, saved: 0, reason: "중지 눌림 — 건너뜀", elapsedMs: 0 }));

  return Promise.all(
    keys.map((key) =>
      withDeadline(key, budgetMs, collectOne(key, { pages: 3, budgetMs: budgetMs - 3_000 }))
        .catch((e): CollectResult => ({
          key, ok: false, saved: 0, elapsedMs: 0,
          reason: e instanceof Error ? e.message : String(e),
        })),
    ),
  );
}

export type { LastRun };
