import { NextResponse } from "next/server";
import { db, dbConfigured } from "@/lib/db";
import { dropAlioTwins } from "@/lib/jobTwins";
import { SOURCE_OP, SOURCE_VAL } from "@/lib/pubJobs";
import { allow, ipOf } from "@/lib/rateLimit";

/**
 * 저장한 기관의 소식(2026-11-27, lib/savedOrgs). 기관 이름과 "마지막으로 본 때"를 받아
 * 그 뒤에 들어온 공고(first_seen_at 기준 — 우리가 그 공고를 처음 받은 때)와 지금 접수 중인 공고 수를 돌려준다.
 * 누가 어떤 기관을 저장했는지는 남기지 않는다(목록은 그 사람 브라우저에만 있다).
 */
export const dynamic = "force-dynamic";

const MAX_ORGS = 20;
const MAX_DAYS = 60;      // 이보다 오래 안 본 기관은 60일 치만 센다
const HEAD = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

type Row = { source_id: string; title: string | null; reg_date: string | null; end_date: string | null };

export async function POST(req: Request) {
  if (!dbConfigured) return NextResponse.json([], { headers: HEAD });
  if (!allow(`orgs:${ipOf(req)}`, 30)) return NextResponse.json({ error: "잠시 뒤 다시 시도해주세요." }, { status: 429, headers: HEAD });
  let body: { orgs?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json([], { headers: HEAD }); }
  const floor = Date.now() - MAX_DAYS * 86_400_000;
  const orgs = (Array.isArray(body.orgs) ? (body.orgs as ({ name?: unknown; since?: unknown } | null)[]) : []).slice(0, MAX_ORGS).flatMap((o) => {
    const name = typeof o?.name === "string" ? o.name.trim() : "";
    const t = typeof o?.since === "string" ? Date.parse(o.since) : NaN;
    if (!name || name.length > 120 || /[\x00-\x1f]/.test(name) || !Number.isFinite(t)) return [];
    return [{ name, since: new Date(Math.max(t, floor)).toISOString() }];
  });
  const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);   // 한국 날짜

  const out = await Promise.all(orgs.map(async ({ name, since }) => {
    const base = () => db.from("job_posts").select("source_id,title,reg_date,end_date")
      .filter("source", SOURCE_OP, SOURCE_VAL).eq("org", name);
    const [fresh, open] = await Promise.all([
      base().gt("first_seen_at", since).order("first_seen_at", { ascending: false }).limit(20),
      base().gte("end_date", today).limit(60),
    ]);
    const pick = (r: Row) => ({ id: String(r.source_id), title: String(r.title ?? ""), reg: r.reg_date, end: r.end_date });
    const news = dropAlioTwins((fresh.data ?? []) as Row[], pick);
    return {
      name,
      fresh: news.length,
      open: dropAlioTwins((open.data ?? []) as Row[], pick).length,
      items: news.slice(0, 3).map((r) => ({ id: String(r.source_id), title: String(r.title ?? ""), end: r.end_date })),
    };
  }));
  return NextResponse.json(out, { headers: HEAD });
}
