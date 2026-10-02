import { NextResponse } from "next/server";
import { getMapData } from "@/lib/mapData";

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
  const p = data?.[kind].find((x) => x.key === key);
  return NextResponse.json(
    { key, kind, items: p?.items ?? [], n: p?.n ?? 0 },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
