import { NextResponse } from "next/server";
import { dongsOf, placesIn, type DongPlace } from "@/lib/dong";
import { getMapData } from "@/lib/mapData";

/**
 * 동네 단계(지도를 가까이 확대했을 때)의 읍·면·동 행정복지센터와 시청·구청.
 *
 *  - ?bbox=남,서,북,동&kind=programs|jobs → 그 범위 안의 자리(많으면 가운데에서 가까운 400곳)
 *  - ?sido=&sgg= → 그 시·군·구의 읍·면·동 이름표(지역 고르기 셋째 칸)
 *
 * 한 줄: [열쇠, 시·도, 시·군·구, 구, 동, 위도, 경도, 센터 이름, 청사(1), 동 이름이 적힌 공고 수]
 */
export const revalidate = 3600;

type Row = [string, string, string, string, string, number, number, string, 0 | 1, number];

const num = (v: string | null) => (v === null || v.trim() === "" ? NaN : Number(v));

export async function GET(req: Request) {
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind") === "jobs" ? "jobs" : "programs";
  const sido = u.searchParams.get("sido");
  const sgg = u.searchParams.get("sgg");
  let places: DongPlace[] = [];
  if (sido && sgg) {
    places = dongsOf(sido, sgg);
  } else {
    const b = (u.searchParams.get("bbox") ?? "").split(",").map((x) => num(x));
    const [s, w, n, e] = b;
    if (b.length !== 4 || b.some((x) => !Number.isFinite(x)) || n <= s || e <= w || n - s > 1.5 || e - w > 2) {
      return NextResponse.json({ error: "bbox 는 남,서,북,동(가까이 확대한 범위)" }, { status: 400 });
    }
    places = placesIn({ s, w, n, e });
  }
  const data = await getMapData().catch(() => null);
  const counts = data?.dongs?.[kind] ?? {};
  const rows: Row[] = places.map((p) => [
    p.key, p.sido, p.sgg, p.gu, p.dong, +p.lat.toFixed(5), +p.lng.toFixed(5), p.hall ?? "", p.office ? 1 : 0, counts[p.key]?.length ?? 0,
  ]);
  return NextResponse.json({ rows }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
