import { NextResponse } from "next/server";
import { allow, ipOf } from "@/lib/rateLimit";
import { deviceFromCookieHeader } from "@/lib/session";
import { svcConfigured, svcDb } from "@/lib/svcDb";

export const dynamic = "force-dynamic";

/**
 * 저장 조건 되찾기 코드.
 *   POST {action:"issue"}            이 기기의 코드(X-Device-Key)
 *   POST {action:"claim", code}      코드로 기기 열쇠를 받는다
 * 코드는 8자라 무작위 대입을 막아야 한다 — IP 당 1분에 5번.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

export async function POST(req: Request) {
  if (!svcConfigured()) return bad("설정이 없습니다.", 503);
  if (!allow(`recovery:${ipOf(req)}`, 5)) return bad("잠시 뒤 다시 시도해주세요.", 429);
  let body: { action?: string; code?: string };
  try { body = await req.json(); } catch { return bad("본문이 비었습니다."); }
  const db = svcDb();
  if (body.action === "issue") {
    const key = deviceFromCookieHeader(req.headers.get("cookie")) ?? (req.headers.get("x-device-key") ?? "");
    if (!UUID.test(key)) return bad("기기 열쇠가 없습니다.");
    const { data } = await db.rpc("recovery_issue", { p_key: key.toLowerCase() });
    return NextResponse.json({ code: (data as string | null) ?? null }, { headers: { "Cache-Control": "no-store" } });
  }
  if (body.action === "claim") {
    const clean = String(body.code ?? "").trim().toUpperCase().replace(/[^A-Z2-9]/g, "");
    if (clean.length !== 8) return bad("코드는 8자입니다.");
    const { data } = await db.rpc("recovery_claim", { p_code: clean });
    return NextResponse.json({ key: (data as string | null) ?? null }, { headers: { "Cache-Control": "no-store" } });
  }
  return bad("모르는 요청입니다.");
}
