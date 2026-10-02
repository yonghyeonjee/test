import { POSTS } from "./posts";
import { HOT_BUSINESS, HOT_WELFARE } from "./thesaurus";
import { TOPICS } from "./topics";

/**
 * 검색창 아래 "많이 찾는 말". 사람이 적어 둔 목록이 아니라 기록에서 센다.
 *
 * 무엇을 세나 — 지난 7일(모자라면 30일)의
 *  - visit_log.term: 다음·네이버·구글에서 치고 들어온 검색어. "한국농어촌공사 채용" 처럼
 *    기관명이 대부분이라 뒤의 "채용·채용공고·홈페이지"는 뗀다. 가중치 3.
 *  - visit_log.landing: 처음 연 쪽. /jobs/org/<기관>, /jobs/q/<낱말>, /search?q=, /topic/<분야>,
 *    /blog/<글> 을 말로 바꾼다. 가중치 1~2. 공고 하나(/p/…, /jobs/<번호>)는 제목이 길어 뺀다.
 *  - search_log: 사람이 고른 조건(가구 저소득·장애인·다자녀, 기업 분야 창업·수출). 정책 전체
 *    쪽 링크 클릭(entry=policies)은 둘러보기라 빼고 form·chip·text·top 만. 가중치 1.
 * 두 번 넘게 나온 말만 쓰고, 모자라면 적어 둔 기본 말로 채운다. 하루에 한 번 다시 센다.
 *
 * 원문 입력은 어디에도 저장하지 않는다 — 여기 쓰는 것은 이미 통계용으로 잘라 둔 유입
 * 검색어와 조건값뿐이고, 화면에는 둘 이상이 찾은 말만 올린다.
 */
export type LogRows = {
  visits: { term: string | null; landing: string | null }[];
  searches: { kind: string | null; household: string[] | null; employment: string | null; biz_field: string[] | null; biz_target: string | null; entry: string | null }[];
};

const STRIP = /(채용\s*공고|채용\s*정보|채용|공고|홈페이지|사이트|누리집|바로가기|신청|조회|확인)\s*$/;
const BAD = /나라지원|admin|http|@|\d{3,}|[a-z]{4,}/i;
const BIZ_WORDS = /창업|수출|소상공인|중소기업|스마트공장|인건비|폐업|특허|판로|바우처|사업자|기업|공장|점포|자영업/;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** 검색어 한 줄 → 칩에 올릴 말. 못 쓰면 null. */
export function termLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let t = clean(raw);
  if (!t) return null;
  for (let i = 0; i < 2; i++) t = clean(t.replace(STRIP, ""));
  if (t.length < 2 || t.length > 12 || BAD.test(t)) return null;
  return t;
}

/** "과학기술정보통신부 우정사업본부 경인지방우정청" → "경인지방우정청". 긴 기관명은 끝 말만. */
export function orgLabel(org: string): string | null {
  const toks = clean(org).split(" ").filter(Boolean);
  if (!toks.length) return null;
  const last = toks[toks.length - 1];
  const label = last.length >= 4 || toks.length === 1 ? last : toks.slice(-2).join(" ");
  return label.length >= 2 && label.length <= 12 && !BAD.test(label) ? label : null;
}

const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/** 착지 주소 → 말. */
export function landingLabel(landing: string | null | undefined): { label: string; w: number } | null {
  if (!landing) return null;
  const [path, qs] = landing.split("?");
  const seg = path.split("/").filter(Boolean).map(dec);
  if (qs && /^\/(search|business\/search)$/.test(path)) {
    const q = new URLSearchParams(qs).get("q");
    const l = termLabel(q);
    return l ? { label: l, w: 2 } : null;
  }
  if (seg[0] === "jobs" && seg[1] === "q" && seg[2]) { const l = termLabel(seg[2]); return l ? { label: l, w: 2 } : null; }
  if (seg[0] === "jobs" && seg[1] === "org" && seg[2]) { const l = orgLabel(seg[2]); return l ? { label: l, w: 1 } : null; }
  if (seg[0] === "topic" && seg[1]) { const t = TOPICS.find((x) => x.slug === seg[1]); return t ? { label: t.name, w: 1 } : null; }
  if (seg[0] === "blog" && seg[1]) {
    const p = POSTS.find((x) => x.slug === seg[1]);
    const k = p?.keywords?.find((x) => x.length >= 2 && x.length <= 12);
    return k ? { label: k, w: 1 } : null;
  }
  return null;
}

/** 기록을 세어 두 목록으로. 순수 함수 — 시험이 바로 부른다. */
export function rankHot(rows: LogRows, fallback = { welfare: HOT_WELFARE, business: HOT_BUSINESS }, n = 10) {
  const score = new Map<string, { label: string; s: number; c: number; biz: boolean }>();
  const add = (label: string | null, w: number, biz = false) => {
    if (!label) return;
    const key = label.replace(/\s+/g, "").toLowerCase();
    const cur = score.get(key) ?? { label, s: 0, c: 0, biz: biz || BIZ_WORDS.test(label) };
    cur.s += w; cur.c += 1;
    if (biz) cur.biz = true;
    score.set(key, cur);
  };
  for (const v of rows.visits) {
    add(termLabel(v.term), 3);
    const l = landingLabel(v.landing);
    if (l) add(l.label, l.w, l.label !== null && /^\/business/.test(v.landing ?? ""));
  }
  for (const s of rows.searches) {
    if (s.entry === "policies") continue;
    if (s.kind === "business") {
      for (const f of s.biz_field ?? []) add(f, 1, true);
      if (s.biz_target) add(s.biz_target, 1, true);
    } else {
      for (const h of s.household ?? []) add(h, 1);
    }
  }
  // 한 사람이 한 번 친 말은 올리지 않는다 — 둘 이상이 찾은 말만.
  const sorted = [...score.values()].filter((x) => x.c >= 2).sort((a, b) => b.s - a.s || a.label.localeCompare(b.label, "ko"));
  const pick = (biz: boolean) => {
    const out = sorted.filter((x) => x.biz === biz).map((x) => x.label);
    const base = biz ? fallback.business : fallback.welfare;
    for (const b of base) if (out.length < n && !out.some((o) => o.replace(/\s+/g, "") === b.replace(/\s+/g, ""))) out.push(b);
    return out.slice(0, n);
  };
  return { welfare: pick(false), business: pick(true), fromLog: sorted.length > 0 };
}
