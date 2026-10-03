import { NextResponse } from "next/server";
import { isBot } from "@/lib/bot";
import { allow, ipOf } from "@/lib/rateLimit";
import { svcConfigured, svcDb } from "@/lib/svcDb";

export const dynamic = "force-dynamic";

/** 유입 기록 한 줄. 식별 정보는 받지 않는다(채널·리퍼러 호스트·검색어·첫 쪽·utm). */
const S = (v: unknown, n = 120) => (typeof v === "string" ? v.slice(0, n) : null);

export async function POST(req: Request) {
  if (!svcConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  // 크롤러는 서버에서도 거른다(브라우저 쪽 검사가 빠져도 세지 않게).
  if (isBot(req.headers.get("user-agent"))) return NextResponse.json({ ok: true, skipped: "bot" });
  if (!allow(`visit:${ipOf(req)}`, 20)) return NextResponse.json({ ok: false }, { status: 429 });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  void svcDb().rpc("log_visit", {
    p_channel: S(b.channel, 30), p_ref_host: S(b.refHost), p_term: S(b.term), p_landing: S(b.landing, 300),
    p_utm_source: S(b.utmSource), p_utm_medium: S(b.utmMedium), p_utm_campaign: S(b.utmCampaign),
  }).then(() => {}, () => {});
  return NextResponse.json({ ok: true });
}
