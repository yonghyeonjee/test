import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { collectAll, collectOne, COLLECT_KEYS, type CollectKey } from "@/lib/collectors";

/**
 * 수집 진입점. 두 손님이 온다.
 *
 *  - Vercel Cron, 매일 09:00 KST, source 없이  → 전부 나란히(최신 100건씩)
 *  - GitHub Actions, 하루 다섯 번, source 붙여  → 그 하나만, 과거를 이어서
 *
 * 둘 다 CRON_SECRET 으로 온다. 관리자가 로그인한 채로 불러도 된다. 그 밖에는 401.
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
