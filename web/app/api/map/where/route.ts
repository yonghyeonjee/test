import { NextResponse } from "next/server";
import { nearestOf, placeLabel } from "@/lib/dong";

/**
 * 이 자리는 어느 동 근처이고, 가장 가까운 행정복지센터는 어디인가(내 위치를 켰을 때).
 * 좌표는 소수 셋째 자리(약 100m)로 줄여 받는다 — 정확한 위치를 남기지 않는다.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 32 || lat > 39.5 || lng < 124 || lng > 132.5) {
    return NextResponse.json({ dong: null, hall: null });
  }
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const { dong, hall } = nearestOf(r(lat), r(lng));
  return NextResponse.json({
    dong: dong && { sido: dong.sido, sgg: dong.sgg, gu: dong.gu, dong: dong.dong, label: placeLabel(dong), km: +dong.km.toFixed(2) },
    hall: hall && { name: hall.hall, sido: hall.sido, sgg: hall.sgg, lat: hall.lat, lng: hall.lng, km: +hall.km.toFixed(2) },
  }, { headers: { "Cache-Control": "private, max-age=600" } });
}
