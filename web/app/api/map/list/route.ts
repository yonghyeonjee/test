import { NextResponse } from "next/server";
import { getMapData, listItems } from "@/lib/mapData";

/**
 * 정책지도 왼쪽 카드 목록. 내 위치(반경)나 고른 자리 하나의 공고를 상태로 거르고 쪽으로 나눠 준다.
 *   /api/map/list?kind=programs&lat=37.38&lng=126.80&r=30&status=soon&sort=near&offset=0&limit=30
 *   /api/map/list?kind=programs&region=경기도|시흥시
 *   home=경기도|시흥시 — 내 시·군·구(와 그 시·도 전역)는 반경 밖이어도 맨 앞에(lib/mapData listItems)
 * 자료는 getMapData 와 같은 한 시간 캐시다.
 */
export const revalidate = 3600;

const num = (v: string | null) => (v === null || v === "" ? NaN : Number(v));

export async function GET(req: Request) {
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind") === "jobs" ? "jobs" : "programs";
  const region = (u.searchParams.get("region") ?? "").slice(0, 80) || undefined;
  const home = (u.searchParams.get("home") ?? "").slice(0, 80) || undefined;
  const lat = num(u.searchParams.get("lat")), lng = num(u.searchParams.get("lng")), r = num(u.searchParams.get("r"));
  const near = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng, r: Number.isFinite(r) ? Math.min(Math.max(r, 0), 500) : 30 } : undefined;
  const st = u.searchParams.get("status");
  const status = st === "soon" || st === "always" ? st : "all";
  const sort = u.searchParams.get("sort") === "near" ? "near" : "end";
  const offset = Number(u.searchParams.get("offset") ?? 0) || 0;
  const limit = Number(u.searchParams.get("limit") ?? 30) || 30;
  const data = await getMapData().catch(() => null);
  const res = data ? listItems(data, kind, { region, near, home, status, sort, offset, limit }) : { total: 0, items: [] };
  return NextResponse.json(res, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=86400" } });
}
