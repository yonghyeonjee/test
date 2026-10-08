import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { qnetSiteStep } from "@/lib/qnetSite";

/**
 * 큐넷 종목별 시험 일정·수험자 동향 수집(lib/qnetSite).
 * 예약 실행(qnet_site.yml)은 2026-10-08 부터 GitHub 러너가 scripts/cron.ts qnet 으로 직접 돈다(러너에서 큐넷이 열리는 것을 확인).
 * 이 길은 관리자 수동 실행용. 응답의 more 가 true 면 남은 종목이 있다.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!(secret && auth === `Bearer ${secret}`) && !isLoggedIn()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const r = await qnetSiteStep();
    return NextResponse.json({ at: new Date().toISOString(), ...r });
  } catch (e) {
    return NextResponse.json({ step: "qnet", error: e instanceof Error ? e.message : String(e), more: false }, { status: 500 });
  }
}
