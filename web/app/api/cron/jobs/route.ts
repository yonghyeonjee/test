import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { collectAll, collectOne, COLLECT_KEYS, type CollectKey } from "@/lib/collectors";

/**
 * 수집 진입점. 두 손님이 온다.
 *
 *  - source 없이  → 전부 나란히(최신 100건씩)
 *  - source 붙여  → 그 하나만, 과거를 이어서
 *
 * 매일 09:00 KST 의 예약 실행은 2026-10-08 부터 GitHub 러너가 scripts/cron.ts 로 직접 돈다(cron_jobs.yml).
 * 이 길은 관리자 화면의 수동 실행용으로 남는다. CRON_SECRET 또는 관리자 로그인. 그 밖에는 401.
 * 응답의 more 가 true 면 아직 남은 것이 있다 — 부르는 쪽이 다시 부른다.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  const fromCron = !!secret && auth === `Bearer ${secret}`;
  if (!fromCron && !isLoggedIn()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const only = new URL(req.url).searchParams.get("source");
  const at = new Date().toISOString();

  if (!only) {
    const results = await collectAll(45_000, COLLECT_KEYS as CollectKey[]);
    return NextResponse.json({ at, results });
  }
  if (!(COLLECT_KEYS as string[]).includes(only))
    return NextResponse.json({ error: `모르는 source: ${only}`, known: COLLECT_KEYS }, { status: 400 });

  const r = await collectOne(only as CollectKey, { budgetMs: 45_000 });
  return NextResponse.json({ at, results: [r], more: Boolean(r.ok && r.more) });
}
