import { unstable_cache } from "next/cache";
import { db, dbConfigured } from "./db";
import { locate, locateJob, type Place } from "./geo";

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
 * 한 시간마다 다시 센다. 공고는 하루 단위로 바뀐다.
 */
export type MapItem = {
  id: string;
  /** 제목. 길면 자른다 — 점마다 몇 건씩 230개 점이면 쪽이 무거워진다. */
  t: string;
  org: string | null;
  start: string | null;
  end: string | null;
  always: boolean;
  kind: "welfare" | "business" | "job";
};

export type MapPoint = {
  key: string;
  sido: string;
  sigungu: string | null;
  label: string;
  lat: number;
  lng: number;
  approx: boolean;
  n: number;
  /** 복지·기업 건수(지원사업 점에서만). */
  nW: number;
  nB: number;
  items: MapItem[];
  /** 전부 보는 곳. */
  more: string;
};

export type MapData = {
  programs: MapPoint[];
  jobs: MapPoint[];
  /** 지도에 못 올린 것: 전국 공통 사업, 지역을 모르는 채용. */
  nationwide: number;
  jobsNoPlace: number;
  at: string;
};

/** 쪽에 싣는 모양 — 요약(items)을 뺀 점. 요약은 /api/map/items 가 준다. */
export type MapPointLite = Omit<MapPoint, "items">;
export type MapDataLite = Omit<MapData, "programs" | "jobs"> & { programs: MapPointLite[]; jobs: MapPointLite[] };

export const EMPTY_MAP: MapData = { programs: [], jobs: [], nationwide: 0, jobsNoPlace: 0, at: "" };

export function liteOf(d: MapData): MapDataLite {
  const strip = (p: MapPoint): MapPointLite => { const { items: _items, ...rest } = p; return rest; };
  return { ...d, programs: d.programs.map(strip), jobs: d.jobs.map(strip) };
}

const TOP = 6;
const cut = (s: string, n = 48) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function add(map: Map<string, MapPoint>, place: Place, item: MapItem, more: string) {
  const key = `${place.sido}|${place.sigungu ?? ""}`;
  let p = map.get(key);
  if (!p) {
    p = { key, sido: place.sido, sigungu: place.sigungu, label: place.label, lat: place.lat, lng: place.lng,
          approx: place.approx, n: 0, nW: 0, nB: 0, items: [], more };
    map.set(key, p);
  }
  p.n++;
  if (item.kind === "welfare") p.nW++;
  if (item.kind === "business") p.nB++;
  if (p.items.length < TOP) p.items.push(item);
}

async function loadPrograms() {
  const points = new Map<string, MapPoint>();
  let nationwide = 0;
  const PAGE = 1000;
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await db
      .from("programs_public")
      .select("source_id,title,kind,org_name,sido,sigungu,apply_start,apply_end,is_always_on")
      .neq("status", "closed")
      // 마감이 가까운 것부터 — 점마다 앞 몇 건만 담으므로 차례가 곧 요약의 질이다.
      .order("apply_end", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as {
      source_id: string; title: string; kind: string; org_name: string | null; sido: string | null;
      sigungu: string | null; apply_start: string | null; apply_end: string | null; is_always_on: boolean | null;
    }[];
    for (const r of rows) {
      const place = locate(r.sido, r.sigungu);
      if (!place) { nationwide++; continue; }
      const kind = r.kind === "business" ? "business" : "welfare";
      const more = place.sigungu
        ? `/?sido=${encodeURIComponent(place.sido)}&sigungu=${encodeURIComponent(place.sigungu)}&via=map`
        : `/area/${encodeURIComponent(place.sido)}`;
      add(points, place, {
        id: r.source_id, t: cut(r.title), org: r.org_name, start: r.apply_start, end: r.apply_end,
        always: Boolean(r.is_always_on), kind,
      }, more);
    }
    if (rows.length < PAGE) break;
  }
  return { points: [...points.values()], nationwide };
}

async function loadJobs() {
  const points = new Map<string, MapPoint>();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("job_posts")
    .select("source_id,title,org,region,start_date,end_date")
    .eq("source", "gojobs")
    .gte("end_date", today)
    .order("end_date", { ascending: true })
    .limit(3000);
  if (error) throw error;
  let noPlace = 0;
  for (const r of (data ?? []) as { source_id: string; title: string; org: string | null; region: string | null; start_date: string | null; end_date: string | null }[]) {
    const place = locateJob({ org: r.org, title: r.title, region: r.region });
    if (!place) { noPlace++; continue; }
    const more = place.sigungu
      ? `/jobs/q/${encodeURIComponent(place.sigungu)}`
      : r.region ? `/jobs/region/${encodeURIComponent(r.region)}` : "/jobs";
    add(points, place, {
      id: r.source_id, t: cut(r.title, 56), org: r.org, start: r.start_date, end: r.end_date, always: false, kind: "job",
    }, more);
  }
  return { points: [...points.values()], noPlace };
}

async function load(): Promise<MapData> {
  if (!dbConfigured) return EMPTY_MAP;
  const [p, j] = await Promise.all([loadPrograms(), loadJobs()]);
  const byN = (a: MapPoint, b: MapPoint) => b.n - a.n;
  return {
    programs: p.points.sort(byN),
    jobs: j.points.sort(byN),
    nationwide: p.nationwide,
    jobsNoPlace: j.noPlace,
    at: new Date().toISOString(),
  };
}

export const getMapData = unstable_cache(load, ["map-data-v1"], { revalidate: 3600 });
