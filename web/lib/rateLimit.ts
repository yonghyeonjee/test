/**
 * 아주 작은 속도 제한. 서버 한 대(Lightsail)에서 도니 메모리로 충분하다.
 * 창(windowMs) 안에 같은 열쇠(보통 IP)로 limit 번을 넘으면 막는다.
 * 서버를 여러 대로 늘리면 Redis 로 바꾼다.
 */
const hits = new Map<string, number[]>();
let lastSweep = 0;

export function allow(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  if (now - lastSweep > windowMs) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    lastSweep = now;
  }
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) { hits.set(key, arr); return false; }
  arr.push(now);
  hits.set(key, arr);
  return true;
}

export const ipOf = (req: Request) =>
  (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "?";
