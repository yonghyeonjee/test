/**
 * 나라일터 웹사이트를 직접 읽어 오는 길을 살펴본다.
 *
 * 공공데이터포털 API(PblJobService)는 오래된 것부터 주고 최신은 2,901쪽
 * 뒤에 있는데, 그 깊이의 쪽이 한 번도 응답하지 않았다. 사이트 목록은
 * 최신이 1쪽에 있으니 그쪽이 되면 훨씬 낫다.
 *
 * 다만 남의 사이트를 긁는 일이라 지킬 것을 먼저 지킨다.
 *  - robots.txt 를 먼저 읽고, 막아 두었으면 긁지 않는다.
 *  - 우리가 누구인지 밝히는 User-Agent 를 보낸다.
 *  - 하루 한 번, 앞쪽 몇 쪽만 읽는다. 과거 29만 건을 훑지 않는다.
 *
 * 이 파일은 지금은 "볼 수 있는지"만 확인한다. 실제 파싱은 아래 점검
 * 결과(진짜 HTML 모양)를 보고 나서 붙인다 — 안 보고 짐작으로 쓰면
 * 항목 이름을 틀렸던 지난번을 되풀이하게 된다.
 */

const BASE = "https://www.gojobs.go.kr";
export const LIST_URL =
  `${BASE}/apmList.do?menuNo=401&mngrMenuYn=N&selMenuNo=400&upperMenuNo=`;

// HTTP 헤더는 바이트 하나에 한 글자씩만 담는다(ByteString). 한글을 넣으면
// fetch 가 부르기도 전에 TypeError 로 죽는다 — 실제로 그렇게 죽었다.
// 헤더에 들어가는 값은 무조건 ASCII 로만 쓴다.
const UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com)";

export type SiteProbe = {
  step: string;
  ok: boolean;
  detail: string;
  ms: number;
};

async function get(url: string, ms = 15_000) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(ms),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, type: res.headers.get("content-type") ?? "", text, ms: Date.now() - t0 };
  } catch (e) {
    return {
      ok: false, status: 0, type: "", text: "",
      ms: Date.now() - t0,
      err: e instanceof Error ? (e.name === "TimeoutError" ? `${ms / 1000}초 안에 응답 없음` : `${e.name}: ${e.message}`) : String(e),
    };
  }
}

/** robots.txt 에서 우리에게 걸리는 줄만 뽑는다. */
function robotsVerdict(txt: string) {
  const lines = txt.split(/\r?\n/).map((l) => l.trim());
  const blocks: { agents: string[]; rules: string[] }[] = [];
  let cur: { agents: string[]; rules: string[] } | null = null;
  for (const l of lines) {
    if (/^user-agent:/i.test(l)) {
      const a = l.split(":")[1].trim();
      if (cur && cur.rules.length) { blocks.push(cur); cur = null; }
      cur = cur ?? { agents: [], rules: [] };
      cur.agents.push(a);
    } else if (/^(dis)?allow:/i.test(l) && cur) {
      cur.rules.push(l);
    }
  }
  if (cur) blocks.push(cur);
  const mine = blocks.filter((b) => b.agents.some((a) => a === "*" || /narajiwon/i.test(a)));
  const rules = mine.flatMap((b) => b.rules);
  const blocked = rules.some((r) => {
    const m = r.match(/^disallow:\s*(\S*)/i);
    if (!m) return false;
    const path = m[1];
    return path === "/" || (path && "/apmList.do".startsWith(path));
  });
  return { blocked, rules: rules.length ? rules.join(" | ") : "우리에게 걸리는 규칙 없음" };
}

const strip = (h: string) =>
  h.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/**
 * HTML 의 뼈대를 요약한다. 파서를 쓰려면 진짜 모양을 봐야 한다.
 *
 * 처음에는 "td 가 든 첫 줄"을 집었는데 그건 검색 폼이었다. 화면 위쪽에
 * 검색 상자가 표로 짜여 있어서 목록보다 먼저 나온다. 그래서 표를 하나씩
 * 다 보고, 머리글로 어느 것이 목록인지 가린다.
 */
function outline(html: string) {
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]);
  const out: string[] = [
    `길이 ${html.length.toLocaleString()}자 · table ${tables.length} · ` +
    `tr ${(html.match(/<tr[^>]*>/gi) ?? []).length} · li ${(html.match(/<li[^>]*>/gi) ?? []).length}`,
  ];

  tables.forEach((t, i) => {
    const heads = [...t.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => strip(m[1])).filter(Boolean);
    // 목록 줄은 th 없이 td 만 있고, 입력 상자가 없다.
    const rows = [...t.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
    const dataRows = rows.filter((r) => /<td/i.test(r) && !/<th/i.test(r) && !/<input|<select/i.test(r));
    out.push(
      `\n[표 ${i + 1}] 머리글: ${heads.join(" / ") || "없음"}` +
      `\n  줄 ${rows.length} · 자료 줄 ${dataRows.length}` +
      (dataRows[0] ? `\n  첫 자료 줄(원본):\n  ${dataRows[0].replace(/\s+/g, " ").slice(0, 900)}` : "") +
      (dataRows[1] ? `\n  둘째 자료 줄(글자만): ${strip(dataRows[1]).slice(0, 300)}` : ""),
    );
  });

  // 상세로 넘어가는 주소 모양. 이게 있어야 공고마다 원문을 걸 수 있다.
  const hrefs = [...new Set(
    [...html.matchAll(/(?:href|onclick)="([^"]*(?:\.do|fn_[A-Za-z]+\()[^"]*)"/g)]
      .map((m) => m[1].replace(/\s+/g, " ").slice(0, 120)),
  )].slice(0, 14);
  out.push(`\n[링크 모양] ${hrefs.length ? "\n  " + hrefs.join("\n  ") : "없음"}`);

  // 전체 건수와 쪽 넘김 단서.
  const cnt = html.match(/총\s*<?[^>]*>?\s*([\d,]+)\s*<?[^>]*>?\s*건/);
  out.push(`\n[건수 표시] ${cnt ? cnt[0].replace(/<[^>]*>/g, "") : "못 찾음"}`);

  return out.join("\n");
}

/**
 * 사이트에서 받아올 수 있는지 한 번에 본다.
 * robots.txt → 목록 1쪽 → 뼈대 요약 순으로 보고, 막혀 있으면 거기서 멈춘다.
 */
export async function probeSite(): Promise<SiteProbe[]> {
  const out: SiteProbe[] = [];

  const rb = await get(`${BASE}/robots.txt`, 10_000);
  if (!rb.ok) {
    out.push({
      step: "robots.txt",
      ok: false,
      detail: "err" in rb ? rb.err! : `응답 ${rb.status} — robots.txt 가 없으면 보통 전체 허용으로 봅니다.`,
      ms: rb.ms,
    });
  } else {
    const v = robotsVerdict(rb.text);
    out.push({
      step: "robots.txt",
      ok: !v.blocked,
      detail: v.blocked
        ? `막혀 있습니다. 긁지 않습니다. → ${v.rules}`
        : `허용. ${v.rules}`,
      ms: rb.ms,
    });
    if (v.blocked) return out;
  }

  const page = await get(LIST_URL, 20_000);
  if (!page.ok) {
    out.push({
      step: "목록 1쪽",
      ok: false,
      detail: "err" in page ? page.err! : `응답 ${page.status}`,
      ms: page.ms,
    });
    return out;
  }
  out.push({ step: "목록 1쪽", ok: true, detail: `응답 ${page.status} · ${page.type}`, ms: page.ms });
  out.push({ step: "HTML 뼈대", ok: true, detail: outline(page.text), ms: 0 });
  return out;
}

// ── 목록 읽기 ──────────────────────────────────────────────

export type SiteJob = {
  /** fn_apmView('020','303444') 의 뒤 숫자. 공고를 가리키는 번호다. */
  id: string;
  /** 앞 숫자. 기관 계통 코드로 보인다. 상세 주소를 만들 때 같이 쓴다. */
  sys: string;
  title: string;
  org: string | null;
  /** 제목 앞 아이콘의 alt. "교육", "지방자치단체" 같은 기관 유형이다. */
  cate: string | null;
  regDate: string | null;
  endDate: string | null;
};

const cell = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

const ymd = (v: string) => v.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

/**
 * 목록 표에서 공고를 읽어 낸다.
 *
 * 표는 두 개다. 첫째는 화면 위쪽 검색 상자고, 우리가 볼 것은 둘째다.
 * 머리글이 번호/공고명/기관명/공고게시일/접수마감일/조회 인 표를 고른다.
 *
 * 줄 모양(2026-09 확인):
 *   <td>1</td>
 *   <td class="ta_l elip"><div><img alt="교육"/></div>
 *       <a href="javascript:fn_apmView('020', '303444')"> 제목 </a></td>
 *   <td>인천광역시교육청 … 인천송림초등학교</td>
 *   <td>2026-09-12</td> <td>2026-09-15</td> <td>65</td>
 */
export function parseList(html: string): SiteJob[] {
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]);
  const table = tables.find((t) => /공고게시일/.test(t) && /접수마감일/.test(t));
  if (!table) return [];

  const out: SiteJob[] = [];
  for (const m of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = m[1];
    if (/<th/i.test(row)) continue;
    const view = row.match(/fn_apmView\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/);
    if (!view) continue;
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((t) => t[1]);
    if (tds.length < 5) continue;

    const title = cell(tds[1].replace(/<div>[\s\S]*?<\/div>/i, ""));
    if (!title) continue;

    out.push({
      sys: view[1],
      id: view[2],
      title,
      org: cell(tds[2]) || null,
      cate: tds[1].match(/alt="([^"]*)"/)?.[1]?.trim() || null,
      regDate: ymd(cell(tds[3])),
      endDate: ymd(cell(tds[4])),
    });
  }
  return out;
}

/**
 * 목록 한 쪽을 받아 읽는다.
 *
 * 쪽 넘김이 GET 으로 되는지 아직 모른다. 전자정부 표준틀은 대개
 * pageIndex 를 쓰므로 그걸로 시도하고, 1쪽과 같은 것이 오면 부르는 쪽이
 * 알아채도록 첫 공고 번호를 함께 돌려준다.
 */
export async function fetchList(page = 1): Promise<
  { ok: true; jobs: SiteJob[]; ms: number } | { ok: false; reason: string; ms: number }
> {
  const url = page > 1 ? `${LIST_URL}&pageIndex=${page}` : LIST_URL;
  const r = await get(url, 20_000);
  if (!r.ok) return { ok: false, reason: "err" in r ? r.err! : `응답 ${r.status}`, ms: r.ms };
  const jobs = parseList(r.text);
  if (!jobs.length) return { ok: false, reason: "목록 줄을 못 찾았습니다", ms: r.ms };
  return { ok: true, jobs, ms: r.ms };
}

/**
 * 상세 주소를 어떻게 만드는지는 페이지 안의 fn_apmView 가 알고 있다.
 * 그 함수 본문을 그대로 꺼내 온다 — 짐작으로 주소를 만들지 않는다.
 */
export async function readViewFn(): Promise<string> {
  const r = await get(LIST_URL, 20_000);
  if (!r.ok) return "err" in r ? r.err! : `응답 ${r.status}`;
  const m = r.text.match(/function\s+fn_apmView\s*\([^)]*\)\s*\{[\s\S]{0,700}?\n\s*\}/);
  return m ? m[0].replace(/\s+/g, " ").slice(0, 700) : "fn_apmView 정의를 못 찾음";
}

// ── 수집 ───────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

function svc() {
  const key = process.env.SUPABASE_SERVICE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) throw new Error("SUPABASE_SERVICE_KEY / NEXT_PUBLIC_SUPABASE_URL 미설정");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** 기관 이름에서 시·도를 읽어 낸다. 사이트도 근무지를 따로 주지 않는다. */
const SIDO = ["서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시",
  "울산광역시", "세종특별자치시", "경기도", "강원특별자치도", "강원도", "충청북도", "충청남도",
  "전북특별자치도", "전라북도", "전라남도", "경상북도", "경상남도", "제주특별자치도"];
const SHORT: Record<string, string> = { 서울: "서울특별시", 부산: "부산광역시", 대구: "대구광역시",
  인천: "인천광역시", 광주: "광주광역시", 대전: "대전광역시", 울산: "울산광역시", 세종: "세종특별자치시",
  경기: "경기도", 강원: "강원특별자치도", 충북: "충청북도", 충남: "충청남도", 전북: "전북특별자치도",
  전남: "전라남도", 경북: "경상북도", 경남: "경상남도", 제주: "제주특별자치도" };
function sidoOf(text: string): string | null {
  for (const s of SIDO)
    if (text.includes(s)) return s.replace("강원도", "강원특별자치도").replace("전라북도", "전북특별자치도");
  for (const [k, v] of Object.entries(SHORT)) if (text.startsWith(k)) return v;
  return null;
}

export type SiteRun = {
  ok: boolean;
  saved: number;
  pages: { page: number; got: number; saved: number; reason?: string }[];
  /** 쪽 넘김이 GET 으로 되나. 2쪽이 1쪽과 같으면 false. */
  paging: boolean | null;
  reason?: string;
  /** 상세 주소를 만드는 법. 아직 모를 때 여기에 단서를 남긴다. */
  viewFn?: string;
  elapsedMs: number;
};

/**
 * 나라일터 목록에서 최신 공고를 받아 job_posts 에 넣는다.
 *
 * API 는 오래된 것부터 주고 최신이 2,901쪽 뒤인데 그 깊이가 응답하지
 * 않는다(offset 에 비례해 느려져 마지막은 60초를 넘긴다). 사이트 목록은
 * 최신이 1쪽에 있다. robots.txt 가 허용하고, 앞쪽 몇 쪽만 하루 한 번 본다.
 */
export async function ingestSite(pages = 5, budgetMs = 40_000): Promise<SiteRun> {
  const t0 = Date.now();
  const run: SiteRun = { ok: false, saved: 0, pages: [], paging: null, elapsedMs: 0 };

  // 지킬 것부터. 막아 두었으면 아무것도 하지 않는다.
  const rb = await get(`${BASE}/robots.txt`, 8_000);
  if (rb.ok && robotsVerdict(rb.text).blocked)
    return { ...run, reason: "robots.txt 가 막고 있어 받지 않습니다.", elapsedMs: Date.now() - t0 };

  const db = svc();
  const now = new Date().toISOString();
  let firstIdOfPage1: string | null = null;

  for (let page = 1; page <= pages; page++) {
    if (Date.now() - t0 > budgetMs - 6_000) break;
    const r = await fetchList(page);
    if (!r.ok) {
      run.pages.push({ page, got: 0, saved: 0, reason: r.reason });
      break;
    }
    if (page === 1) firstIdOfPage1 = r.jobs[0]?.id ?? null;
    else if (r.jobs[0]?.id === firstIdOfPage1) {
      // 2쪽이 1쪽과 같다 = pageIndex 가 안 먹는다. 더 돌아도 같은 것만 온다.
      run.paging = false;
      run.pages.push({ page, got: r.jobs.length, saved: 0, reason: "1쪽과 같음 — 쪽 넘김이 GET 으로는 안 됩니다" });
      break;
    } else run.paging = true;

    const rows = r.jobs.map((j) => ({
      id: `gojobs:${j.id}`,
      source: "gojobs",
      source_id: j.id,
      title: j.title.slice(0, 500),
      org: j.org,
      region: sidoOf(j.org ?? ""),
      hire: j.cate,
      reg_date: j.regDate,
      end_date: j.endDate,
      url: null,
      raw: { sys: j.sys, from: "site" },
      fetched_at: now,
    }));
    const seen = new Set<string>();
    const uniq = rows.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
    const { error } = await db.from("job_posts").upsert(uniq as never[], { onConflict: "id" });
    if (error) return { ...run, reason: `저장 실패: ${error.message}`, elapsedMs: Date.now() - t0 };

    run.pages.push({ page, got: r.jobs.length, saved: uniq.length });
    run.saved += uniq.length;
  }

  // 상세 주소를 아직 못 만든다. 짐작으로 주소를 쓰면 눌러도 엉뚱한 데로
  // 간다. 답은 페이지 안의 fn_apmView 가 갖고 있으니 꺼내서 DB 에 적어 둔다
  // — 사람이 옮겨 적을 필요 없이 다음에 그대로 읽어 붙인다.
  if (run.saved > 0) {
    run.viewFn = await readViewFn().catch(() => "읽지 못함");
    await db.from("site_settings").upsert(
      { key: "gojobs_view_fn", value: { at: now, fn: run.viewFn } as never,
        updated_at: now },
      { onConflict: "key" },
    ).then(() => {}, () => {});
  }

  run.ok = run.saved > 0;
  if (!run.ok && !run.reason) run.reason = run.pages[0]?.reason ?? "받아온 것이 없습니다";
  run.elapsedMs = Date.now() - t0;
  return run;
}
