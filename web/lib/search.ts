import { agencyFromStore } from "./agencyStore";
import type { AlioItem } from "./alioplus";
import {
  countBusiness, countWelfare, db, dbConfigured, getSigunguIndex,
  matchBusiness, matchWelfare, type Program,
} from "./db";
import { FREE_GROUPS } from "./freeServices";
import { jobPath } from "./jobRoute";
import { tokenize } from "./keywords";
import { describe, parseQuery, toParams, type Parsed } from "./parse";
import { POSTS } from "./posts";
import { getLicenses, type License } from "./qnet";
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
  jobs: Section<JobHit> & { openOnly: boolean; allTotal: number | null };
  licenses: Section<License>;
  agency: Section<AlioItem>;
  guides: GuideHit[];
  /** 읽지 못한 갈래. 화면에 "지금은 못 읽었다"고 적는다. */
  failed: string[];
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
  return PAGES
    .map((p) => {
      const hay = [p.title, ...p.keys].map(norm);
      const score = ws.filter((w) => hay.some((h) => h.includes(w))).length;
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

async function searchJobs(words: string[], sido?: string) {
  const empty = { items: [] as JobHit[], total: 0, openOnly: true, allTotal: null as number | null };
  const ws = words.map(safe).filter((w) => w.length >= 2);
  if (!dbConfigured || !ws.length) return empty;
  const today = new Date().toISOString().slice(0, 10);
  const region = sido?.replace(/(특별자치도|특별자치시|광역시|특별시)$/, "");

  const base = () => {
    let sel = db.from("job_posts").select("source_id,title,org,region,hire,end_date", { count: "exact" })
      .eq("source", "gojobs");
    for (const w of ws) sel = sel.or(`title.ilike.%${w}%,org.ilike.%${w}%`);
    if (region) sel = sel.ilike("region", `%${region}%`);
    return sel;
  };

  // 접수 중인 것부터. 접수 중 공고는 수백 건이라 어떤 낱말이든 빠르다.
  const open = await base().gte("end_date", today).order("end_date", { ascending: true }).limit(PER);
  if (open.error) throw open.error;
  const items: JobHit[] = (open.data ?? []).map((r) => ({
    id: String(r.source_id), title: String(r.title ?? ""), org: r.org ?? null, region: r.region ?? null,
    hire: r.hire ?? null, end: r.end_date ?? null, open: true,
  }));

  // 두 글자 낱말은 trigram 색인을 못 타서 22만 건을 훑는다(3초). 그때는
  // 접수 중만 보여 주고 지난 공고는 채용 화면으로 넘긴다.
  const longEnough = ws.every((w) => w.length >= 3);
  if (!longEnough) return { items, total: open.count ?? items.length, openOnly: true, allTotal: null };

  const all = await base().limit(items.length ? 0 : PER).order("reg_date", { ascending: false, nullsFirst: false });
  if (all.error) return { items, total: open.count ?? items.length, openOnly: true, allTotal: null };
  const closed: JobHit[] = items.length ? [] : (all.data ?? []).map((r) => ({
    id: String(r.source_id), title: String(r.title ?? ""), org: r.org ?? null, region: r.region ?? null,
    hire: r.hire ?? null, end: r.end_date ?? null, open: false,
  }));
  return { items: items.length ? items : closed, total: open.count ?? items.length, openOnly: false, allTotal: all.count ?? null };
}

// ── 자격증 ───────────────────────────────────────────
async function searchLicenses(words: string[]): Promise<Section<License>> {
  const ws = words.map(norm).filter((w) => w.length >= 2);
  const href = `/license?q=${encodeURIComponent(words.join(" "))}`;
  if (!ws.length) return { items: [], total: 0, href };
  const board = await getLicenses();
  const hits = board.all.filter((l) => ws.some((w) => norm(l.name).includes(w)));
  return { items: hits.slice(0, PER), total: hits.length, href };
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
  const bsp = new URLSearchParams({ tab: "business", via: "search" });
  if (sido) bsp.set("sido", sido);
  if (term) bsp.set("q", term);

  const empty = <T,>(href: string): Section<T> => ({ items: [], total: 0, href });
  const out: SearchResult = {
    q, parsed, bits, term,
    welfare: empty(`/?${sp}`),
    business: empty(`/?${bsp}`),
    jobs: { ...empty<JobHit>(jobPath({ q: term, page: 1 })), openOnly: true, allTotal: null },
    licenses: empty(`/license?q=${encodeURIComponent(term)}`),
    agency: empty(`/agency?q=${encodeURIComponent(term)}`),
    guides: findGuides(words),
    failed: [],
  };
  if (!q || !dbConfigured) return out;

  const [w, wn, b, bn, j, l, a] = await Promise.allSettled([
    term || hasCond ? matchWelfare(wq, PER) : Promise.resolve([] as Program[]),
    term || hasCond ? countWelfare(wq) : Promise.resolve(0),
    term || sido ? matchBusiness(bq, PER) : Promise.resolve([] as Program[]),
    term || sido ? countBusiness(bq) : Promise.resolve(0),
    searchJobs(words, sido),
    searchLicenses(words),
    searchAgency(words),
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
  const jobs = take(j, "채용", { items: [], total: 0, openOnly: true, allTotal: null });
  out.jobs = { ...out.jobs, ...jobs };
  out.licenses = take(l, "자격증", out.licenses);
  out.agency = take(a, "공공기관", out.agency);
  // 같은 이름이 두 번 들어갈 수 있다(목록·건수). 하나로.
  out.failed = Array.from(new Set(out.failed));
  return out;
}

export const SEARCH_SUGGEST = ["전세", "신혼부부", "학자금", "출산", "육아", "간호사", "공무직", "기능사", "수출", "창업"];
