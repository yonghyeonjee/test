import { NextResponse } from "next/server";
import { isBot } from "@/lib/bot";
import { allow, ipOf } from "@/lib/rateLimit";
import { svcConfigured, svcDb } from "@/lib/svcDb";

export const dynamic = "force-dynamic";

/**
 * 방문 흐름 한 줄(2026-11-27, sql/020 visit_step). 들어온 사람이 같은 탭에서 둘째~다섯째로 본 쪽.
 * "어느 길로 들어와(channel) 어느 쪽에 내려(landing) 몇 번째로(step) 어디를 봤나(path)"만 적는다.
 * 사람·기기를 가리키는 값은 받지도 적지도 않는다. 크롤러 거르기는 /api/visit 과 같다.
 */
const PATH = /^\/[^\s?#]{0,199}$/;

export async function POST(req: Request) {
  if (!svcConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  if (isBot(req.headers.get("user-agent"))) return NextResponse.json({ ok: true, skipped: "bot" });
  if (!req.headers.get("accept-language")) return NextResponse.json({ ok: true, skipped: "no-lang" });
  if (!allow(`vstep:${ipOf(req)}`, 30)) return NextResponse.json({ ok: false }, { status: 429 });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const channel = typeof b.channel === "string" ? b.channel.slice(0, 40) : "";
  const landing = typeof b.landing === "string" ? b.landing.split(/[?#]/)[0].slice(0, 200) : "";
  const path = typeof b.path === "string" ? b.path.split(/[?#]/)[0].slice(0, 200) : "";
  const step = Number(b.step);
  if (!channel || !PATH.test(landing) || !PATH.test(path) || !Number.isInteger(step) || step < 2 || step > 5)
    return NextResponse.json({ ok: false }, { status: 400 });
  void svcDb().from("visit_step").insert({ channel, landing, step, path }).then(() => {}, () => {});
  return NextResponse.json({ ok: true });
}
