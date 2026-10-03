import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * 사용자 로그인 세션. 값은 "기기열쇠.만료시각.서명" — 서버가 서명한 것만 믿는다.
 *
 * 기기 열쇠(UUID)가 곧 저장 조건·계정의 주인이다. 쿠키는 HttpOnly 라 브라우저
 * 스크립트가 못 읽고, 서명이 있어 바꿔치기할 수 없다. 90일 뒤 만료.
 * 비밀은 SESSION_SECRET, 없으면 ADMIN_SECRET 을 쓴다(둘 다 서버 전용).
 */
const COOKIE = "jw_user";
const DAYS = 90;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const secret = () => (process.env.SESSION_SECRET || process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || "").trim();
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");
const eq = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export const sessionConfigured = () => Boolean(secret());

export function makeToken(device: string): string {
  const exp = Math.floor(Date.now() / 1000) + DAYS * 86400;
  const body = `${device.toLowerCase()}.${exp}`;
  return `${body}.${sign(body)}`;
}

/** 서명·만료를 확인하고 기기 열쇠를 돌려준다. 아니면 null. */
export function verifyToken(token: string | undefined | null): string | null {
  if (!token || !secret()) return null;
  const [device, exp, sig] = token.split(".");
  if (!device || !exp || !sig || !UUID.test(device)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return eq(sig, sign(`${device}.${exp}`)) ? device : null;
}

/** 요청 머리글(Cookie)에서 읽는다 — 라우트 핸들러용. */
export function deviceFromCookieHeader(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return verifyToken(m ? decodeURIComponent(m[1]) : null);
}

/** 서버 컴포넌트·서버 액션용. */
export function currentDevice(): string | null {
  return verifyToken(cookies().get(COOKIE)?.value);
}

export function userCookie(device: string) {
  return { name: COOKIE, value: makeToken(device), httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: DAYS * 86400 };
}

export const USER_COOKIE = COOKIE;
