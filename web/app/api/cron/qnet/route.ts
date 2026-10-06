import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { qnetSiteStep } from "@/lib/qnetSite";

/**
 * 큐넷 종목별 시험 일정·수험자 동향 수집(lib/qnetSite). 서울 서버에서 돈다 — 큐넷은 외국 IP 를 막는다.
 * 응답의 more 가 true 면 남은 종목이 있다. 부르는 쪽(GitHub Actions qnet_site.yml)이 다시 부른다.
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
