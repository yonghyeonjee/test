import { SOURCE_OP, SOURCE_VAL } from "./pubJobs";
import { unstable_cache } from "next/cache";
import { db, dbConfigured } from "./db";
import { haversineKm, locate, locateJob, sggFromDept, type Place } from "./geo";
import { dongInText } from "./dong";
import { keyOf, labelOf, moreOf, toRow, type MapDataLite, type MapKind, type MapPointLite } from "./mapShape";

/**
 * 정책지도에 올릴 점들.
 *
 * 공고에는 주소가 없고 시·도·시·군·구만 있다. 그래서 점은 시·군·구마다 하나 —
 * "시흥시에 지금 접수 중인 사업 23건" 이 한 점이다. 점을 누르면 마감이 가까운
 * 것부터 몇 건 요약으로 보이고, 전부는 그 지역 목록으로 이어진다.
 *
 * 채용은 지역이 시·도까지만 있고 그마저 빈 것이 많아, 기관명·제목에서 시·군·구를
 * 읽는다(lib/geo.ts locateJob). 못 읽으면 시·도 가운데(approx), 그것도 없으면
 * 지도에 못 올리고 건수만 적는다.
 *
 * 시·군·구가 비어 시·도 전역으로 잡히던 공고는 담당 부서 이름("전북특별자치도 군산시
 * 복지환경국…")에서 시·군·구를 보충한다(lib/geo.ts sggFromDept).
 *
 * 동네 단계(읍·면·동)에는 공고를 꽂지 않는다 — 주소가 없다. 제목·부서·기관 이름에 그
 * 시·군·구의 동 이름이 분명히 적힌 공고만 따로 모아(dongs) 동 핀의 건수로 보인다.
 * 그런 공고도 시·군·구 핀에는 그대로 들어 있다.
 *
 * 한 시간마다 다시 센다. 공고는 하루 단위로 바뀐다.
 */
export type MapItem = {
  id: string;
  /** 제목. 길면 자른다. */
  t: string;
  org: string | null;
  start: string | null;
  end: string | null;
  always: boolean;
  kind: "welfare" | "business" | "job";
};

/**
 * 캐시에 담는 공고 한 줄. 지도에 오른 공고 전부(5천여 건)를 들고 있어야 왼쪽 카드
 * 목록을 거를 수 있는데, 객체로 두면 Next 데이터 캐시 한 칸(2MB)을 넘길 수 있어
 * 짧은 배열로 둔다: [번호, 제목, 기관, 접수 시작, 마감, 상시(1), 갈래(w|b|j)]
 */
export type ItemRow = [string, string, string | null, string | null, string | null, 0 | 1, "w" | "b" | "j"];

const KIND_OF = { w: "welfare", b: "business", j: "job" } as const;
export const toItem = (r: ItemRow): MapItem =>
  ({ id: r[0], t: r[1], org: r[2], start: r[3], end: r[4], always: r[5] === 1, kind: KIND_OF[r[6]] });

/** 핀 하나 + 그 자리의 공고 전부(마감 가까운 순). 쪽에는 공고를 빼고 싣는다. */
export type MapPoint = MapPointLite & { items: ItemRow[] };

export type MapData = {
  programs: MapPoint[];
  jobs: MapPoint[];
  /** 동 이름이 분명히 적힌 공고. 열쇠는 lib/dong.ts dongKey. */
  dongs: { programs: Record<string, ItemRow[]>; jobs: Record<string, ItemRow[]> };
  /** 지도에 못 올린 것: 전국 공통 사업, 지역을 모르는 채용. */
  nationwide: number;
  jobsNoPlace: number;
  at: string;
};

export type { MapDataLite, MapPointLite };

export const EMPTY_MAP: MapData = { programs: [], jobs: [], dongs: { programs: {}, jobs: {} }, nationwide: 0, jobsNoPlace: 0, at: "" };

/** 쪽에 싣는 모양 — 요약(items)을 빼고 짧은 배열로(lib/mapShape). 요약은 /api/map/items 가 준다. */
export function liteOf(d: MapData): MapDataLite {
  return { p: d.programs.map((x) => toRow("programs", x)), j: d.jobs.map((x) => toRow("jobs", x)),
           nationwide: d.nationwide, jobsNoPlace: d.jobsNoPlace, at: d.at };
}

const cut = (s: string, n = 44) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
/** "과학기술정보통신부 우정사업본부 경인지방우정청 양평우체국" → "경인지방우정청 양평우체국" */
const orgShort = (org: string | null) => {
  if (!org) return null;
  const t = org.trim().split(/\s+/);
  return cut(t.length >= 3 ? t.slice(-2).join(" ") : org, 22);
};

function add(map: Map<string, MapPoint>, place: Place, item: ItemRow, more: string) {
  const key = keyOf(place.sido, place.sigungu);
  let p = map.get(key);
  if (!p) {
    p = { key, sido: place.sido, sigungu: place.sigungu, label: labelOf(place.sido, place.sigungu), lat: place.lat, lng: place.lng,
          approx: place.approx, n: 0, nW: 0, nB: 0, items: [], more };
    map.set(key, p);
  }
  p.n++;
  if (item[6] === "w") p.nW++;
  if (item[6] === "b") p.nB++;
  p.items.push(item);
}

function addDong(index: Record<string, ItemRow[]>, place: Place, item: ItemRow, ...texts: (string | null)[]) {
  if (!place.sigungu) return;
  const d = dongInText(place.sido, place.sigungu, ...texts);
  if (d) (index[d.key] ??= []).push(item);
}

async function loadPrograms() {
  const points = new Map<string, MapPoint>();
  const dongs: Record<string, ItemRow[]> = {};
  let nationwide = 0;
  const PAGE = 1000;
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await db
      .from("programs_public")
      .select("source_id,title,kind,org_name,dept_name,sido,sigungu,apply_start,apply_end,is_always_on")
      .neq("status", "closed")
      // 마감이 가까운 것부터 — 점마다 앞 몇 건만 담으므로 차례가 곧 요약의 질이다.
      .order("apply_end", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as {
      source_id: string; title: string; kind: string; org_name: string | null; dept_name: string | null; sido: string | null;
      sigungu: string | null; apply_start: string | null; apply_end: string | null; is_always_on: boolean | null;
    }[];
    for (const r of rows) {
      // 시·군·구가 비었으면 담당 부서·기관 이름에서 보충한다.
      const sgg = r.sigungu || sggFromDept(r.sido, r.dept_name, r.org_name);
      const place = locate(r.sido, sgg);
      if (!place) { nationwide++; continue; }
      const more = moreOf("programs", place.sido, place.sigungu);
      const item: ItemRow = [r.source_id, cut(r.title), orgShort(r.org_name), r.apply_start, r.apply_end,
                             r.is_always_on ? 1 : 0, r.kind === "business" ? "b" : "w"];
      add(points, place, item, more);
      addDong(dongs, place, item, r.title, r.dept_name);
    }
    if (rows.length < PAGE) break;
  }
  return { points: [...points.values()], nationwide, dongs };
}

async function loadJobs() {
  const points = new Map<string, MapPoint>();
  const dongs: Record<string, ItemRow[]> = {};
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("job_posts")
    .select("source_id,title,org,region,start_date,end_date")
    .filter("source", SOURCE_OP, SOURCE_VAL)
    .gte("end_date", today)
    .order("end_date", { ascending: true })
    .limit(3000);
  if (error) throw error;
  let noPlace = 0;
  for (const r of (data ?? []) as { source_id: string; title: string; org: string | null; region: string | null; start_date: string | null; end_date: string | null }[]) {
    const place = locateJob({ org: r.org, title: r.title, region: r.region });
    if (!place) { noPlace++; continue; }
    const more = moreOf("jobs", place.sido, place.sigungu);
    const item: ItemRow = [r.source_id, cut(r.title, 52), orgShort(r.org), r.start_date, r.end_date, 0, "j"];
    add(points, place, item, more);
    addDong(dongs, place, item, r.org, r.title);
  }
  return { points: [...points.values()], noPlace, dongs };
}

async function load(): Promise<MapData> {
  if (!dbConfigured) return EMPTY_MAP;
  const [p, j] = await Promise.all([loadPrograms(), loadJobs()]);
  const byN = (a: MapPoint, b: MapPoint) => b.n - a.n;
  return {
    programs: p.points.sort(byN),
    jobs: j.points.sort(byN),
    dongs: { programs: p.dongs, jobs: j.dongs },
    nationwide: p.nationwide,
    jobsNoPlace: j.noPlace,
    at: new Date().toISOString(),
  };
}

export const getMapData = unstable_cache(load, ["map-data-v3"], { revalidate: 3600 });

// ── 왼쪽 카드 목록 ─────────────────────────────────────────

export type ListItem = MapItem & { key: string; label: string };
export type ListQuery = {
  /** 이 자리 하나의 공고만(지도에서 핀을 누른 때). */
  region?: string;
  /** 이 점에서 r km 안(r=0 이면 전국)을 가까운 순으로. 자리 이름을 주소에 늘어놓으면 주소가 16KB 를 넘었다. */
  near?: { lat: number; lng: number; r: number };
  /**
   * 내가 있는 시·군·구 열쇠("경기도|시흥시"). 시·군·구 핀은 구역 가운데라 반경을 작게(3km)
   * 잡으면 내 시·군·구가 빠질 수 있다. 내 시·군·구와 그 시·도 전역 공고는 늘 넣고 맨 앞에 둔다.
   */
  home?: string;
  /** soon: 7일 안 마감, always: 상시 */
  status?: "all" | "soon" | "always";
  /** near: 가까운 자리부터(자리 안에서는 마감 가까운 순), end: 마감 가까운 순 */
  sort?: "near" | "end";
  offset?: number;
  limit?: number;
};

/** 한국 시각 오늘(YYYY-MM-DD). */
export const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const plusDays = (ymd: string, n: number) => {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function listItems(d: MapData, kind: MapKind, q: ListQuery = {}): { total: number; items: ListItem[] } {
  const pts = kind === "jobs" ? d.jobs : d.programs;
  let chosen: MapPoint[] = pts;
  if (q.region) chosen = pts.filter((p) => p.key === q.region);
  else if (q.near) {
    const { lat, lng, r } = q.near;
    const homeSido = q.home ? `${q.home.split("|")[0]}|` : null;
    const mine = (key: string) => key === q.home || key === homeSido;
    chosen = pts.map((p) => ({ p, km: haversineKm([lat, lng], [p.lat, p.lng]) }))
      .filter((x) => !r || x.km <= r || mine(x.p.key))
      .sort((a, b) => (mine(b.p.key) ? 1 : 0) - (mine(a.p.key) ? 1 : 0) || (a.p.key === q.home ? -1 : b.p.key === q.home ? 1 : 0) || a.km - b.km)
      .map((x) => x.p);
  }
  let out: ListItem[] = [];
  for (const p of chosen) for (const r of p.items) out.push({ ...toItem(r), key: p.key, label: p.label });
  const today = kstToday();
  if (q.status === "soon") {
    const until = plusDays(today, 7);
    out = out.filter((x) => !x.always && !!x.end && x.end >= today && x.end <= until);
  } else if (q.status === "always") {
    out = out.filter((x) => x.always || !x.end);
  }
  // 마감 있는 것을 가까운 마감부터, 상시는 뒤로. 가까운 순은 자리 차례(이미 거리순)를 먼저 지킨다.
  const endKey = (x: ListItem) => (x.always || !x.end ? "9999" : x.end);
  if (q.sort !== "near" || (!q.near && !q.region)) {
    out.sort((a, b) => endKey(a).localeCompare(endKey(b)));
  } else {
    const order = new Map(chosen.map((p, i) => [p.key, i]));
    out.sort((a, b) => (order.get(a.key)! - order.get(b.key)!) || endKey(a).localeCompare(endKey(b)));
  }
  const offset = Math.max(0, q.offset ?? 0);
  const limit = Math.min(60, Math.max(1, q.limit ?? 30));
  return { total: out.length, items: out.slice(offset, offset + limit) };
}
