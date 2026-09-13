import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { ingest } from "@/lib/jobsIngest";

/**
 * 채용 공고 수집 진입점. Vercel Cron(매일 09:00 KST)이 CRON_SECRET 으로,
 * 관리자가 화면의 단추로 부른다. 그 밖에는 401.
 *
 *   /api/cron/jobs?pages=6&since=2026-08-01&source=gojobs&reset=1
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  const fromCron = !!secret && auth === `Bearer ${secret}`;
  if (!fromCron && !isLoggedIn()) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const u = new URL(req.url);
  const pages = Math.min(12, Math.max(1, Number(u.searchParams.get("pages") ?? 6)));
  const since = u.searchParams.get("since") ?? undefined;
  const reset = u.searchParams.get("reset") === "1";
  const only = u.searchParams.get("source");
  const sources = (only === "gojobs" || only === "worldjob" ? [only] : ["gojobs", "worldjob"]) as ("gojobs" | "worldjob")[];

  const reports = [];
  for (const s of sources) {
    try {
      reports.push(await ingest(s, { pages, since, reset, by: fromCron ? "cron" : "admin" }));
    } catch (e) {
      reports.push({ source: s, ok: false, reason: e instanceof Error ? e.message : String(e), pages: [], saved: 0 });
    }
  }
  return NextResponse.json({ at: new Date().toISOString(), reports });
}
