import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * 관리자 인증.
 *
 * 비밀번호는 코드에 두지 않는다. 저장소가 공개되어 있고,
 * 한 번 커밋되면 이력에서 지워도 남는다.
 * Vercel 환경변수에만 넣는다 (NEXT_PUBLIC_ 접두어 없이 — 서버에서만 읽힌다).
 */
// 붙여넣을 때 딸려 들어간 공백·줄바꿈·따옴표 때문에 로그인이 막히는 일이 잦다.
// 비밀번호 앞뒤 공백은 어차피 쓸 이유가 없으므로 양쪽 다 정리하고 비교한다.
const clean = (v: string | undefined) =>
  (v ?? "").trim().replace(/^["']|["']$/g, "");

const USER = clean(process.env.ADMIN_USER);
const PASS = clean(process.env.ADMIN_PASSWORD);
const SECRET = clean(process.env.ADMIN_SECRET) || PASS;
const COOKIE = "jw_admin";

const eq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const token = () =>
  createHash("sha256").update(`${USER}:${PASS}:${SECRET}`).digest("hex");

export const configured = () => Boolean(USER && PASS);

export function verify(user: string, pass: string) {
  if (!configured()) return false;
  // 사용자가 입력한 값도 같은 기준으로 정리한다 (모바일 자동완성이 공백을 붙인다)
  return eq(user.trim(), USER) && eq(pass.trim(), PASS);
}

export function isLoggedIn() {
  if (!configured()) return false;
  const c = cookies().get(COOKIE)?.value;
  return Boolean(c && eq(c, token()));
}

export function sessionCookie() {
  return {
    name: COOKIE,
    value: token(),
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/admin",
    maxAge: 60 * 60 * 8,
  };
}

export const COOKIE_NAME = COOKIE;
