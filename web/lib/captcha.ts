/**
 * Cloudflare Turnstile 확인.
 *
 * reCAPTCHA 대신 쓰는 이유: 무료에 사용량 제한이 없고, 사용자를 추적하지
 * 않으며, 대부분의 사람에게 클릭조차 요구하지 않는다.
 *
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY  위젯용 (브라우저에 노출돼도 되는 값)
 *   TURNSTILE_SECRET_KEY            검증용 (서버 전용)
 *
 * 두 값이 없으면 캡차를 건너뛴다. 개발 중에 막히지 않게 하려는 것이고,
 * 운영에서는 반드시 넣는다.
 */

const SECRET = process.env.TURNSTILE_SECRET_KEY ?? "";

export const captchaOn = () =>
  Boolean(SECRET && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export async function verifyCaptcha(token: string | null): Promise<boolean> {
  if (!captchaOn()) return true;
  if (!token) return false;

  try {
    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: SECRET, response: token }),
      }
    );
    const j = (await r.json()) as { success?: boolean };
    return j.success === true;
  } catch {
    return false;
  }
}
