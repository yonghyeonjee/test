import { JOB_SOURCES } from "./pubJobs";
import { agencyFromStore } from "./agencyStore";
import type { AlioItem } from "./alioplus";
import {
  countBusiness, countWelfare, db, dbConfigured, getSigunguIndex,
  matchBusiness, matchWelfare, type Program,
} from "./db";
import { FREE_GROUPS } from "./freeServices";
import { SIDO_SHORT, locate } from "./geo";
import { jobPath } from "./jobRoute";
import { tokenize } from "./keywords";
import { describe, parseQuery, toParams, type Parsed } from "./parse";
import { POSTS } from "./posts";
import { getLicenses, type License } from "./qnet";
import { searchStories } from "./stories";
import { expandTerms, expansions, relatedTerms } from "./thesaurus";
import { TOPICS } from "./topics";

/**
 * 통합 검색. 머리말 검색창에 적은 한 줄을 사이트의 모든 갈래에서 찾는다.
 *
 * 갈래마다 자료가 다른 곳에 있다 — 복지·기업은 DB 함수(match_*), 채용은
 * job_posts, 자격증은 큐넷 표, 공공기관은 alio 표, 안내 글과 허브는 코드에
 * 적힌 목록. 한 번에 나란히 부르고, 하나가 실패해도 나머지는 보여 준다.
 *
 * 조건(지역·나이·상태)은 홈 검색창과 같은 파서로 알아듣는다. "충북 35세 육아"
 * 면 충청북도·35세는 조건으로, 육아는 낱말로 간다. 채용은 지역만 쓴다.
 */

export type JobHit = {
  id: string; title: string; org: string | null; region: string | null;
  hire: string | null; end: string | null; open: boolean;
};

export type GuideHit = { href: string; title: string; desc: string; tag: string };

export type Section<T> = { items: T[]; total: number; href: string };

export type SearchResult = {
  q: string;
  parsed: Parsed;
  /** 알아들은 조건을 사람 말로. "충청북도", "35세" */
  bits: string[];
  /** 조건을 뺀 낱말. 본문 검색어. */
  term: string;
  welfare: Section<Program>;
  business: Section<Program>;
  /** also: 낱말 말고 같이 OR 로 찾은 연관어("경비" 에 경호·보안·방호). */
  jobs: Section<JobHit> & { openOnly: boolean; allTotal: number | null; also: string[] };
  licenses: Section<License>;
  agency: Section<AlioItem>;
  guides: GuideHit[];
  /** 읽지 못한 갈래. 화면에 "지금은 못 읽었다"고 적는다. */
  failed: string[];
  /** 연관 검색어. 누르면 그 말로 다시 찾는다. */
  related: string[];
  /** 낱말마다 어떤 연관어를 같이 찾았는지. */
  expanded: { word: string; also: string[] }[];
  /** 갈래를 보일 순서(찾는 말에 맞는 갈래부터). */
  order: SectionKey[];
  /** 지역을 같이 적었으면 그 자리 정책지도. */
  mapHref: string | null;
};

const PER = 6;

// ── 안내 글·허브: 코드에 적힌 목록 ───────────────────────
type Page = GuideHit & { keys: string[] };

const PAGES: Page[] = [
  { href: "/blog/youth-future-savings", tag: "안내 글", title: "청년미래적금 2차 신청 — 기간, 조건, 3년 뒤 받는 돈",
    desc: "나이·소득 조건과 정부기여금 6%·12% 차이, 3년 뒤 받는 금액을 계산기로 봅니다.",
    keys: ["청년미래적금", "적금", "청년도약계좌", "정부기여금", "청년 목돈"] },
  { href: "/blog/gojobs-guide", tag: "안내 글", title: "나라일터 채용공고, 절반이 7일 안에 마감됩니다",
    desc: "공무직·기간제·임기제 공고가 언제 올라오고 어디서 지원하는지, 3만 2천 건을 세어 정리했습니다.",
    keys: ["나라일터", "공무직", "기간제", "임기제", "채용", "공공기관 채용"] },
  { href: "/story/jeonse-extension", tag: "블로그", title: "버팀목 전세대출 1개월 연장, 연장 후 이사까지",
    desc: "한시적 연장 계약서로 기한연장하고 잔금일에 목적물 변경하는 순서를 실제 사례로 정리했습니다.",
    keys: ["버팀목", "전세대출", "연장", "기한연장", "목적물 변경", "이사", "전세", "HUG"] },
  { href: "/blog/income", tag: "계산기", title: "“기준 중위소득 180% 이하”는 얼마일까",
    desc: "연소득과 가구원 수를 넣으면 몇 %인지, 어느 기준선에 드는지 바로 봅니다.",
    keys: ["중위소득", "소득", "소득 기준", "계산기", "가구소득"] },
  { href: "/money/jeonse", tag: "생활금융", title: "전세자금대출 은행별 금리 비교",
    desc: "주택금융공사 보증 전세대출의 은행별 금리를 낮은 순으로 세워 두었습니다.",
    keys: ["전세", "전세대출", "전세자금", "금리", "버팀목", "청년 전세"] },
  { href: "/money/home-loan", tag: "생활금융", title: "보금자리론·디딤돌 구입자금 금리",
    desc: "주택 구입자금 정책대출의 이달 금리를 매일 받아 보여 줍니다.",
    keys: ["보금자리론", "디딤돌", "주택구입", "매매", "구입자금", "내집마련", "금리"] },
  { href: "/money/student-loan", tag: "생활금융", title: "학자금 대출 이자지원 되는 지자체",
    desc: "학자금 대출 이자를 대신 내주는 지역을 모았습니다.",
    keys: ["학자금", "이자지원", "대학생", "장학금", "학자금 대출"] },
  { href: "/housing", tag: "주거", title: "신혼부부·청년·무주택 가구 주거 지원",
    desc: "전세·월세·매매별로 정부 대출 조건과 지자체 사업을 모았습니다.",
    keys: ["신혼부부", "청년", "무주택", "주거", "전세", "월세", "매매", "주택"] },
  { href: "/license", tag: "자격증", title: "국가자격 종목 전체 목록",
    desc: "무슨 자격증이 있는지 직무 분야와 등급으로 나눠 두었습니다.",
    keys: ["자격증", "국가자격", "기사", "기능사", "산업기사", "기술사"] },
  { href: "/license/schedule", tag: "자격증", title: "국가자격 시험 일정",
    desc: "다가오는 필기·실기 접수와 시험일을 한 표에 모았습니다.",
    keys: ["시험 일정", "시험일정", "접수", "필기", "실기", "자격증"] },
  { href: "/jobs/overseas", tag: "채용", title: "해외취업 공고 (월드잡플러스)",
    desc: "나라별·직무별 해외취업 공고입니다.", keys: ["해외취업", "해외", "월드잡", "해외 채용"] },
  { href: "/jobs/majors", tag: "채용", title: "학과별 취업률",
    desc: "어느 학과가 어디로 취업하는지 봅니다.", keys: ["학과", "취업률", "전공"] },
  { href: "/story", tag: "블로그", title: "블로그 — 사례로 보는 지원 제도",
    desc: "실제로 겪을 법한 상황을 따라가며 순서와 서류를 안내합니다.", keys: ["블로그", "사례", "후기"] },
  { href: "/agency", tag: "공공기관", title: "공공기관 지원사업·행사·시설",
    desc: "지자체 공고에 안 나오는 공공기관 사업을 생애주기와 분야로 찾습니다.",
    keys: ["공공기관", "공기업", "행사", "시설"] },
  ...TOPICS.map((t) => ({
    href: `/topic/${t.slug}`, tag: "분야", title: `${t.name} 분야 지원사업 모아보기`, desc: t.long,
    keys: [t.key, t.name, ...t.long.split("·")],
  })),
  ...POSTS.map((p) => ({
    href: `/blog/${p.slug}`, tag: "안내 글", title: p.title, desc: p.description, keys: p.keywords,
  })),
  ...FREE_GROUPS.flatMap((g) => g.items.map((i) => ({
    href: i.href, tag: g.title, title: i.title, desc: i.desc, keys: [g.title, i.title],
  }))),
];

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

function findGuides(words: string[]): GuideHit[] {
  const ws = words.map(norm).filter((w) => w.length >= 2);
  if (!ws.length) return [];
  // 낱말 그대로 걸리면 2점, 연관어("대학생" → 청년)로 걸리면 1점.
  const exp = ws.map((w) => expandTerms(w).map(norm).filter((t) => t !== w && t.length >= 2));
  return PAGES
    .map((p) => {
      const hay = [p.title, ...p.keys].map(norm);
      const has = (t: string) => hay.some((h) => h.includes(t));
      const score = ws.reduce((a, w, i) => a + (has(w) ? 2 : exp[i].some(has) ? 1 : 0), 0);
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, PER)
    .map(({ p }) => ({ href: p.href, title: p.title, desc: p.desc, tag: p.tag }));
}

// ── 채용 ─────────────────────────────────────────────
/** PostgREST or() 안에 들어가는 값. 쉼표·괄호가 있으면 식이 깨진다. */
const safe = (w: string) => w.replace(/[,()%]/g, "").trim();

/**
 * 낱말 하나를 "제목이나 기관명에 이 말 또는 연관어가 있다" 는 식으로.
 * "경비" → title.ilike.%경비%,org.ilike.%경비%,title.ilike.%경호%,…
 */
function orClause(terms: string[]) {
  return terms.flatMap((t) => [`title.ilike.%${t}%`, `org.ilike.%${t}%`]).join(",");
}

/** 지역 거르기. 채용 공고의 절반 넘게 region 칸이 비어 있어, 기관명·제목에 지역 이름이 있어도 넣는다. */
function regionClause(sido?: string, sigungu?: string): string | null {
  if (sigungu) {
    const last = sigungu.trim().split(/\s+/).pop() ?? "";
    const stem = last.length > 2 ? last.replace(/(시|군|구)$/, "") : last;
    const ts = Array.from(new Set([last, stem].map(safe).filter((t) => t.length >= 2)));
    if (ts.length) return ts.flatMap((t) => [`org.ilike.%${t}%`, `title.ilike.%${t}%`]).join(",");
  }
  if (!sido) return null;
  const shorts = (SIDO_SHORT[sido] ?? "").split("·").map(safe).filter((t) => t.length >= 2);
  return [`region.ilike.%${safe(sido)}%`, ...shorts.flatMap((t) => [`org.ilike.%${t}%`, `title.ilike.%${t}%`])].join(",");
}

/** 직업·채용을 찾는 말. 이런 말이면 채용 갈래를 맨 위로 올린다. */
const JOB_INTENT = /채용|모집|구인|공고|일자리|알바|취업|공무직|기간제|계약직|정규직|무기계약|인턴|경비|보안|청소|미화|환경관리|조리|영양|급식|운전|기사|간호|요양|보육교사|사무|행정|연구원|강사|상담사|사회복지사|시설관리|당직|방호|주차|검침|배달|생산|물류|교사|직원|사원/;

export type SectionKey = "welfare" | "business" | "jobs" | "guides" | "licenses" | "agency";

/**
 * 갈래 순서. 늘 복지부터가 아니라, 찾는 말과 제목이 맞는 갈래를 위로.
 * 채용을 찾는 말(직업 이름)이면 채용이 먼저다. 정책을 찾았을 수도 있으니 아래에 다 남긴다.
 */
function orderSections(words: string[], r: SearchResult): SectionKey[] {
  const ws = words.map((w) => w.replace(/\s+/g, "")).filter((w) => w.length >= 2);
  const hitRate = (titles: string[]) => {
    if (!titles.length || !ws.length) return 0;
    const n = titles.filter((t) => ws.some((w) => t.replace(/\s+/g, "").includes(w))).length;
    return n / titles.length;
  };
  const score: Record<SectionKey, number> = {
    welfare: hitRate(r.welfare.items.map((x) => x.title)) + (r.welfare.total ? 0.15 : 0),
    business: hitRate(r.business.items.map((x) => x.title)) + (r.business.total ? 0.1 : 0),
    jobs: hitRate(r.jobs.items.map((x) => x.title)) + (r.jobs.total ? 0.1 : 0)
      + (ws.some((w) => JOB_INTENT.test(w)) && r.jobs.items.length ? 1 : 0),
    licenses: r.licenses.items.length ? hitRate(r.licenses.items.map((x) => x.name)) * 0.9 : 0,
    agency: r.agency.items.length ? 0.05 : 0,
    guides: r.guides.length ? 0.04 : 0,
  };
  const base: SectionKey[] = ["welfare", "business", "jobs", "guides", "licenses", "agency"];
  // 같은 점수면 원래 순서. 안내 글은 늘 결과 갈래들 뒤.
  return base.slice().sort((a, b) => score[b] - score[a] || base.indexOf(a) - base.indexOf(b));
}

async function searchJobs(words: string[], sido?: string, sigungu?: string) {
  const empty = { items: [] as JobHit[], total: 0, openOnly: true, allTotal: null as number | null, also: [] as string[] };
  const ws = words.map(safe).filter((w) => w.length >= 2);
  if (!dbConfigured || !ws.length) return empty;
  const today = new Date().toISOString().slice(0, 10);
  let region = regionClause(sido, sigungu);
  // 낱말마다 연관어 묶음. 접수 중 공고는 수백 건이라 OR 가 스물 넷이어도 빠르다.
  const groups = ws.map((w) => Array.from(new Set(expandTerms(w).map(safe).filter((t) => t.length >= 2))));
  const also = Array.from(new Set(groups.flatMap((g) => g.slice(1))));

  const base = (expand: boolean) => {
    let sel = db.from("job_posts").select("source_id,title,org,region,hire,end_date", { count: "exact" })
      .in("source", JOB_SOURCES);
    // 묶음마다 or 를 따로 붙이면 or= 이 여러 번 가서 PostgREST 가 500 을 낸다("수원 경비").
    // 하나의 or=(and(or(…),or(…))) 로 묶는다.
    const parts = groups.map((g) => orClause(expand ? g : g.slice(0, 1)));
    if (region) parts.push(region);
    if (parts.length === 1) sel = sel.or(parts[0]);
    else if (parts.length > 1) sel = sel.or(`and(${parts.map((x) => `or(${x})`).join(",")})`);
    return sel;
  };

  // 접수 중인 것부터. 접수 중 공고는 수백 건이라 어떤 낱말이든 빠르다.
  let open = await base(true).gte("end_date", today).order("end_date", { ascending: true }).limit(PER);
  if (open.error) throw open.error;
  // 시·군·구로 거르면 없을 때가 많다(공고 대부분에 시·군·구가 안 적힘). 그때는 시·도로 넓힌다.
  if (sigungu && sido && !open.count) {
    region = regionClause(sido);
    open = await base(true).gte("end_date", today).order("end_date", { ascending: true }).limit(PER);
    if (open.error) throw open.error;
  }
  const items: JobHit[] = (open.data ?? []).map((r) => ({
    id: String(r.source_id), title: String(r.title ?? ""), org: r.org ?? null, region: r.region ?? null,
    hire: r.hire ?? null, end: r.end_date ?? null, open: true,
  }));

  // 두 글자 낱말은 trigram 색인을 못 타서 22만 건을 훑는다(3초). 그때는
  // 접수 중만 보여 주고 지난 공고는 채용 화면으로 넘긴다. 지난 공고까지 셀
  // 때는 연관어를 넓히지 않는다 — 연관어에는 두 글자가 많다.
  const longEnough = ws.every((w) => w.length >= 3);
  if (!longEnough) return { items, total: open.count ?? items.length, openOnly: true, allTotal: null, also };

  const all = await base(false).limit(items.length ? 0 : PER).order("reg_date", { ascending: false, nullsFirst: false });
  if (all.error) return { items, total: open.count ?? items.length, openOnly: true, allTotal: null, also };
  const closed: JobHit[] = items.length ? [] : (all.data ?? []).map((r) => ({
    id: String(r.source_id), title: String(r.title ?? ""), org: r.org ?? null, region: r.region ?? null,
    hire: r.hire ?? null, end: r.end_date ?? null, open: false,
  }));
  return { items: items.length ? items : closed, total: open.count ?? items.length, openOnly: false, allTotal: all.count ?? null, also };
}

// ── 자격증 ───────────────────────────────────────────
async function searchLicenses(words: string[]): Promise<Section<License>> {
  const ws = words.map(norm).filter((w) => w.length >= 2);
  const href = `/license?q=${encodeURIComponent(words.join(" "))}`;
  if (!ws.length) return { items: [], total: 0, href };
  const board = await getLicenses();
  const byName = (t: string) => board.all.filter((l) => norm(l.name).includes(t));
  const direct = board.all.filter((l) => ws.some((w) => norm(l.name).includes(w)));
  if (direct.length) return { items: direct.slice(0, PER), total: direct.length, href };
  // 종목 이름에 그 말이 없으면 연관어로 한 번 더("경호" → 경비지도사). 다만
  // 종목의 2할 넘게 걸리는 말(기능사·기사)은 찾는 말이 아니라 등급이라 뺀다.
  const cap = board.all.length * 0.2;
  const seen = new Set<string>();
  const near: License[] = [];
  for (const w of ws) for (const t of expandTerms(w).map(norm).slice(1)) {
    const hits = byName(t);
    if (!hits.length || hits.length > cap) continue;
    for (const l of hits) if (!seen.has(l.code)) { seen.add(l.code); near.push(l); }
  }
  return { items: near.slice(0, PER), total: near.length, href };
}

// ── 공공기관 ─────────────────────────────────────────
async function searchAgency(words: string[]): Promise<Section<AlioItem>> {
  const term = words.join(" ").trim();
  const href = `/agency?q=${encodeURIComponent(term)}`;
  if (!term) return { items: [], total: 0, href };
  const items = (await agencyFromStore("business", { q: term })) ?? [];
  return { items: items.slice(0, PER), total: items.length, href };
}

// ── 전체 ─────────────────────────────────────────────
export async function unifiedSearch(raw: string): Promise<SearchResult> {
  const q = raw.trim().slice(0, 80);
  const idx = dbConfigured ? await getSigunguIndex().catch(() => new Map()) : new Map();
  const parsed = parseQuery(q, idx);
  const bits = describe(parsed);
  const words = parsed.keywords.length ? parsed.keywords : tokenize(q);
  const term = words.join(" ");
  const { sido, sigungu, age, employment, household } = parsed;
  const hasCond = Boolean(sido || age || employment || household.length);

  const wq = { sido, sigungu, age, employment, household, q: term || undefined };
  const bq = { sido, q: term || undefined };
  const sp = toParams(parsed); sp.set("via", "search");
  const bsp = new URLSearchParams({ via: "search" });
  if (sido) bsp.set("sido", sido);
  if (term) bsp.set("q", term);

  const empty = <T,>(href: string): Section<T> => ({ items: [], total: 0, href });
  const out: SearchResult = {
    q, parsed, bits, term,
    welfare: empty(`/?${sp}`),
    business: empty(`/business?${bsp}`),
    jobs: { ...empty<JobHit>(jobPath({ q: term, page: 1 })), openOnly: true, allTotal: null, also: [] },
    licenses: empty(`/license?q=${encodeURIComponent(term)}`),
    agency: empty(`/agency?q=${encodeURIComponent(term)}`),
    guides: findGuides(words),
    failed: [],
    related: relatedTerms(words, 10),
    expanded: expansions(words),
    order: ["welfare", "business", "jobs", "guides", "licenses", "agency"],
    mapHref: null,
  };
  if (sido) {
    const sggName = sigungu?.trim().split(/\s+/).pop() ?? null;
    const at = locate(sido, sggName);
    if (at) out.mapHref = `/map?kind=${words.some((w) => JOB_INTENT.test(w)) ? "jobs" : "programs"}&lat=${at.lat.toFixed(4)}&lng=${at.lng.toFixed(4)}`;
  }
  if (!q || !dbConfigured) return out;

  const [w, wn, b, bn, j, l, a, st] = await Promise.allSettled([
    term || hasCond ? matchWelfare(wq, PER) : Promise.resolve([] as Program[]),
    term || hasCond ? countWelfare(wq) : Promise.resolve(0),
    term || sido ? matchBusiness(bq, PER) : Promise.resolve([] as Program[]),
    term || sido ? countBusiness(bq) : Promise.resolve(0),
    searchJobs(words, sido, sigungu),
    searchLicenses(words),
    searchAgency(words),
    searchStories(words),
  ]);

  const take = <T,>(r: PromiseSettledResult<T>, name: string, d: T): T => {
    if (r.status === "fulfilled") return r.value;
    console.warn(`[search] ${name}:`, r.reason instanceof Error ? r.reason.message : r.reason);
    out.failed.push(name);
    return d;
  };
  out.welfare.items = take(w, "복지", []);
  out.welfare.total = take(wn, "복지", out.welfare.items.length);
  out.business.items = take(b, "기업", []);
  out.business.total = take(bn, "기업", out.business.items.length);
  const jobs = take(j, "채용", { items: [], total: 0, openOnly: true, allTotal: null, also: [] });
  out.jobs = { ...out.jobs, ...jobs };
  out.licenses = take(l, "자격증", out.licenses);
  const stories = take(st, "블로그", []);
  out.guides = [
    ...stories.map((x) => ({ href: `/story/${encodeURIComponent(x.slug)}`, title: x.title, desc: x.summary, tag: "블로그" })),
    ...out.guides,
  ].slice(0, PER);
  out.agency = take(a, "공공기관", out.agency);
  // 같은 이름이 두 번 들어갈 수 있다(목록·건수). 하나로.
  out.failed = Array.from(new Set(out.failed));
  out.order = orderSections(words, out);
  return out;
}

export const SEARCH_SUGGEST = ["전세", "신혼부부", "학자금", "출산", "육아", "간호사", "공무직", "기능사", "수출", "창업"];
