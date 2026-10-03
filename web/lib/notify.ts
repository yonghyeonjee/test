import { createHmac, timingSafeEqual } from "crypto";
import { matchBusiness, matchWelfare, type BusinessQuery, type Program, type WelfareQuery } from "./db";
import { mailConfigured, sendMail } from "./mail";
import { svcDb } from "./svcDb";

/**
 * 저장한 조건에 새 공고가 올라오면 하루 한 통으로 모아 알린다.
 *
 * 흐름(매일 수집이 끝난 뒤, /api/cron/notify):
 *  1. 알림에 동의했고 이메일이 있는 계정을 모은다(save_account).
 *  2. 그 기기 열쇠의 저장 조건(saved_condition)마다 지금 조건 검색을 돌린다 — 화면과 같은 함수.
 *  3. 아직 이 기기에 보낸 적 없는 공고(notify_sent 에 없음)만 "새 공고"로 친다.
 *     처음 켠 사람에게는 가장 최근 것 5건만 보내고 나머지는 보낸 것으로 적어, 묵은 공고를 쏟지 않는다.
 *  4. 한 통에 조건별로 묶어 보내고, notify_sent·notify_log 에 적는다.
 *
 * 받는 사람이 없으면 아무 일도 안 한다. 메일 설정이 없으면 시험 모드(보내지 않고 세기만).
 */
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://jiwon.knowhow-it.com";
const FIRST_MAX = 5;
const PER_COND = 8;

type Saved = { device_key: string; cond_key: string; kind: string; query: string; label: string[] };
type Account = { device_key: string; email: string; display_name: string | null };

/** 저장된 물음표 문자열을 화면과 같은 질의로. */
export function parseQuery(kind: string, query: string): { welfare?: WelfareQuery; business?: BusinessQuery } {
  const sp = new URLSearchParams(query);
  const one = (k: string) => sp.get(k) || undefined;
  const many = (k: string) => sp.getAll(k).filter(Boolean);
  const num = (k: string) => { const v = Number(one(k)); return Number.isFinite(v) && v > 0 ? v : undefined; };
  if (kind === "business" || sp.get("tab") === "business")
    return { business: { sido: one("sido"), bizTarget: one("target"), bizField: many("field"), bizYears: num("years"), industry: many("ind"), q: one("q") } };
  return { welfare: { sido: one("sido"), sigungu: one("sigungu"), age: num("age"), employment: one("emp"), household: many("hh"), q: one("q") } };
}

/** 수신 거부 링크의 서명. 세션 비밀을 같이 쓰되 용도를 섞어 세션 토큰으로는 못 쓰게. */
const secret = () => (process.env.SESSION_SECRET || process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || "").trim();
export const unsubToken = (device: string) => `${device}.${createHmac("sha256", secret()).update(`unsub:${device}`).digest("base64url")}`;
export function verifyUnsub(token: string | null): string | null {
  if (!token || !secret()) return null;
  const [device, sig] = token.split(".");
  if (!device || !sig) return null;
  const want = createHmac("sha256", secret()).update(`unsub:${device}`).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b) ? device : null;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

function render(name: string | null, groups: { label: string[]; query: string; items: Program[] }[], unsub: string) {
  const hello = name ? `${esc(name)} 님, ` : "";
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const html = `<div style="font-family:-apple-system,Pretendard,sans-serif;max-width:600px;margin:0 auto;color:#1b1f2a">
<p style="font-size:15px">${hello}저장하신 조건에 새 공고 <b>${total}건</b>이 올라왔습니다.</p>
${groups.map((g) => `<h3 style="font-size:15px;margin:22px 0 8px;color:#5A4BE0">${esc(g.label.join(" · "))}</h3>
<ul style="padding-left:18px;margin:0">${g.items.map((p) => `<li style="margin:6px 0"><a href="${SITE}/p/${encodeURIComponent(p.source_id)}" style="color:#1b1f2a;font-weight:600">${esc(p.title)}</a>
<span style="color:#6b7280;font-size:12.5px"> · ${esc([p.org_name, p.sigungu || p.sido].filter(Boolean).join(" · "))}${p.apply_end ? ` · ${p.apply_end}까지` : p.is_always_on ? " · 상시" : ""}</span></li>`).join("")}</ul>
<p style="margin:8px 0 0"><a href="${SITE}/?${esc(g.query)}" style="font-size:13px;color:#5A4BE0">이 조건 전부 보기 →</a></p>`).join("")}
<hr style="border:0;border-top:1px solid #e5e8ec;margin:28px 0 14px">
<p style="font-size:12px;color:#6b7280">나라지원이 보냅니다. 공고의 자격은 원문에서 확인하세요.<br>
그만 받으려면 <a href="${unsub}" style="color:#6b7280">여기</a>를 누르거나 <a href="${SITE}/account" style="color:#6b7280">내 계정</a>에서 알림을 끄세요.</p></div>`;
  const text = `${hello}저장하신 조건에 새 공고 ${total}건이 올라왔습니다.\n\n` +
    groups.map((g) => `[${g.label.join(" · ")}]\n` + g.items.map((p) => `- ${p.title} (${[p.org_name, p.sigungu || p.sido].filter(Boolean).join(" · ")}) ${SITE}/p/${encodeURIComponent(p.source_id)}`).join("\n")).join("\n\n") +
    `\n\n그만 받기: ${unsub}`;
  return { html, text };
}

export type NotifyReport = { accounts: number; mailed: number; dry: boolean; items: number; errors: string[] };

export async function runNotify(opts: { dry?: boolean; limit?: number } = {}): Promise<NotifyReport> {
  const db = svcDb();
  const dry = opts.dry || !mailConfigured();
  const report: NotifyReport = { accounts: 0, mailed: 0, dry, items: 0, errors: [] };

  const { data: accs, error: e1 } = await db.from("save_account").select("device_key,email,display_name")
    .eq("notify_consent", true).not("email", "is", null).limit(opts.limit ?? 500);
  if (e1) { report.errors.push(`계정 읽기: ${e1.message}`); return report; }
  const accounts = (accs ?? []) as Account[];
  report.accounts = accounts.length;
  if (!accounts.length) return report;

  const keys = accounts.map((a) => a.device_key);
  const [{ data: conds }, { data: sent }] = await Promise.all([
    db.from("saved_condition").select("device_key,cond_key,kind,query,label").in("device_key", keys),
    db.from("notify_sent").select("device_key,program_id").in("device_key", keys),
  ]);
  const condsBy = new Map<string, Saved[]>();
  for (const c of (conds ?? []) as Saved[]) condsBy.set(c.device_key, [...(condsBy.get(c.device_key) ?? []), c]);
  const sentBy = new Map<string, Set<number>>();
  for (const s of (sent ?? []) as { device_key: string; program_id: number }[]) {
    if (!sentBy.has(s.device_key)) sentBy.set(s.device_key, new Set());
    sentBy.get(s.device_key)!.add(s.program_id);
  }

  for (const a of accounts) {
    const mine = condsBy.get(a.device_key) ?? [];
    if (!mine.length) continue;
    const seen = sentBy.get(a.device_key) ?? new Set<number>();
    const first = seen.size === 0;
    const groups: { label: string[]; query: string; items: Program[] }[] = [];
    const markAll: number[] = [];
    for (const c of mine) {
      try {
        const q = parseQuery(c.kind, c.query);
        const rows = q.business ? await matchBusiness(q.business, 60, true) : await matchWelfare(q.welfare!, 60, true);
        const fresh = rows.filter((p) => !seen.has(p.id));
        if (!fresh.length) continue;
        // 처음이면 최근 것만 보내고 나머지는 "본 것"으로 적는다. 그 뒤로는 조건당 8건까지.
        const take = fresh.slice(0, first ? FIRST_MAX : PER_COND);
        groups.push({ label: c.label, query: c.query, items: take });
        for (const p of fresh) markAll.push(p.id);
        for (const p of fresh) seen.add(p.id);
      } catch (e) {
        report.errors.push(`${a.device_key.slice(0, 8)} ${c.cond_key.slice(0, 40)}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (!groups.length) continue;
    const n = groups.reduce((s, g) => s + g.items.length, 0);
    report.items += n;
    if (dry) { report.mailed += 1; continue; }

    const { html, text } = render(a.display_name, groups, `${SITE}/account/notify-off?t=${encodeURIComponent(unsubToken(a.device_key))}`);
    const r = await sendMail({ to: a.email, subject: `[나라지원] 저장한 조건에 새 공고 ${n}건`, html, text });
    await db.from("notify_log").insert({ device_key: a.device_key, channel: "email", n_items: n, ok: r.ok, error: r.error ?? null });
    if (r.ok) {
      report.mailed += 1;
      const rows = Array.from(new Set(markAll)).map((program_id) => ({ device_key: a.device_key, program_id }));
      for (let i = 0; i < rows.length; i += 500) await db.from("notify_sent").upsert(rows.slice(i, i + 500), { onConflict: "device_key,program_id" });
    } else report.errors.push(`${a.device_key.slice(0, 8)}: ${r.error}`);
  }
  return report;
}
