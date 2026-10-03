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
  const r = await fetchOnce(url, ms);
  // 정부 누리집 가운데 중간 인증서를 빠뜨려 https 검증이 실패하는 곳이 많다. 같은 주소의 http 로 한 번 더.
  // (검증을 끄지는 않는다. http 로 열리는 곳만 읽는다.)
  if (r.status === 0 && url.startsWith("https://") && !/aborted/i.test(r.text)) {
    const h = await fetchOnce(url.replace(/^https:/, "http:"), ms);
    if (h.status !== 0) return h;
  }
  return r;
}

async function fetchOnce(url: string, ms: number): Promise<{ ok: boolean; status: number; url: string; text: string }> {
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

type Rule = { allow: boolean; path: string };
const robotsCache = new Map<string, Rule[]>();

/**
 * robots.txt 를 표준(RFC 9309)대로 읽는다. 우리 이름(narajiwon)이 적힌 묶음이 있으면 그것, 없으면 * 묶음.
 * 이전에는 Disallow 가 하나라도 맞으면 막힌 것으로 봤다. "전체 금지, 게시판은 허용" 처럼 Allow 로 일부를
 * 여는 곳까지 막혔다고 본 셈이다. 못 읽으면(없음·오류) 막힌 것이 없다고 본다.
 */
export function parseRobots(text: string): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let cur: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([\w-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase());
      lastWasAgent = true;
    } else if ((k === "allow" || k === "disallow") && cur) {
      if (v) cur.rules.push({ allow: k === "allow", path: v });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && "narajiwonbot".includes(a.replace(/\/.*$/, ""))));
  const pick = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  return pick.flatMap((g) => g.rules);
}

const toRe = (p: string) => new RegExp("^" + p.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));

/** 가장 길게 맞는 규칙이 이긴다. 길이가 같으면 Allow. */
export function robotsAllows(rules: Rule[], path: string): boolean {
  let best: Rule | null = null;
  for (const r of rules) {
    if (!toRe(r.path).test(path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return !best || best.allow;
}

async function robotsOf(origin: string): Promise<Rule[]> {
  const hit = robotsCache.get(origin);
  if (hit) return hit;
  const r = await fetchText(`${origin}/robots.txt`, 6_000);
  const rules = r.ok && !/<html/i.test(r.text.slice(0, 500)) ? parseRobots(r.text) : [];
  robotsCache.set(origin, rules);
  return rules;
}

export async function allowed(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    return robotsAllows(await robotsOf(u.origin), u.pathname + u.search);
  } catch {
    return false;
  }
}

// ── HTML 에서 링크 읽기 ──────────────────────────────

const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim();

type Link = { href: string; text: string; at: number; end: number; js?: boolean };

/** keepJs 면 javascript:·# 링크도 남긴다(href 는 지금 쪽 주소, js 표시). 게시판 글 링크를 스크립트로 여는 곳이 많다. */
export function links(html: string, base: string, keepJs = false): Link[] {
  const out: Link[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const href = /href\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1]?.trim() ?? "";
    const text = strip(m[2]) || strip(/title\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? "");
    if (/^(mailto:|tel:)/i.test(href)) continue;
    if (!href || /^(javascript:|#)/i.test(href)) {
      if (keepJs && (href || /onclick/i.test(attrs))) out.push({ href: base, text, at: m.index, end: m.index + m[0].length, js: true });
      continue;
    }
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
  // 메뉴 이름이 딱 맞지 않으면 한 번 더 느슨하게: 짧은 글에 '채용'이 들었거나 주소에 recruit·employ 가 든 링크.
  if (!job) {
    for (const l of links(html, base)) {
      const t = l.text.trim();
      if (!same(l.href) || t.length > 20) continue;
      if (/채용/.test(t) && !/결과|합격|안내문|FAQ/i.test(t)) { job = l.href; break; }
      if (/recruit|employ|hiring|chaeyong/i.test(l.href) && t.length >= 2) { job = l.href; break; }
    }
  }
  if (!notice) {
    for (const l of links(html, base)) {
      const t = l.text.trim();
      if (same(l.href) && t.length <= 12 && /고시|공고|공지/.test(t)) { notice = l.href; break; }
    }
  }
  return { job, notice };
}

/** 공지 게시판 글 가운데 이용자에게 쓸모 있는 것: 지원·모집·사업·신청. 입찰·매각·사칭 주의·휴무 같은 것은 뺀다. */
const NOTICE_KEEP = /지원|모집|사업|공모|신청|접수|채용|선발|보조|바우처|수당|장려금|장학|교육생|참여자|입주|대상자|혜택|감면|대출|급여|일자리|창업|청년|출산|육아|어르신|장애인|소상공인/;
const NOTICE_DROP = /입찰|매각|반송|우편물|보관\s?공고|사칭|금품|청탁|정전|전산\s?장애|업무\s?중지|휴무|휴관|개국|폐국|이벤트|당첨|추첨|경품|우표|사기\s?주의|공시송달|도로\s?점용|행정처분|개인정보|열람\s?공고|결정\s?고시/;
export const noticeUseful = (t: string) => NOTICE_KEEP.test(t) && !NOTICE_DROP.test(t);

/**
 * 읽지 않는 누리집. 우체국들은 지방우정청의 채용판·공지판을 지점마다 다른 주소로 보여 줘서
 * 같은 글이 우체국 수십 곳에 붙었다(첫 돌림에 4,763건 중 3,428건). 우정 채용은 나라일터에도 올라온다.
 */
const SKIP_HOST = /(^|\.)koreapost\.go\.kr$/;
const skipHost = (u: string) => { try { return SKIP_HOST.test(new URL(u).hostname); } catch { return true; } };

/** 짧은 표지(FNV-1a). 같은 게시판에서 같은 제목이면 같은 값. */
function hash(t: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

const DATE_RE = /(20\d{2})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/;
const NAV_WORD = /^(처음|이전|다음|마지막|더보기|목록|홈|home|top|로그인|회원가입|사이트맵|검색|닫기|열기|\d+)$/i;

/**
 * 게시판 첫 쪽의 글 목록. 날짜가 곁에 붙은 링크만 글로 본다(메뉴·꼬리말 링크에는 날짜가 없다).
 * 날짜는 링크 뒤 400자 안(같은 줄의 칸)에서, 없으면 앞 200자 안에서 찾는다.
 */
export function boardItems(html: string, base: string): { title: string; url: string; posted: string | null }[] {
  const ls = links(html, base, true);
  const out: { title: string; url: string; posted: string | null }[] = [];
  const seen = new Set<string>();
  const today = Date.now();
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    // 게시판이 제목 칸에 같이 그리는 표시를 뗀다: 앞의 "제목", 끝의 "새글·첨부파일 있음·N·HOT".
    let title = l.text.replace(/^(글\s?)?제목\s*[:：]?\s*/, "").trim();
    for (let k = 0; k < 4; k++) title = title.replace(/\s*(새\s?글|새\s?게시물|첨부\s?파일(\s?있음)?|파일\s?첨부|new|hot|N)\s*$/i, "").trim();
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
    // 스크립트로 여는 글은 글 주소를 알 수 없다. 게시판 주소에 제목 표지를 붙여 고유하게 두고, 누르면 게시판으로 간다.
    const key = l.js ? `${base.replace(/#.*$/, "")}#t=${hash(title)}` : l.href.replace(/#.*$/, "");
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
  const have = await allOrgs();
  const recent: string[] = [];
  // PostgREST 는 한 번에 1000줄까지만 준다. 나눠 받는다.
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await db.from("job_org_recent").select("org").gt("n12", 0)
      .order("n12", { ascending: false }).order("org").range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as { org: string }[]) recent.push(r.org);
    if (!data || data.length < 1000) break;
  }
  const todo = recent.filter((o) => !have.has(o));
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
    // 여러 기관이 한 게시판을 같이 쓰면(우체국들이 한 공지판) 글이 엉뚱한 기관에 붙는다. 이미 다른 기관 것이면 비운다.
    for (const k of ["job", "notice"] as const) {
      const col = k === "job" ? "job_board" : "notice_board";
      if (!b[k]) continue;
      const dup = await db.from("org_sites").select("org", { count: "exact", head: true }).eq(col, b[k]!).neq("org", s.org);
      if ((dup.count ?? 0) > 0) b[k] = null;
    }
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
      if (!board || skipHost(board)) continue;
      if (!(await allowed(board))) { err = "robots"; continue; }
      const r = await fetchText(board);
      if (!r.ok) { err = `${kind} ${r.status}`; continue; }
      let items = boardItems(r.text, r.url).filter((it) => kind === "job" || noticeUseful(it.title));
      if (!items.length) { err = err ?? `${kind} 글 0`; continue; }
      // 같은 누리집의 같은 글(제목·날짜)이 이미 다른 기관에 붙어 있으면 넣지 않는다. 한 게시판을 여러 기관이 보여 주는 경우.
      const host = new URL(r.url).hostname;
      const dup = await db.from("org_posts").select("title,posted,url").neq("org", s.org).in("title", items.map((it) => it.title)).limit(200);
      const taken = new Set(((dup.data ?? []) as { title: string; posted: string | null; url: string }[])
        .filter((d) => { try { return new URL(d.url).hostname === host; } catch { return false; } })
        .map((d) => `${d.title}|${d.posted}`));
      items = items.filter((it) => !taken.has(`${it.title}|${it.posted}`));
      if (!items.length) { err = err ?? `${kind} 다른 기관과 같은 게시판`; continue; }
      const up = await db.from("org_posts").upsert(
        items.map((it) => ({ org: s.org, kind, title: it.title, url: it.url, posted: it.posted, board, last_seen: now })),
        { onConflict: "url", ignoreDuplicates: true },
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

// ── 4. tidy: 지저분한 제목 지우기 ────────────────────

/**
 * 예전 판독이 남긴 제목(앞의 "제목", 끝의 "새글·첨부파일 있음", &#40; 같은 숫자 엔티티)을 지운다.
 * 다음 crawl 에서 깨끗한 제목으로 다시 들어온다. 하루 한 번 돌아도 지울 것이 없으면 곧 끝난다.
 */
export async function tidyStep(): Promise<StepResult> {
  const db = svcDb();
  const res: StepResult = { step: "tidy", done: 0, found: 0, errors: 0, more: false, notes: [] };
  const { data, error } = await db.from("org_posts").select("id")
    .or("title.ilike.%새글%,title.ilike.%새 글%,title.ilike.%첨부파일%,title.ilike.%첨부 파일%,title.ilike.%&#%,title.ilike.제목%")
    .limit(500);
  if (error) throw error;
  const ids = ((data ?? []) as { id: number }[]).map((r) => r.id);
  if (ids.length) {
    const del = await db.from("org_posts").delete().in("id", ids);
    if (del.error) { res.errors++; res.notes.push(del.error.message); }
    else res.found = ids.length;
    // 이 기관들은 다음 crawl 에서 다시 읽게.
  }
  res.done = ids.length;
  res.more = ids.length === 500;
  return res;
}
