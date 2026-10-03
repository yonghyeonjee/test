import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { runNotify } from "@/lib/notify";

/**
 * 알림 발송. 매일 수집(cron-jobs)이 끝난 뒤 GitHub Actions 가 부른다. CRON_SECRET 또는 관리자 로그인.
 * ?dry=1 이면 보내지 않고 몇 명에게 몇 건이 갈지만 센다(관리자가 미리 보기).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  const fromCron = !!secret && auth === `Bearer ${secret}`;
  if (!fromCron && !isLoggedIn()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const report = await runNotify({ dry });
  return NextResponse.json({ at: new Date().toISOString(), ...report });
}
