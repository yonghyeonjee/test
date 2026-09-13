import { createClient } from "@supabase/supabase-js";
import { parseItems } from "./openapi";

/**
 * 채용 공고 수집. Vercel Cron 이 매일 09:00 KST 에 서울에서 부른다.
 *
 * GitHub Actions 에서 돌리려 했더니 data.go.kr 이 해외 IP 를 막아 연결조차
 * 안 됐다. Vercel(icn1)에서는 된다. 그래서 수집기가 사이트 안에 산다.
 *
 * 두 API 는 오래된 것부터 준다. 마지막 쪽부터 거꾸로 읽어 기준일(SINCE)보다
 * 오래된 쪽이 나오면 멈춘다. 한 번에 다 못 읽어도 되도록 쪽 번호를
 * site_settings.jobs_cursor 에 적어 두고 다음 호출이 이어 읽는다.
 * 뒤로 다 읽고 나면(done) 그 뒤로는 마지막 두세 쪽만 다시 읽어 새 공고를 얹는다.
 */

const KEY = (process.env.DATA_GO_KR_KEY ?? "").trim();
/**
 * 한 쪽에 몇 건씩 받나. 나라일터는 29만 건짜리라 100씩이면 2,901쪽이고,
 * 최신은 맨 뒤에 있다. 그 깊이의 쪽은 응답이 14초 안에 안 온다.
 * 한 쪽을 크게 받아 쪽수를 열 배 줄인다 — 한 번 성공하면 1,000건이 들어온다.
 */
const ROWS_BY: Record<string, number> = { gojobs: 1000, worldjob: 100 };
const rowsOf = (name: string) => ROWS_BY[name] ?? 100;
/** 한 번 호출에서 쓸 수 있는 시간. Vercel 함수 상한(60초)보다 넉넉히 짧게. */
const BUDGET_MS = 40_000;
const FETCH_MS = 8_000;
export const SINCE_DEFAULT = "2026-08-01";

type Source = "gojobs" | "worldjob";
const SRC: Record<Source, { url: string; item: string; alias: Record<string, string[]>; orderKey: string }> = {
  gojobs: {
    url: "https://apis.data.go.kr/1760000/PblJobService/getList",
    item: "item",
    // 실제 응답 항목(2026-09 확인):
    // areacode enddate idx insttname moddate readnum regdate title type01 type02
    alias: {
      source_id: ["idx"],
      title: ["title"],
      org: ["insttname"],
      end_date: ["enddate"],
      reg_date: ["regdate"],
      area_code: ["areacode"],
      type01: ["type01"],
      type02: ["type02"],
    },
    orderKey: "reg_date",
  },
  worldjob: {
    url: "http://apis.data.go.kr/B490007/worldjob30/openApi30",
    item: "ITEM",
    alias: {
      source_id: ["rctntcSj"], title: ["rctntcSj"], org: ["entNm"], nation: ["rctntcNationNm"],
      sectors: ["rctntcKscoNm"], industry: ["lplcKscoNm"], career: ["careerStleNm"], lang: ["rctntcLang"],
      visa: ["rctntcVisaNm"], headcount: ["rctntcNmprCo"], start_date: ["rctntcBgnDe"], end_date: ["rctntcEndDe"],
      reg_date: ["rctntcBgnDe"],
    },
    orderKey: "start_date",
  },
};

function svc() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) throw new Error("SUPABASE_SERVICE_KEY / NEXT_PUBLIC_SUPABASE_URL 미설정");
  return createClient(url, key, { auth: { persistSession: false } });
}

const serviceKey = () => (/%[0-9A-Fa-f]{2}/.test(KEY) ? KEY : encodeURIComponent(KEY));

/**
 * 실패 이유를 삼키지 않는다. 화면에서 "왜 안 되는지"를 보여 줘야 한다.
 *
 * 뒤쪽 쪽번호는 앞쪽보다 눈에 띄게 느리다(2,900쪽짜리라 더 그렇다).
 * 8초로 끊고 두 번 재시도하면 한 쪽에 16초를 버리고도 아무것도 못 얻는다.
 * 그래서 시간은 넉넉히 주되 재시도는 한 번만 한다.
 */
async function fetchPage(
  url: string, page: number, rows: number, ms = FETCH_MS, tries = 2,
): Promise<{ xml: string } | { err: string }> {
  const full = `${url}?serviceKey=${serviceKey()}&numOfRows=${rows}&pageNo=${page}`;
  let last = "";
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(full, { cache: "no-store", signal: AbortSignal.timeout(ms) });
      const text = await res.text();
      if (res.ok && text.trim()) return { xml: text };
      last = `응답 ${res.status}${text.trim() ? "" : " (빈 본문)"}`;
    } catch (e) {
      last = e instanceof Error
        ? (e.name === "TimeoutError" ? `${Math.round(ms / 1000)}초 안에 응답 없음` : `${e.name}: ${e.message}`)
        : String(e);
    }
  }
  return { err: last || "알 수 없는 실패" };
}

function resultError(xml: string) {
  const code = xml.match(/<resultCode>\s*([^<]+?)\s*</)?.[1] ?? xml.match(/<ERR_CD>\s*([^<]+?)\s*</)?.[1];
  if (code && code !== "00" && code !== "0")
    return xml.match(/<resultMsg>([^<]+)</)?.[1] ?? xml.match(/<ERR_NM>([^<]+)</)?.[1] ?? xml.match(/<returnAuthMsg>([^<]+)</)?.[1] ?? `결과 코드 ${code}`;
  return null;
}

/** 기관명에서 시·도를 읽어 낸다. "경상북도 소방본부" → "경상북도" */
const SIDO = ["서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시",
  "울산광역시", "세종특별자치시", "경기도", "강원특별자치도", "강원도", "충청북도", "충청남도",
  "전북특별자치도", "전라북도", "전라남도", "경상북도", "경상남도", "제주특별자치도"];
const SHORT: Record<string, string> = { 서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시",
  인천: "인천광역시", 광주: "광주광역시", 대전: "대전광역시", 울산: "울산광역시", 세종: "세종특별자치시",
  경기: "경기도", 강원: "강원특별자치도", 충북: "충청북도", 충남: "충청남도", 전북: "전북특별자치도",
  전남: "전라남도", 경북: "경상북도", 경남: "경상남도", 제주: "제주특별자치도" };
function sidoOf(text: string): string | null {
  for (const s of SIDO) if (text.includes(s)) return s.replace("강원도", "강원특별자치도").replace("전라북도", "전북특별자치도");
  for (const [k, v] of Object.entries(SHORT)) if (text.startsWith(k)) return v;
  return null;
}

const iso = (v: string | null) => {
  const m = v?.match(/(\d{4})[.\-/]?(\d{2})[.\-/]?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};
const pick = (d: Record<string, string>, keys: string[]) => {
  for (const k of keys) if (d[k]?.trim()) return d[k].trim();
  return null;
};

type Row = Record<string, unknown>;

function toRow(name: Source, d: Record<string, string>): Row | null {
  const a = SRC[name].alias;
  const title = pick(d, a.title);
  if (!title) return null;
  const sid = pick(d, a.source_id) ?? title;
  const row: Row = { source: name, source_id: sid.slice(0, 400), title: title.slice(0, 500), raw: d, fetched_at: new Date().toISOString() };
  for (const col of ["org", "region", "hire", "recruit", "sectors", "headcount", "url",
                     "nation", "lang", "visa", "career", "industry", "area_code", "type01", "type02"])
    if (a[col]) row[col] = pick(d, a[col]);
  // 나라일터는 근무지를 코드(areacode)로만 준다. 기관명에 시·도가 적힌 경우가
  // 많아 거기서 읽어 낸다. 못 읽으면 비운다 — 코드를 지역인 척 보이지 않는다.
  if (name === "gojobs") row.region = sidoOf(String(row.org ?? ""));
  for (const col of ["start_date", "end_date", "reg_date"]) if (a[col]) row[col] = iso(pick(d, a[col]));
  row.id = name === "worldjob"
    ? `worldjob:${title}|${row.org ?? ""}|${row.start_date ?? ""}`.slice(0, 500)
    : `gojobs:${sid}`.slice(0, 500);
  if (name === "worldjob") row.source_id = String(row.id).slice(9, 409);
  return row;
}

export type Cursor = { nextPage: number; lastPage: number; total: number; done: boolean; updated: string };
export type RunReport = {
  source: Source; ok: boolean; reason?: string; total?: number; lastPage?: number;
  pages: { page: number; saved: number; oldest: string | null; newest: string | null;
           /** 그 쪽을 못 받았으면 이유. 저장 0건과 "못 받음"을 구분한다. */
           err?: string }[];
  keys?: string[]; sample?: Record<string, string>; saved: number; cursor?: Cursor;
  /** 시간이 모자라 중간에 멈췄나. true 면 한 번 더 누르면 이어 읽는다. */
  timeUp?: boolean;
  elapsedMs?: number;
};

/** 연결과 항목 이름만 빠르게 본다. 한 쪽만 읽으므로 몇 초면 끝난다. */
export async function probe(name: Source): Promise<RunReport> {
  const conf = SRC[name];
  const t0 = Date.now();
  const base: RunReport = { source: name, ok: false, pages: [], saved: 0 };
  if (!KEY) return { ...base, reason: "DATA_GO_KR_KEY 미설정" };
  const r = await fetchPage(conf.url, 1, rowsOf(name));
  if ("err" in r) return { ...base, reason: `연결 실패 — ${r.err}`, elapsedMs: Date.now() - t0 };
  const err = resultError(r.xml);
  if (err) return { ...base, reason: `API 오류 — ${err}`, elapsedMs: Date.now() - t0 };
  const items = parseItems(r.xml, conf.item);
  const total = Number(r.xml.match(/<totalCount>\s*(\d+)/)?.[1]) || items.length;
  return {
    ...base, ok: true, total, lastPage: Math.max(1, Math.ceil(total / rowsOf(name))),
    keys: items[0] ? Object.keys(items[0]) : [],
    sample: items[0],
    elapsedMs: Date.now() - t0,
  };
}

async function readCursor(db: ReturnType<typeof svc>): Promise<Record<string, Cursor>> {
  const { data } = await db.from("site_settings").select("value").eq("key", "jobs_cursor").maybeSingle();
  return ((data?.value as Record<string, Cursor>) ?? {});
}
async function writeCursor(db: ReturnType<typeof svc>, all: Record<string, Cursor>) {
  await db.from("site_settings").upsert({ key: "jobs_cursor", value: all as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

export type LastRun = {
  source: string;
  state: "running" | "done" | "failed";
  startedAt: string;
  finishedAt?: string;
  by: "cron" | "admin";
  report?: RunReport;
};

/**
 * 실행 기록을 DB 에 남긴다.
 *
 * 함수가 시간 초과로 죽으면 화면에는 아무것도 안 남는다. 시작할 때 한 번,
 * 끝날 때 한 번 적어 두면 새로고침만 해도 "돌다가 죽었는지, 실패했는지,
 * 끝났는지"를 알 수 있다.
 */
const RUN_KEY = (source: string) => `last_run_${source}`;

async function writeRun(db: ReturnType<typeof svc>, run: LastRun) {
  try {
    // 소스마다 다른 줄에 적는다. 한 줄에 몰아 넣으면 나란히 돌 때
    // 읽고-고쳐-쓰는 사이에 서로의 기록을 덮어쓴다.
    await db.from("site_settings").upsert(
      { key: RUN_KEY(run.source), value: run as never, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  } catch {
    /* 기록 실패로 수집을 막지 않는다 */
  }
}

/** 소스별 마지막 실행 기록. 최근에 시작한 것부터. */
export async function readLastRuns(): Promise<LastRun[]> {
  try {
    const { data } = await svc().from("site_settings").select("key,value").like("key", "last_run_%");
    const runs = (data ?? []).map((r) => r.value as LastRun).filter((r) => r?.source);
    return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  } catch {
    return [];
  }
}

/** 한 소스를 pagesPerRun 쪽까지 읽는다. */
export async function ingest(
  name: Source,
  opts: {
    pages?: number; since?: string; reset?: boolean; by?: "cron" | "admin";
    /** 이 호출에 쓸 수 있는 시간. 여럿을 나란히 돌릴 때 부르는 쪽이 정한다. */
    budgetMs?: number;
  } = {},
): Promise<RunReport> {
  const conf = SRC[name];
  const t0 = Date.now();
  const startedAt = new Date().toISOString();
  const by = opts.by ?? "admin";
  let db0: ReturnType<typeof svc> | null = null;
  try {
    db0 = svc();
    await writeRun(db0, { source: name, state: "running", startedAt, by });
  } catch {
    /* 아래에서 다시 잡는다 */
  }
  const fail = async (report: RunReport) => {
    if (db0) await writeRun(db0, { source: name, state: "failed", startedAt, finishedAt: new Date().toISOString(), by, report });
    return report;
  };
  const pagesPerRun = opts.pages ?? 6;
  const budgetMs = opts.budgetMs ?? BUDGET_MS;
  // 뒤쪽 쪽번호는 느리다. 첫 쪽은 짧게 끊어 빨리 실패를 알고, 뒤쪽은 기다려 준다.
  // 뒤쪽 쪽번호는 20초를 넘기기도 한다. 예산의 3/4까지 기다려 준다.
  const deepMs = Math.min(30_000, Math.max(FETCH_MS, Math.floor(budgetMs * 0.75)));
  let fails = 0;
  const since = opts.since ?? SINCE_DEFAULT;
  const report: RunReport = { source: name, ok: false, pages: [], saved: 0 };
  if (!KEY) return fail({ ...report, reason: "DATA_GO_KR_KEY 미설정", elapsedMs: 0 });
  const db = svc();

  const rows_ = rowsOf(name);
  const probed = await fetchPage(conf.url, 1, rows_);
  if ("err" in probed)
    return fail({ ...report, reason: `첫 쪽을 못 받았다 — ${probed.err}`, elapsedMs: Date.now() - t0 });
  const first = probed.xml;
  const err = resultError(first);
  if (err) return fail({ ...report, reason: `API 오류 — ${err}`, elapsedMs: Date.now() - t0 });
  const firstItems = parseItems(first, conf.item);
  const total = Number(first.match(/<totalCount>\s*(\d+)/)?.[1]) || firstItems.length;
  const lastPage = Math.max(1, Math.ceil(total / rows_));
  report.total = total; report.lastPage = lastPage;
  if (firstItems[0]) { report.keys = Object.keys(firstItems[0]); report.sample = firstItems[0]; }

  const cursors = await readCursor(db);
  let cur = cursors[name];
  // 처음이거나 다시 시작하거나, 이미 끝까지 읽었으면 최신 쪽부터 다시(새 공고를 얹는다)
  // cur.lastPage 가 다르면 쪽 크기나 전체 건수가 바뀐 것이다. 옛 쪽 번호는
  // 다른 자리를 가리키므로 버리고 맨 뒤(최신)부터 다시 잡는다.
  if (!cur || opts.reset || cur.done || cur.lastPage !== lastPage) {
    cur = { nextPage: lastPage, lastPage, total, done: cur?.done ?? false, updated: new Date().toISOString() };
    if (cur.done) cur.nextPage = lastPage; // 최신 두세 쪽만
  }
  const budget = cur.done ? Math.min(pagesPerRun, 3) : pagesPerRun;
  let page = Math.min(cur.nextPage, lastPage);
  let read = 0;
  let stop = false;
  while (page >= 1 && read < budget && !stop) {
    // 시간이 모자라면 여기까지 저장하고 쪽 번호를 남긴 채 돌아간다.
    if (Date.now() - t0 > budgetMs) { report.timeUp = true; break; }
    let xml: string;
    if (page === 1) xml = first;
    else {
      const got = await fetchPage(conf.url, page, rows_, deepMs, 1);
      if ("err" in got) {
        report.pages.push({ page, saved: 0, oldest: null, newest: null, err: got.err });
        fails++;
        page--; read++;
        // 뒤쪽이 연달아 막히면 남은 예산을 거기 다 버린다. 끊고 돌아간다.
        if (fails >= 2) { report.timeUp = true; break; }
        continue;
      }
      xml = got.xml;
    }
    const parsed = parseItems(xml, conf.item).map((d) => toRow(name, d)).filter((r): r is Row => !!r);
    // 한 upsert 안에 같은 id 가 두 번 들어가면 Postgres 가 통째로 거부한다
    // ("ON CONFLICT DO UPDATE command cannot affect row a second time").
    // 월드잡은 제목+기관+시작일로 id 를 만드는데 같은 공고가 겹쳐 온다.
    const byId = new Map<string, Row>();
    for (const r of parsed) byId.set(String(r.id), r);
    const rows = [...byId.values()];
    if (rows.length) {
      const { error } = await db.from("job_posts").upsert(rows as never[], { onConflict: "id" });
      if (error) return fail({ ...report, reason: `저장 실패: ${error.message}`, elapsedMs: Date.now() - t0 });
    }
    const dates = rows.map((r) => r[conf.orderKey] as string | null).filter((x): x is string => !!x).sort();
    const oldest = dates[0] ?? null, newest = dates[dates.length - 1] ?? null;
    report.pages.push({ page, saved: rows.length, oldest, newest });
    report.saved += rows.length;
    if (oldest && oldest < since) stop = true;
    page--; read++;
  }
  const done = report.timeUp ? cur.done : stop || page < 1 || cur.done;
  cursors[name] = { nextPage: done ? lastPage : page, lastPage, total, done, updated: new Date().toISOString() };
  await writeCursor(db, cursors);
  report.cursor = cursors[name];
  report.ok = true;
  report.elapsedMs = Date.now() - t0;
  await writeRun(db, { source: name, state: "done", startedAt, finishedAt: new Date().toISOString(), by, report });
  return report;
}
