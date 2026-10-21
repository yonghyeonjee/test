import { unstable_cache } from "next/cache";
import { db, dbConfigured } from "./db";
import { SIDO_SHORT } from "./geo";
import { GOV_OFFICES, type GovOfficeRow } from "./govOfficeData";
import { readAll } from "./pubJobs";

/**
 * 관공서와 공공기관(2026-10-21).
 *
 *  - 공공기관(public_orgs): 잡알리오 "공공기관 정보" 342곳 — 기관유형·주무기관·소재지·좌표(pipeline/public_orgs.py).
 *  - 정부/지자체 누리집(gov_sites): 정부24 목록(pipeline/gov_sites.py). 지자체는 시·도·시·군·구가 붙어 있다.
 *  - 시·군·구청 청사(GOV_OFFICES): 주소와 좌표를 코드에 싣는다(lib/govOfficeData.ts) — 277곳, DB 를 거치지 않는다.
 *  - 지역 인구(region_stats): KOSIS 주민등록인구(pipeline/kosis_stats.py).
 * 지도와 지역 쪽, 공공기관 목록·상세가 쓴다. DB 를 못 읽으면 빈 목록 — 쪽은 산다.
 */
export type PublicOrg = {
  id: string;
  name: string;
  ministry: string | null;
  kind: string | null;
  homepage: string | null;
  address: string | null;
  sido: string | null;
  sigungu: string | null;
  lat: number | null;
  lng: number | null;
  /** 기관소개(잡알리오). 상세·공고 쪽의 "어떤 곳인가" 카드에 쓴다(2026-10-21). */
  intro: string | null;
};
export type PublicOrgFull = PublicOrg & {
  intro: string | null; basis: string | null; roles: string | null; history: string | null; goals: string | null;
  head: string | null; geo_src: string | null; fetched_at: string | null;
};
export type GovSite = { name: string; url: string; grp: string | null; sido: string | null; sigungu: string | null };
export type RegionStat = { code: string; name: string; sido: string | null; sigungu: string | null; level: number; pop: number | null; prd: string | null };
export type GovOffice = {
  name: string; sido: string; sgg: string; gu: string; zip: string; address: string; kind: string; lat: number; lng: number;
  /** 지도 열쇠. office|시·도|시·군·구|이름 — 정책지도의 청사 핀과 같은 꼴. */
  key: string;
};

const LITE = "id,name,ministry,kind,homepage,address,sido,sigungu,lat,lng,intro";

/** 기관유형의 큰 갈래. "준정부기관(위탁집행형)" → 준정부기관. */
export function orgGroup(kind: string | null): "공기업" | "준정부기관" | "기타공공기관" | "기타" {
  const k = kind ?? "";
  if (k.startsWith("공기업")) return "공기업";
  if (k.startsWith("준정부")) return "준정부기관";
  if (k.startsWith("기타")) return "기타공공기관";
  return "기타";
}
export const ORG_GROUPS = ["공기업", "준정부기관", "기타공공기관"] as const;

async function loadOrgs(): Promise<PublicOrg[]> {
  if (!dbConfigured) return [];
  const rows = await readAll<PublicOrg>((from, to) => db.from("public_orgs").select(LITE).order("name").range(from, to), 2000);
  return rows;
}
/** 공공기관 전부(가벼운 칸만). 여섯 시간 캐시 — 주 1회 받는 자료다. */
export const getPublicOrgs = unstable_cache(loadOrgs, ["public-orgs-v2"], { revalidate: 21600 });

/** 이름 비교용. "(재)", 빈칸, 괄호·점을 걷는다. */
const normName = (s: string) => s.replace(/^\((사|재|주|특|학)\)\s*/, "").replace(/[\s()·,.]/g, "");

/**
 * 공고·사업의 기관 이름에 맞는 공공기관(2026-10-21). 같은 이름이면 그것, 아니면 공고 기관 이름 안에 든 가장 긴
 * 공공기관 이름("국립공원공단 지리산사무소" → 국립공원공단). 네 글자 미만은 들어 있어도 안 본다 — 짧은 이름은 잘 겹친다.
 */
export function matchPublicOrg(orgs: PublicOrg[], name: string | null | undefined): PublicOrg | null {
  if (!name) return null;
  const n = normName(name);
  if (n.length < 2) return null;
  let best: PublicOrg | null = null;
  let bestLen = 0;
  for (const o of orgs) {
    const on = normName(o.name);
    if (on === n) return o;
    if (on.length >= 4 && on.length > bestLen && n.includes(on)) { best = o; bestLen = on.length; }
  }
  return best;
}
export async function findPublicOrg(name: string | null | undefined): Promise<PublicOrg | null> {
  if (!name) return null;
  return matchPublicOrg(await getPublicOrgs().catch(() => [] as PublicOrg[]), name);
}

/** 상세 쪽 전용. DB 오류는 던진다(없는 것만 null) — 404 가 굳지 않게. */
export async function getPublicOrgStrict(id: string): Promise<PublicOrgFull | null> {
  if (!dbConfigured) return null;
  const { data, error } = await db.from("public_orgs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`[public_orgs ${id}] ${error.message}`);
  return (data as PublicOrgFull | null) ?? null;
}

async function loadSites(): Promise<GovSite[]> {
  if (!dbConfigured) return [];
  return readAll<GovSite>((from, to) => db.from("gov_sites").select("name,url,grp,sido,sigungu").order("name").range(from, to), 3000);
}
export const getGovSites = unstable_cache(loadSites, ["gov-sites-v1"], { revalidate: 21600 });

async function loadStats(): Promise<RegionStat[]> {
  if (!dbConfigured) return [];
  return readAll<RegionStat>((from, to) => db.from("region_stats").select("code,name,sido,sigungu,level,pop,prd").order("code").range(from, to), 1000);
}
export const getRegionStats = unstable_cache(loadStats, ["region-stats-v1"], { revalidate: 86400 });

const toOffice = (r: GovOfficeRow): GovOffice => ({
  name: r[0], sido: r[1], sgg: r[2], gu: r[3], zip: r[4], address: r[5], kind: r[6], lat: r[7], lng: r[8],
  key: `office|${r[1]}|${r[2]}|${r[0]}`,
});
let officeCache: GovOffice[] | null = null;
/** 시·군·구청 청사 전부(좌표 있는 것만). */
export function govOffices(): GovOffice[] {
  if (!officeCache) officeCache = GOV_OFFICES.map(toOffice).filter((o) => o.lat > 0 && o.lng > 0);
  return officeCache;
}
/** 그 시·도(와 시·군·구)의 청사. 시·도청이 먼저, 그다음 가나다. */
export function officesOf(sido: string, sgg?: string | null): GovOffice[] {
  return govOffices()
    .filter((o) => o.sido === sido && (!sgg || o.sgg === sgg))
    .sort((a, b) => (a.kind === "시·도청" ? -1 : b.kind === "시·도청" ? 1 : 0) || a.name.localeCompare(b.name, "ko"));
}

/** 시·군·구 누리집. "경기도 시흥시" 처럼 시·도·시·군·구가 읽힌 것 가운데 그 자리 것. */
export function siteOf(sites: GovSite[], sido: string, sgg: string | null): GovSite | null {
  const hit = sites.find((s) => s.sido === sido && (sgg ? s.sigungu === sgg : !s.sigungu));
  if (hit) return hit;
  // 시·도가 비어 있는 것("시흥시청")은 시·군·구 이름만으로 — 같은 이름의 시·군·구(중구·남구)는 시·도가 있는 것만 믿는다.
  if (sgg && !/^(중구|동구|서구|남구|북구)$/.test(sgg)) return sites.find((s) => !s.sido && s.sigungu === sgg) ?? null;
  return null;
}

/** 사람이 읽는 인구. 9,279,861 → "928만 명", 135,842 → "13.6만 명", 8,500 → "8,500명". */
export function fmtPop(n: number | null | undefined): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${Math.round(n / 10_000).toLocaleString("ko-KR")}만 명`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만 명`;
  return `${n.toLocaleString("ko-KR")}명`;
}
/** "202609" → "2026년 9월". */
export const fmtPrd = (p: string | null | undefined) => (p && p.length >= 6 ? `${p.slice(0, 4)}년 ${Number(p.slice(4, 6))}월` : "");

export const sidoShort = (s: string | null) => (s ? SIDO_SHORT[s] ?? s : "");
