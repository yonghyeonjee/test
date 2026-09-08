import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt) as (
  pw: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  opts: { N: number; r: number; p: number }
) => Promise<Buffer>;

// 로그인 한 번에 100ms 안팎. 무차별 대입을 느리게 만든다.
const N = 16384, R = 8, P = 1, LEN = 32;

/** 저장 형태: scrypt$N$r$p$salt$hash */
export async function hash(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, LEN,
    { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verify(password: string, stored: string) {
  try {
    const [tag, n, r, p, salt, key] = stored.split("$");
    if (tag !== "scrypt") return false;
    const want = Buffer.from(key, "base64url");
    const got = await scryptAsync(
      password.normalize("NFKC"),
      Buffer.from(salt, "base64url"),
      want.length,
      { N: Number(n), r: Number(r), p: Number(p) }
    );
    return want.length === got.length && timingSafeEqual(want, got);
  } catch {
    return false;
  }
}

/** 약한 비밀번호 거르기. 저장 내용이 민감해서 너무 헐거우면 안 된다. */
const COMMON = new Set([
  "12345678", "123456789", "1234567890", "password", "qwerty123",
  "11111111", "00000000", "asdf1234", "1q2w3e4r", "abcd1234",
]);

export function weak(pw: string): string | null {
  if (pw.length < 8) return "8자 이상으로 정해주세요.";
  if (COMMON.has(pw.toLowerCase())) return "너무 흔한 비밀번호입니다.";
  if (/^(.)\1+$/.test(pw)) return "같은 글자만 쓸 수 없습니다.";
  const kinds =
    Number(/[a-z]/i.test(pw)) + Number(/[0-9]/.test(pw)) +
    Number(/[^a-z0-9]/i.test(pw));
  if (kinds < 2) return "영문·숫자·기호 중 두 가지 이상을 섞어주세요.";
  return null;
}
