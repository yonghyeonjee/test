import { NextResponse } from "next/server";
import { DIMS, UNITS, type StatRow } from "@/lib/adminStats";
import { isLoggedIn } from "@/lib/auth";
import { svcConfigured, svcDb } from "@/lib/svcDb";

export const dynamic = "force-dynamic";

/**
 * 관리자 통계 탐색기가 부르는 집계(sql/019 admin_stat_series). /admin 아래에 두는 이유:
 * 관리자 쿠키의 path 가 /admin 이라 그 밖의 주소에는 쿠키가 안 실린다.
 *
 *   GET /admin/stats?src=visit|search&from=ISO&to=ISO&unit=hour|day|week|month|year&dim=…&top=12
 *   → { rows: [{ b, k, n }] }   b 구간(한국 시각), k 값, n 건수
 */
export async function GET(req: Request) {
  if (!isLoggedIn()) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (!svcConfigured()) return NextResponse.json({ error: "SUPABASE_SERVICE_KEY 가 없습니다." }, { status: 503 });
  const q = new URL(req.url).searchParams;
  const src = q.get("src") === "search" ? "search" : "visit";
  const unit = (UNITS as readonly string[]).includes(q.get("unit") ?? "") ? q.get("unit")! : "day";
  const dims = DIMS[src] as readonly string[];
  const dim = dims.includes(q.get("dim") ?? "") ? q.get("dim")! : dims[0];
  const from = new Date(q.get("from") ?? "");
  const to = new Date(q.get("to") ?? "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to)
    return NextResponse.json({ error: "기간이 올바르지 않습니다." }, { status: 400 });
  // 한 시간 단위로 1년을 달라고 하면 구간 8,760개 × 값 12개가 된다. 시간 단위는 31일까지만.
  if (unit === "hour" && to.getTime() - from.getTime() > 31 * 86400_000)
    return NextResponse.json({ error: "시간 단위는 31일까지만 볼 수 있습니다." }, { status: 400 });
  const top = Math.min(Math.max(Number(q.get("top") ?? 12) || 12, 1), 30);

  const { data, error } = await svcDb().rpc("admin_stat_series", {
    p_src: src, p_from: from.toISOString(), p_to: to.toISOString(), p_unit: unit, p_dim: dim, p_top: top,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: (data ?? []) as StatRow[] }, { headers: { "Cache-Control": "no-store" } });
}
