import { NextResponse } from "next/server";
import { allow, ipOf } from "@/lib/rateLimit";
import { deviceFromRequest } from "@/lib/session";
import { svcConfigured, svcDb } from "@/lib/svcDb";

export const dynamic = "force-dynamic";

/**
 * 저장한 공고·사업. 표 saved_item 을 service_role 로 바로 다룬다(함수 없음, sql/011).
 *   GET            목록(최신순 100건)
 *   POST {action}  add(kind, id, title, sub, end) · remove(kind, id)
 * 기기 열쇠는 로그인 쿠키 또는 X-Device-Key 머리글(lib/session deviceFromRequest).
 */
const MAX = 100;
const ID = /^[\x21-\x7e가-힣]{1,120}$/;         // 따옴표·공백 없는 공고 번호
const TEXT = /^[^\x00-\x1f]{1,200}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

export async function GET(req: Request) {
  if (!svcConfigured()) return bad("설정이 없습니다.", 503);
  const key = deviceFromRequest(req);
  if (!key) return bad("기기 열쇠가 없습니다.");
  if (!allow(`saved:${ipOf(req)}`, 60)) return bad("잠시 뒤 다시 시도해주세요.", 429);
  const { data, error } = await svcDb().from("saved_item")
    .select("kind,item_id,title,sub,end_date,created_at").eq("device_key", key)
    .order("created_at", { ascending: false }).limit(MAX);
  if (error) return bad("불러오지 못했습니다.", 502);
  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!svcConfigured()) return bad("설정이 없습니다.", 503);
  const key = deviceFromRequest(req);
  if (!key) return bad("기기 열쇠가 없습니다.");
  if (!allow(`saved:${ipOf(req)}`, 60)) return bad("잠시 뒤 다시 시도해주세요.", 429);
  let body: { action?: string; kind?: string; id?: string; title?: string; sub?: unknown; end?: unknown };
  try { body = await req.json(); } catch { return bad("본문이 비었습니다."); }
  const kind = body.kind === "job" ? "job" : body.kind === "p" ? "p" : null;
  const id = typeof body.id === "string" && ID.test(body.id) ? body.id : null;
  if (!kind || !id) return bad("공고 번호가 올바르지 않습니다.");
  const db = svcDb();

  if (body.action === "add") {
    const title = typeof body.title === "string" && TEXT.test(body.title.trim()) ? body.title.trim() : null;
    if (!title) return bad("제목이 올바르지 않습니다.");
    const sub = typeof body.sub === "string" && TEXT.test(body.sub.trim()) ? body.sub.trim().slice(0, 120) : null;
    const end = typeof body.end === "string" && DATE.test(body.end.slice(0, 10)) ? body.end.slice(0, 10) : null;
    // 한 기기가 무한정 쌓지 못하게. 넘치면 가장 오래된 것부터.
    const { count } = await db.from("saved_item").select("id", { count: "exact", head: true }).eq("device_key", key);
    if ((count ?? 0) >= MAX) {
      const { data: old } = await db.from("saved_item").select("id").eq("device_key", key)
        .order("created_at", { ascending: true }).limit((count ?? MAX) - MAX + 1);
      const ids = (old ?? []).map((r) => r.id as number);
      if (ids.length) await db.from("saved_item").delete().in("id", ids);
    }
    const { error } = await db.from("saved_item")
      .upsert({ device_key: key, kind, item_id: id, title, sub, end_date: end }, { onConflict: "device_key,kind,item_id" });
    return error ? bad("저장하지 못했습니다.", 502) : NextResponse.json({ ok: true });
  }
  if (body.action === "remove") {
    const { error } = await db.from("saved_item").delete().eq("device_key", key).eq("kind", kind).eq("item_id", id);
    return error ? bad("지우지 못했습니다.", 502) : NextResponse.json({ ok: true });
  }
  return bad("모르는 요청입니다.");
}
