import { svcDb } from "./svcDb";

/**
 * 기관 홈페이지 공고 수집.
 *
 * 나라일터에 올리지 않고 기관 홈페이지 게시판에만 올리는 채용 공고와 공지(고시·공고·사업 안내)가 있다.
 * 세 단계로 모은다. 모두 서울 서버(/api/cron/orgsites)에서 돈다 — 정부 누리집 가운데 외국 IP 를 막는 곳이 있다.
 *
 *  1. seed     기관 홈페이지 주소. 위키데이터에 공식 누리집(P856)이 적힌 한국 기관만. 이름은 기관명의
 *              마지막 낱말("경찰청 경기남부청 수원영통경찰서" 면 수원영통경찰서)로 찾는다 — 윗 기관의 누리집을
 *              아랫 기관 것으로 붙이면 공고가 엉뚱한 기관에 달린다.
 *  2. discover 홈페이지 첫 화면의 메뉴에서 채용 게시판과 공지(고시공고) 게시판 링크를 찾는다. 한 달에 한 번.
 *  3. crawl    게시판 첫 쪽에서 제목·링크·날짜만 읽는다. 하루 한 번, 게시판마다 요청 한 번.
 *              본문은 옮기지 않는다. 화면에는 제목과 원문 링크만 보인다.
 *
 * 예의: robots.txt 를 지키고, 우리 이름을 밝히고(User-Agent), 한 기관에 하루 몇 번 이상 가지 않는다.
 */

export const UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com/about; public notice index)";
const FETCH_MS = 12_000;
const MAX_BYTES = 1_500_000;

type Site = {
  org: string; homepage: string | null; job_board: string | null; notice_board: string | null;
  fails: number;
};

export type StepResult = { step: string; done: number; found: number; errors: number; more: boolean; notes: string[] };

// ── 내려받기 ─────────────────────────────────────────

/** 글자판(EUC-KR 이 아직 많다)을 맞춰 읽는다. 너무 크면 앞부분만. */
export async function fetchText(url: string, ms = FETCH_MS): Promise<{ ok: boolean; status: number; url: string; text: string }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ac.signal, redirect: "follow", cache: "no-store",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", "Accept-Language": "ko-KR,ko;q=0.9" },
    });
    const buf = new Uint8Array(await r.arrayBuffer()).slice(0, MAX_BYTES);
    const ct = r.headers.get("content-type") ?? "";
    let cs = /charset=([\w-]+)/i.exec(ct)?.[1]?.toLowerCase();
    if (!cs) {
      const head = new TextDecoder("latin1").decode(buf.slice(0, 4000));
      cs = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1]?.toLowerCase();
    }
    const enc = cs && /euc-?kr|ks_c_5601|cp949|x-windows-949/.test(cs) ? "euc-kr" : "utf-8";
    let text: string;
    try { text = new TextDecoder(enc).decode(buf); } catch { text = new TextDecoder("utf-8").decode(buf); }
    return { ok: r.ok, status: r.status, url: r.url || url, text };
  } catch (e) {
    return { ok: false, status: 0, url, text: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

// ── robots.txt ───────────────────────────────────────

const robotsCache = new Map<string, string[]>();

/** User-agent: * (또는 우리 이름) 묶음의 Disallow 경로들. 못 읽으면 막힌 것이 없다고 본다. */
async function disallows(origin: string): Promise<string[]> {
  const hit = robotsCache.get(origin);
  if (hit) return hit;
  const r = await fetchText(`${origin}/robots.txt`, 6_000);
  const out: string[] = [];
  if (r.ok && !/<html/i.test(r.text.slice(0, 500))) {
    let mine = false;
    for (const raw of r.text.split(/\r?\n/)) {
      const line = raw.replace(/#.*/, "").trim();
      const m = /^([\w-]+)\s*:\s*(.*)$/.exec(line);
      if (!m) continue;
      const k = m[1].toLowerCase(), v = m[2].trim();
      if (k === "user-agent") mine = v === "*" || /narajiwon/i.test(v);
      else if (k === "disallow" && mine && v) out.push(v);
    }
  }
  robotsCache.set(origin, out);
  return out;
}

export async function allowed(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const rules = await disallows(u.origin);
    const path = u.pathname + u.search;
    return !rules.some((p) => p === "/" || path.startsWith(p.replace(/\*.*$/, "")));
  } catch {
    return false;
  }
}

// ── HTML 에서 링크 읽기 ──────────────────────────────

const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim();

type Link = { href: string; text: string; at: number; end: number };

export function links(html: string, base: string): Link[] {
  const out: Link[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const href = /href\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1]?.trim() ?? "";
    const text = strip(m[2]) || strip(/title\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? "");
    if (!href || /^(javascript:|#|mailto:|tel:)/i.test(href)) continue;
    try {
      out.push({ href: new URL(href.replace(/&amp;/g, "&"), base).toString(), text, at: m.index, end: m.index + m[0].length });
    } catch { /* 이상한 주소 */ }
  }
  return out;
}

const JOB_MENU = /^(채용|채용\s?(공고|정보|안내|게시판|소식)|인재\s?채용|직원\s?채용|채용\s?[·ㆍ\/]\s?(시험|공고)|시험\s?[·ㆍ\/]\s?채용|공무원\s?채용|채용\s?시험)$/;
const NOTICE_MENU: [RegExp, number][] = [
  [/^(고시\s?[·ㆍ\/]?\s?공고|공고\s?[·ㆍ\/]?\s?고시)$/, 3],
  [/^(사업\s?공고|지원\s?사업\s?공고|공모\s?[·ㆍ\/]?\s?사업)$/, 3],
  [/^(공고|공고\s?게시판|입찰\s?[·ㆍ\/]\s?공고)$/, 2],
  [/^(공지\s?사항|공지|새\s?소식|알림\s?사항)$/, 1],
];

/** 홈페이지 메뉴에서 채용·공지 게시판. 같은 누리집(같은 등록 도메인) 안의 링크만. */
export function findBoards(html: string, base: string): { job: string | null; notice: string | null } {
  const host = new URL(base).hostname.replace(/^www\./, "");
  const same = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, "").endsWith(host.split(".").slice(-3).join(".")); } catch { return false; } };
  let job: string | null = null;
  let notice: string | null = null;
  let best = 0;
  for (const l of links(html, base)) {
    const t = l.text.replace(/\s+/g, " ").trim();
    if (!t || t.length > 14 || !same(l.href)) continue;
    if (!job && JOB_MENU.test(t)) job = l.href;
    for (const [re, score] of NOTICE_MENU) if (score > best && re.test(t)) { notice = l.href; best = score; }
  }
  return { job, notice };
}

const DATE_RE = /(20\d{2})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/;
const NAV_WORD = /^(처음|이전|다음|마지막|더보기|목록|홈|home|top|로그인|회원가입|사이트맵|검색|닫기|열기|\d+)$/i;

/**
 * 게시판 첫 쪽의 글 목록. 날짜가 곁에 붙은 링크만 글로 본다(메뉴·꼬리말 링크에는 날짜가 없다).
 * 날짜는 링크 뒤 400자 안(같은 줄의 칸)에서, 없으면 앞 200자 안에서 찾는다.
 */
export function boardItems(html: string, base: string): { title: string; url: string; posted: string | null }[] {
  const ls = links(html, base);
  const out: { title: string; url: string; posted: string | null }[] = [];
  const seen = new Set<string>();
  const today = Date.now();
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    const title = l.text.replace(/\s*(새\s?글|new|N)$/i, "").trim();
    if (title.length < 6 || title.length > 200 || NAV_WORD.test(title)) continue;
    const next = ls[i + 1]?.at ?? html.length;
    const after = html.slice(l.end, Math.min(next, l.end + 400));
    // 앞쪽 날짜는 같은 줄(행) 안에서만. 앞 줄의 날짜를 꼬리말 링크에 붙이면 안 된다.
    let before = html.slice(Math.max(ls[i - 1]?.end ?? 0, l.at - 200), l.at);
    const cut = Math.max(before.lastIndexOf("</tr>"), before.lastIndexOf("</li>"), before.lastIndexOf("</dl>"), before.lastIndexOf("</article>"));
    if (cut >= 0) before = before.slice(cut);
    const afterRow = after.split(/<\/tr>|<\/li>|<\/dl>|<\/article>/)[0];
    const m = DATE_RE.exec(strip(afterRow)) ?? DATE_RE.exec(strip(before));
    if (!m) continue;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (Number.isNaN(+d) || +d > today + 7 * 864e5 || +d < today - 3 * 365 * 864e5) continue;
    const key = l.href.replace(/#.*$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: title.slice(0, 200), url: key, posted: d.toISOString().slice(0, 10) });
  }
  return out.slice(0, 40);
}

// ── 1. seed: 위키데이터 공식 누리집 ──────────────────

/** 기관명에서 찾을 이름. 마지막 낱말(그 기관 자신). 한 낱말이면 그것. */
export function nameOf(org: string): string | null {
  const parts = org.replace(/\([^)]*\)/g, " ").trim().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  return last.length >= 2 && last.length <= 30 ? last : null;
}

async function wikidataSites(names: string[]): Promise<Map<string, string>> {
  const vals = names.map((n) => `"${n.replace(/["\\]/g, "")}"@ko`).join(" ");
  const q = `SELECT ?label ?site WHERE { VALUES ?label { ${vals} } ?item rdfs:label ?label ; wdt:P856 ?site ; wdt:P17 wd:Q884 . }`;
  const r = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, {
    headers: { "User-Agent": UA, Accept: "application/sparql-results+json" }, cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!r.ok) throw new Error(`wikidata ${r.status}`);
  const j = (await r.json()) as { results: { bindings: { label: { value: string }; site: { value: string } }[] } };
  const out = new Map<string, string>();
  // 한 이름에 누리집이 여럿이면 .go.kr → .kr → https 순으로.
  const rank = (u: string) => (/\.go\.kr/.test(u) ? 0 : /\.(or|ac|re)\.kr/.test(u) ? 1 : /\.kr/.test(u) ? 2 : 3) * 2 + (u.startsWith("https") ? 0 : 1);
  for (const b of j.results.bindings) {
    const n = b.label.value, s = b.site.value;
    const cur = out.get(n);
    if (!cur || rank(s) < rank(cur)) out.set(n, s);
  }
  return out;
}

export async function seedStep(budgetMs = 40_000): Promise<StepResult> {
  const t0 = Date.now();
  const db = svcDb();
  const res: StepResult = { step: "seed", done: 0, found: 0, errors: 0, more: false, notes: [] };
  // 최근 1년 안에 공고를 낸 기관 가운데 아직 시드하지 않은 곳.
  const [recent, have] = await Promise.all([
    db.from("job_org_recent").select("org,n12").gt("n12", 0).order("n12", { ascending: false }).limit(5000),
    allOrgs(),
  ]);
  if (recent.error) throw recent.error;
  const todo = ((recent.data ?? []) as { org: string }[]).map((r) => r.org).filter((o) => !have.has(o));
  while (todo.length && Date.now() - t0 < budgetMs) {
    const batch = todo.splice(0, 60);
    const names = new Map<string, string>();
    for (const o of batch) { const n = nameOf(o); if (n) names.set(o, n); }
    let sites = new Map<string, string>();
    try {
      sites = await wikidataSites(Array.from(new Set(names.values())));
    } catch (e) {
      res.errors++; res.notes.push(String(e instanceof Error ? e.message : e)); break;
    }
    const now = new Date().toISOString();
    const rows = batch.map((o) => {
      const n = names.get(o) ?? null;
      const site = n ? sites.get(n) ?? null : null;
      if (site) res.found++;
      return { org: o, name_hit: n, homepage: site, seed_source: site ? "wikidata" : "none", seeded_at: now };
    });
    const up = await db.from("org_sites").upsert(rows, { onConflict: "org", ignoreDuplicates: true });
    if (up.error) { res.errors++; res.notes.push(up.error.message); break; }
    res.done += batch.length;
  }
  res.more = todo.length > 0 && res.errors === 0;
  return res;
}

async function allOrgs(): Promise<Set<string>> {
  const db = svcDb();
  const out = new Set<string>();
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await db.from("org_sites").select("org").range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as { org: string }[]) out.add(r.org);
    if (!data || data.length < 1000) break;
  }
  return out;
}

// ── 2. discover: 게시판 찾기 ─────────────────────────

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>, until: number) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length && Date.now() < until) await fn(items[i++]);
  }));
}

export async function discoverStep(budgetMs = 40_000): Promise<StepResult> {
  const until = Date.now() + budgetMs;
  const db = svcDb();
  const res: StepResult = { step: "discover", done: 0, found: 0, errors: 0, more: false, notes: [] };
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data, error } = await db.from("org_sites").select("org,homepage,job_board,notice_board,fails")
    .not("homepage", "is", null).or(`discovered_at.is.null,discovered_at.lt.${monthAgo}`)
    .lt("fails", 5).order("discovered_at", { ascending: true, nullsFirst: true }).limit(40);
  if (error) throw error;
  const sites = (data ?? []) as Site[];
  await pool(sites, 4, async (s) => {
    const now = new Date().toISOString();
    const home = s.homepage!;
    if (!(await allowed(home))) {
      await db.from("org_sites").update({ discovered_at: now, robots_block: true }).eq("org", s.org);
      res.done++; res.notes.push(`robots: ${s.org}`); return;
    }
    const r = await fetchText(home);
    if (!r.ok) {
      res.errors++;
      await db.from("org_sites").update({ discovered_at: now, fails: s.fails + 1, last_error: `home ${r.status} ${r.status ? "" : r.text.slice(0, 80)}` }).eq("org", s.org);
      return;
    }
    const b = findBoards(r.text, r.url);
    if (b.job || b.notice) res.found++;
    await db.from("org_sites").update({
      discovered_at: now, job_board: b.job, notice_board: b.notice, fails: 0, last_error: b.job || b.notice ? null : "게시판 링크 못 찾음",
    }).eq("org", s.org);
    res.done++;
  }, until);
  res.more = sites.length === 40;
  return res;
}

// ── 3. crawl: 게시판 첫 쪽 ───────────────────────────

export async function crawlStep(budgetMs = 40_000): Promise<StepResult> {
  const until = Date.now() + budgetMs;
  const db = svcDb();
  const res: StepResult = { step: "crawl", done: 0, found: 0, errors: 0, more: false, notes: [] };
  const dayAgo = new Date(Date.now() - 20 * 3600e3).toISOString();
  const { data, error } = await db.from("org_sites").select("org,homepage,job_board,notice_board,fails")
    .or("job_board.not.is.null,notice_board.not.is.null").or(`crawled_at.is.null,crawled_at.lt.${dayAgo}`)
    .lt("fails", 5).eq("robots_block", false).order("crawled_at", { ascending: true, nullsFirst: true }).limit(40);
  if (error) throw error;
  const sites = (data ?? []) as Site[];
  await pool(sites, 4, async (s) => {
    const now = new Date().toISOString();
    let got = 0;
    let err: string | null = null;
    for (const [kind, board] of [["job", s.job_board], ["notice", s.notice_board]] as const) {
      if (!board) continue;
      if (!(await allowed(board))) { err = "robots"; continue; }
      const r = await fetchText(board);
      if (!r.ok) { err = `${kind} ${r.status}`; continue; }
      const items = boardItems(r.text, r.url);
      if (!items.length) { err = err ?? `${kind} 글 0`; continue; }
      const up = await db.from("org_posts").upsert(
        items.map((it) => ({ org: s.org, kind, title: it.title, url: it.url, posted: it.posted, board, last_seen: now })),
        { onConflict: "url" },
      );
      if (up.error) { err = up.error.message.slice(0, 120); continue; }
      got += items.length;
    }
    const ok = got > 0;
    if (ok) res.found += got; else res.errors++;
    await db.from("org_sites").update({
      crawled_at: now, ok_at: ok ? now : undefined, last_count: got, last_error: err,
      fails: ok ? 0 : s.fails + 1,
    }).eq("org", s.org);
    res.done++;
  }, until);
  res.more = sites.length === 40;
  return res;
}
