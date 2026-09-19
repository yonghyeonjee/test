import { createClient } from "@supabase/supabase-js";
import { COLLECT_KEYS, type CollectKey, type CollectResult } from "./collectorMeta";
import { callAlio, toBusiness, toEvent, toFacility, type AlioItem } from "./alioplus";
import { ingestArchive, writeRun, type LastRun } from "./jobsIngest";
import { ingestSite, type SiteMode } from "./gojobsSite";
import { getLicenses } from "./qnet";
import { EXAM_GRADES, fetchGrade, toRow as toExamRow } from "./qnetExam";
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

// ── 국가기술자격 시험 일정 ──────────────────────────────────
/**
 * 등급 넷을 나란히 받는다. 하나가 실패해도 나머지는 저장한다 —
 * 넷 다 실패했을 때만 실패로 본다.
 */
async function collectExam(): Promise<{ saved: number }> {
  const got = await Promise.all(EXAM_GRADES.map((g) => fetchGrade(g)));
  const rounds = got.flatMap((r) => (r.ok ? r.rounds : []));
  if (!rounds.length) {
    const why = got.find((r) => !r.ok);
    throw new Error(why && !why.ok ? why.reason : "회차를 받지 못했다");
  }
  const byId = new Map(rounds.map((r) => [r.id, toExamRow(r)]));
  await upsert("exam_rounds", [...byId.values()], "id");
  return { saved: byId.size };
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

/**
 * 사이트 걷기를 실행 기록과 함께 돌린다.
 *
 * 예전에는 사이트 걷기가 기록을 안 남겼다. 그래서 관리자 화면의 나라일터
 * 줄에는 몇 달 전 API 로 돌린 기록이 그대로 걸려 있었고, 그 기록이 하필
 * 시간 초과로 "도는 중"인 채 끊긴 것이라 나흘 내내 빨간 띠가 떠 있었다.
 * 실제로는 매일 잘 돌고 있었는데도.
 *
 * 최신과 과거는 서로 다른 줄에 적는다. 한 줄을 같이 쓰면 나중에 돈 쪽이
 * 앞의 기록을 지운다.
 */
async function siteRun(
  key: "gojobs" | "gojobs_archive",
  opts: { mode: SiteMode; budgetMs: number },
) {
  const db = svc();
  const startedAt = new Date().toISOString();
  await writeRun(db, { source: key, state: "running", startedAt, by: "admin" });
  try {
    const r = await ingestSite(opts);
    await writeRun(db, {
      source: key, state: r.ok ? "done" : "failed", startedAt,
      finishedAt: new Date().toISOString(), by: "admin",
      report: {
        source: "gojobs", ok: r.ok, saved: r.saved, reason: r.reason,
        lastPage: r.to, timeUp: r.more, elapsedMs: r.elapsedMs,
        pages: r.pages.map((pg) => ({
          page: pg.page, saved: pg.saved, oldest: pg.oldest ?? null, newest: null, err: pg.reason,
        })),
      },
    });
    return r;
  } catch (e) {
    await writeRun(db, {
      source: key, state: "failed", startedAt, finishedAt: new Date().toISOString(), by: "admin",
      report: { source: "gojobs", ok: false, saved: 0, pages: [],
                reason: e instanceof Error ? e.message : String(e) },
    });
    throw e;
  }
}

/** 하나를 돌린다. 예외는 결과로 바꿔 돌려준다 — 하나가 죽어도 나머지는 돈다. */
export async function collectOne(
  key: CollectKey, opts: { pages?: number; budgetMs?: number } = {},
): Promise<CollectResult> {
  const t0 = Date.now();
  try {
    // 나라일터 최신: 사이트 1~10쪽(100건). API 는 오래된 것부터 주고 최신이
    // 2,901쪽 뒤인데 그 깊이가 응답하지 않는다 — 재 봤고, 안 된다.
    if (key === "gojobs") {
      // 1쪽부터 250건쯤. 한 쪽에 몇 건이 오는지는 ingestSite 가 재 두었다 —
      // 100건씩 오면 세 쪽, 열 건씩 오면 스물다섯 쪽을 돈다.
      const r = await siteRun("gojobs", { mode: "recent", budgetMs: opts.budgetMs ?? 40_000 });
      if (!r.ok) throw new Error(r.reason ?? "받아온 것이 없습니다");
      return { key, ok: true, saved: r.saved, elapsedMs: Date.now() - t0, more: false,
               reason: [`${r.from}~${r.to}쪽(쪽당 ${r.per ?? 10}건)`, r.unitNote].filter(Boolean).join(" · ") };
    }
    // 나라일터 과거: 오늘에서 과거 쪽으로 한 걸음씩 판다.
    //
    // 처음에는 API 를 1쪽부터 걸었다. API 는 오래된 것부터 주니 그건
    // 2008년부터 앞으로 걷는 것이었고, 실제로 2008~2013년만 23,000건이
    // 쌓였다. 정작 사람이 볼 만한 2014~2025년은 그 뒤라 언제 닿을지
    // 모른다. 순서가 거꾸로였다.
    //
    // 사이트 목록은 최신이 1쪽이다. 쪽을 넘길수록 과거로 간다. 그래서
    // 이쪽을 본줄기로 삼는다 — 가까운 날짜부터 채우고 과거로 내려간다.
    // API 걷기는 사이트가 막혔을 때만 쓴다.
    if (key === "gojobs_archive") {
      const budget = opts.budgetMs ?? 40_000;
      const r = await siteRun("gojobs_archive", { mode: "past", budgetMs: budget });
      if (r.ok) {
        const per = r.per ?? 10;
        return { key, ok: true, saved: r.saved, elapsedMs: Date.now() - t0, more: r.more ?? false,
                 reason: [`${r.from}~${r.to}쪽(쪽당 ${per}건)`,
                          r.oldest && `${r.oldest}까지`,
                          r.unitNote].filter(Boolean).join(" · ") };
      }
      // 사이트가 안 되면 API 로라도 과거를 모은다. 순서는 나쁘지만
      // 아무것도 안 모으는 것보다 낫다.
      const a = await ingestArchive("gojobs", { budgetMs: budget });
      if (a.saved > 0) {
        const first = a.pages[0], last = a.pages[a.pages.length - 1];
        return { key, ok: true, saved: a.saved, elapsedMs: Date.now() - t0,
                 more: Boolean(a.timeUp) || Boolean(a.stalled),
                 reason: `사이트 실패(${r.reason}) → API ${first.page}~${last.page}쪽` +
                         (first.oldest ? ` · ${first.oldest}부터` : "") };
      }
      throw new Error(r.reason ?? a.reason ?? "받아온 것이 없습니다");
    }
    // 월드잡은 최신순으로 준다(1쪽 표본이 2026-07, 마지막 쪽이 2015).
    // 1쪽을 늘 먼저 읽어 오늘 기준 최신 100건을 챙기고, 커서부터 이어 걷는다.
    // 43쪽뿐이라 며칠이면 전부 모이고, 그 뒤로는 한 바퀴씩 다시 돈다.
    if (key === "worldjob") {
      const r = await ingestArchive("worldjob", { alwaysFirst: true, budgetMs: opts.budgetMs });
      if (!r.ok) throw new Error(r.reason ?? "실패");
      const first = r.pages[0], last = r.pages[r.pages.length - 1];
      return { key, ok: true, saved: r.saved, elapsedMs: Date.now() - t0, more: Boolean(r.timeUp),
               reason: first && last ? `${first.page}~${last.page}쪽` : undefined };
    }
    const run =
      key === "license" ? collectLicense
      : key === "exam" ? collectExam
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
