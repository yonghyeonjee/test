import { NextResponse } from "next/server";
import { getMapData, toItem } from "@/lib/mapData";

/**
 * 정책지도 점 하나의 요약(마감 가까운 몇 건). 점을 누르거나 목록을 펼칠 때 부른다.
 *
 * 쪽에 모든 점의 요약을 다 실으면 HTML 이 400KB 를 넘었다. 점(이름·좌표·건수)만
 * 싣고 요약은 여기서 받는다. 자료는 getMapData 와 같은 한 시간 캐시다.
 */
export const revalidate = 3600;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const kind = u.searchParams.get("kind") === "jobs" ? "jobs" : "programs";
  const key = u.searchParams.get("key") ?? "";
  const data = await getMapData().catch(() => null);
  // 동 핀: 동 이름이 분명히 적힌 공고만(lib/mapData dongs).
  if (key.startsWith("dong|") || key.startsWith("office|")) {
    const rows = data?.dongs?.[kind]?.[key] ?? [];
    return NextResponse.json({ key, kind, items: rows.slice(0, 6).map(toItem), n: rows.length },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  }
  const p = data?.[kind].find((x) => x.key === key);
  return NextResponse.json(
    { key, kind, items: (p?.items ?? []).slice(0, 6).map(toItem), n: p?.n ?? 0 },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
