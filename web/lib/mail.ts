import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

/**
 * 메일 보내기(AWS SES). 개인 계정으로도 쓸 수 있고 1,000통에 $0.10.
 *
 * 필요한 환경변수: AWS_REGION(보통 ap-northeast-2), AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 * MAIL_FROM(SES 에서 확인한 보내는 주소, 예: K나라지원 <noreply@jiwon.knowhow-it.com>).
 * 하나라도 없으면 보내지 않고 "시험 모드"로 내용만 돌려준다 — 코드는 돌되 아무도 받지 않는다.
 */
export const mailConfigured = () =>
  Boolean(process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.MAIL_FROM);

let client: SESv2Client | null = null;

export async function sendMail(m: { to: string; subject: string; html: string; text: string }): Promise<{ ok: boolean; dry: boolean; error?: string }> {
  if (!mailConfigured()) return { ok: true, dry: true };
  try {
    client ??= new SESv2Client({ region: process.env.AWS_REGION });
    await client.send(new SendEmailCommand({
      FromEmailAddress: process.env.MAIL_FROM,
      Destination: { ToAddresses: [m.to] },
      Content: { Simple: {
        Subject: { Data: m.subject, Charset: "UTF-8" },
        Body: { Html: { Data: m.html, Charset: "UTF-8" }, Text: { Data: m.text, Charset: "UTF-8" } },
      } },
    }));
    return { ok: true, dry: false };
  } catch (e) {
    return { ok: false, dry: false, error: e instanceof Error ? e.message : String(e) };
  }
}
