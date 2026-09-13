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
const ROWS = 100;
export const SINCE_DEFAULT = "2026-08-01";

type Source = "gojobs" | "worldjob";
const SRC: Record<Source, { url: string; item: string; alias: Record<string, string[]>; orderKey: string }> = {
  gojobs: {
    url: "https://apis.data.go.kr/1760000/PblJobService/getList",
    item: "item",
    alias: {
      source_id: ["idx", "pbancNo", "id", "seq"],
      title: ["title", "pbancNm", "subject", "recrutPbancTtl"],
      org: ["orgName", "instNm", "ognNm", "orgNm", "instName"],
      region: ["workRegion", "workRegionNm", "region", "workRgnNm"],
      hire: ["hireType", "hireTypeNm", "emplymType", "hireTypeLst"],
      recruit: ["recruitType", "recruitTypeNm", "careerType", "recrutSe"],
      sectors: ["sectors", "ncsCdNmLst", "field", "sector"],
      headcount: ["recruitNum", "rcritNmpr", "recrutNope"],
      start_date: ["startDate", "pbancBgngDt", "receiptStart", "pbancBgngYmd"],
      end_date: ["endDate", "pbancEndDt", "receiptEnd", "pbancEndYmd"],
      reg_date: ["regDate", "regDt", "registDt", "regDttm"],
      url: ["srcUrl", "url", "detailUrl", "link", "homepage"],
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

async function fetchPage(url: string, page: number): Promise<string | null> {
  const full = `${url}?serviceKey=${serviceKey()}&numOfRows=${ROWS}&pageNo=${page}`;
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(full, { cache: "no-store", signal: AbortSignal.timeout(12000) });
      const text = await res.text();
      if (res.ok && text.trim()) return text;
    } catch {
      /* 다시 */
    }
  }
  return null;
}

function resultError(xml: string) {
  const code = xml.match(/<resultCode>\s*([^<]+?)\s*</)?.[1] ?? xml.match(/<ERR_CD>\s*([^<]+?)\s*</)?.[1];
  if (code && code !== "00" && code !== "0")
    return xml.match(/<resultMsg>([^<]+)</)?.[1] ?? xml.match(/<ERR_NM>([^<]+)</)?.[1] ?? xml.match(/<returnAuthMsg>([^<]+)</)?.[1] ?? `결과 코드 ${code}`;
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
  for (const col of ["org", "region", "hire", "recruit", "sectors", "headcount", "url", "nation", "lang", "visa", "career", "industry"])
    if (a[col]) row[col] = pick(d, a[col]);
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
  pages: { page: number; saved: number; oldest: string | null; newest: string | null }[];
  keys?: string[]; sample?: Record<string, string>; saved: number; cursor?: Cursor;
};

async function readCursor(db: ReturnType<typeof svc>): Promise<Record<string, Cursor>> {
  const { data } = await db.from("site_settings").select("value").eq("key", "jobs_cursor").maybeSingle();
  return ((data?.value as Record<string, Cursor>) ?? {});
}
async function writeCursor(db: ReturnType<typeof svc>, all: Record<string, Cursor>) {
  await db.from("site_settings").upsert({ key: "jobs_cursor", value: all as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

/** 한 소스를 pagesPerRun 쪽까지 읽는다. */
export async function ingest(name: Source, opts: { pages?: number; since?: string; reset?: boolean } = {}): Promise<RunReport> {
  const conf = SRC[name];
  const pagesPerRun = opts.pages ?? 6;
  const since = opts.since ?? SINCE_DEFAULT;
  const report: RunReport = { source: name, ok: false, pages: [], saved: 0 };
  if (!KEY) return { ...report, reason: "DATA_GO_KR_KEY 미설정" };
  const db = svc();

  const first = await fetchPage(conf.url, 1);
  if (!first) return { ...report, reason: "첫 쪽을 못 받았다 (연결 실패)" };
  const err = resultError(first);
  if (err) return { ...report, reason: err };
  const firstItems = parseItems(first, conf.item);
  const total = Number(first.match(/<totalCount>\s*(\d+)/)?.[1]) || firstItems.length;
  const lastPage = Math.max(1, Math.ceil(total / ROWS));
  report.total = total; report.lastPage = lastPage;
  if (firstItems[0]) { report.keys = Object.keys(firstItems[0]); report.sample = firstItems[0]; }

  const cursors = await readCursor(db);
  let cur = cursors[name];
  // 처음이거나 다시 시작하거나, 이미 끝까지 읽었으면 최신 쪽부터 다시(새 공고를 얹는다)
  if (!cur || opts.reset || cur.done || cur.lastPage !== lastPage && cur.done) {
    cur = { nextPage: lastPage, lastPage, total, done: cur?.done ?? false, updated: new Date().toISOString() };
    if (cur.done) cur.nextPage = lastPage; // 최신 두세 쪽만
  }
  const budget = cur.done ? Math.min(pagesPerRun, 3) : pagesPerRun;
  let page = Math.min(cur.nextPage, lastPage);
  let read = 0;
  let stop = false;
  while (page >= 1 && read < budget && !stop) {
    const xml = page === 1 ? first : await fetchPage(conf.url, page);
    if (!xml) { page--; read++; continue; }
    const rows = parseItems(xml, conf.item).map((d) => toRow(name, d)).filter((r): r is Row => !!r);
    if (rows.length) {
      const { error } = await db.from("job_posts").upsert(rows as never[], { onConflict: "id" });
      if (error) return { ...report, reason: `저장 실패: ${error.message}` };
    }
    const dates = rows.map((r) => r[conf.orderKey] as string | null).filter((x): x is string => !!x).sort();
    const oldest = dates[0] ?? null, newest = dates[dates.length - 1] ?? null;
    report.pages.push({ page, saved: rows.length, oldest, newest });
    report.saved += rows.length;
    if (oldest && oldest < since) stop = true;
    page--; read++;
  }
  const done = stop || page < 1 || cur.done;
  cursors[name] = { nextPage: done ? lastPage : page, lastPage, total, done, updated: new Date().toISOString() };
  await writeCursor(db, cursors);
  report.cursor = cursors[name];
  report.ok = true;
  return report;
}
