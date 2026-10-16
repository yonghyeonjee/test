import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

/**
 * 메일 보내기. 비밀값이 있는 쪽을 골라 쓴다 — 셋 다 없으면 "시험 모드"(보내지 않고 내용만).
 *
 *  1. Brevo  — BREVO_API_KEY. 무료 하루 300통. 보내는 주소는 Brevo 에서 확인한 것이어야 한다.
 *  2. Resend — RESEND_API_KEY. 무료 달 3,000통(하루 100통). 도메인을 확인하기 전에는
 *              onboarding@resend.dev 로, 가입한 주소에만 보낼 수 있다.
 *  3. AWS SES — AWS_REGION·AWS_ACCESS_KEY_ID·AWS_SECRET_ACCESS_KEY. 1,000통에 $0.10. 샌드박스면 받는 주소도 확인해야 한다.
 *
 * 공통: MAIL_FROM(예: K나라지원 <noreply@jiwon.knowhow-it.com>). 없으면 Resend 만 onboarding 주소로 대신한다.
 * 어느 열쇠든 서버 .env·GitHub Secrets 에만 둔다. 2026-10-16 무료 길(Brevo·Resend)을 더했다.
 */
export type Provider = "brevo" | "resend" | "ses";

const env = (k: string) => (process.env[k] || "").trim();

export function mailProvider(): Provider | null {
  if (env("BREVO_API_KEY") && env("MAIL_FROM")) return "brevo";
  if (env("RESEND_API_KEY")) return "resend";
  if (env("AWS_REGION") && env("AWS_ACCESS_KEY_ID") && env("AWS_SECRET_ACCESS_KEY") && env("MAIL_FROM")) return "ses";
  return null;
}
export const mailConfigured = () => mailProvider() !== null;
/** 설정이 없을 때 안내문. */
export const MAIL_HOWTO = "메일 설정 없음(BREVO_API_KEY+MAIL_FROM, 또는 RESEND_API_KEY, 또는 AWS_REGION·AWS_ACCESS_KEY_ID·AWS_SECRET_ACCESS_KEY+MAIL_FROM)";

/** "이름 <주소>" 또는 "주소" → 이름·주소. */
function fromParts(): { name: string; email: string } {
  const raw = env("MAIL_FROM");
  const m = raw.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (m) return { name: (m[1] || "K나라지원").trim(), email: m[2].trim() };
  return { name: "K나라지원", email: raw };
}

type Msg = { to: string; subject: string; html: string; text: string };
type Result = { ok: boolean; dry: boolean; provider?: Provider; error?: string };

async function viaBrevo(m: Msg): Promise<Result> {
  const sender = fromParts();
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env("BREVO_API_KEY"), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender, to: [{ email: m.to }], subject: m.subject, htmlContent: m.html, textContent: m.text }),
  });
  if (!r.ok) return { ok: false, dry: false, provider: "brevo", error: `Brevo ${r.status}: ${(await r.text()).slice(0, 300)}` };
  return { ok: true, dry: false, provider: "brevo" };
}

async function viaResend(m: Msg): Promise<Result> {
  const from = env("MAIL_FROM") || "K나라지원 <onboarding@resend.dev>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env("RESEND_API_KEY")}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
  });
  if (!r.ok) return { ok: false, dry: false, provider: "resend", error: `Resend ${r.status}: ${(await r.text()).slice(0, 300)}` };
  return { ok: true, dry: false, provider: "resend" };
}

let ses: SESv2Client | null = null;
async function viaSes(m: Msg): Promise<Result> {
  ses ??= new SESv2Client({ region: env("AWS_REGION") });
  await ses.send(new SendEmailCommand({
    FromEmailAddress: env("MAIL_FROM"),
    Destination: { ToAddresses: [m.to] },
    Content: { Simple: {
      Subject: { Data: m.subject, Charset: "UTF-8" },
      Body: { Html: { Data: m.html, Charset: "UTF-8" }, Text: { Data: m.text, Charset: "UTF-8" } },
    } },
  }));
  return { ok: true, dry: false, provider: "ses" };
}

export async function sendMail(m: Msg): Promise<Result> {
  const p = mailProvider();
  if (!p) return { ok: true, dry: true };
  try {
    if (p === "brevo") return await viaBrevo(m);
    if (p === "resend") return await viaResend(m);
    return await viaSes(m);
  } catch (e) {
    return { ok: false, dry: false, provider: p, error: e instanceof Error ? e.message : String(e) };
  }
}
