import { NextResponse } from "next/server";
import { allow, ipOf } from "@/lib/rateLimit";
import { svcConfigured, svcDb } from "@/lib/svcDb";

export const dynamic = "force-dynamic";

/**
 * 저장한 조건. 브라우저가 Supabase 를 직접 부르지 않게 여기서 받아 넘긴다.
 * 기기 열쇠(UUID)는 X-Device-Key 머리글로만 받는다 — 주소창·기록에 남지 않게.
 *   GET            목록
 *   POST {action}  add(cond, kind, query, label) · open(cond) · remove(cond)
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COND = /^[\x20-\x7e가-힣]{0,600}$/;

const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

function keyOf(req: Request) {
  const k = req.headers.get("x-device-key") ?? "";
  return UUID.test(k) ? k.toLowerCase() : null;
}

export async function GET(req: Request) {
  if (!svcConfigured()) return bad("설정이 없습니다.", 503);
  const key = keyOf(req);
  if (!key) return bad("기기 열쇠가 없습니다.");
  if (!allow(`saved:${ipOf(req)}`, 60)) return bad("잠시 뒤 다시 시도해주세요.", 429);
  const { data, error } = await svcDb().rpc("saved_list", { p_key: key });
  if (error) return bad("불러오지 못했습니다.", 502);
  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!svcConfigured()) return bad("설정이 없습니다.", 503);
  const key = keyOf(req);
  if (!key) return bad("기기 열쇠가 없습니다.");
  if (!allow(`saved:${ipOf(req)}`, 60)) return bad("잠시 뒤 다시 시도해주세요.", 429);
  let body: { action?: string; cond?: string; kind?: string; query?: string; label?: unknown };
  try { body = await req.json(); } catch { return bad("본문이 비었습니다."); }
  const cond = typeof body.cond === "string" && COND.test(body.cond) ? body.cond : null;
  if (!cond) return bad("조건이 올바르지 않습니다.");
  const db = svcDb();
  if (body.action === "add") {
    const kind = body.kind === "business" ? "business" : "welfare";
    const query = typeof body.query === "string" && COND.test(body.query) ? body.query : null;
    const label = Array.isArray(body.label) ? body.label.filter((x): x is string => typeof x === "string" && x.length <= 60).slice(0, 12) : [];
    if (!query) return bad("조건이 올바르지 않습니다.");
    const { error } = await db.rpc("saved_add", { p_key: key, p_cond: cond, p_kind: kind, p_query: query, p_label: label });
    return error ? bad("저장하지 못했습니다.", 502) : NextResponse.json({ ok: true });
  }
  if (body.action === "open") {
    await db.rpc("saved_open", { p_key: key, p_cond: cond });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "remove") {
    const { error } = await db.rpc("saved_remove", { p_key: key, p_cond: cond });
    return error ? bad("지우지 못했습니다.", 502) : NextResponse.json({ ok: true });
  }
  return bad("모르는 요청입니다.");
}
