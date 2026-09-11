/**
 * 공공데이터포털(data.go.kr) 호출 공통부.
 *
 * 인증키는 저장소에 두지 않는다. Vercel 환경변수 DATA_GO_KR_KEY(Secret)에만
 * 넣고, 서버에서만 읽는다. NEXT_PUBLIC_ 접두사를 절대 붙이지 않는다 —
 * 붙이는 순간 브라우저 번들에 그대로 실려 누구나 가져다 쓴다.
 *
 * 포털은 인증키를 URL 인코딩된 채로 받는다. 환경변수에 인코딩된 키(%2F 가
 * 들어 있는 형태)를 넣었는지 디코딩된 키를 넣었는지 사람마다 달라서,
 * 여기서 한 번 더 판단해 맞춰 준다.
 */

const KEY = process.env.DATA_GO_KR_KEY ?? "";

export const openApiConfigured = KEY.trim().length > 0;

function serviceKey() {
  const k = KEY.trim();
  // 이미 인코딩된 키면 그대로, 아니면 인코딩해서 넣는다.
  return /%[0-9A-Fa-f]{2}/.test(k) ? k : encodeURIComponent(k);
}

export type ApiResult<T> =
  | { ok: true; rows: T[]; total: number }
  | { ok: false; reason: string };

/**
 * 포털 응답은 서비스마다 모양이 제각각이다. header/body 로 감싼 것도 있고
 * 최상위에 items 를 그냥 두는 것도 있다. 배열을 찾을 때까지 걸어 들어간다.
 */
function findRows(v: unknown, depth = 0): Record<string, unknown>[] | null {
  if (depth > 6 || v === null || typeof v !== "object") return null;
  if (Array.isArray(v))
    return v.every((x) => x && typeof x === "object")
      ? (v as Record<string, unknown>[])
      : null;
  const o = v as Record<string, unknown>;
  // item 이 한 건일 때 배열이 아니라 객체로 오는 경우가 있다.
  if ("item" in o && o.item && typeof o.item === "object" && !Array.isArray(o.item))
    return [o.item as Record<string, unknown>];
  for (const k of ["items", "item", "body", "response", "data"]) {
    if (k in o) {
      const hit = findRows(o[k], depth + 1);
      if (hit) return hit;
    }
  }
  for (const val of Object.values(o)) {
    const hit = findRows(val, depth + 1);
    if (hit) return hit;
  }
  return null;
}

function findNumber(v: unknown, key: string, depth = 0): number | null {
  if (depth > 6 || v === null || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (key in o) {
    const n = Number(o[key]);
    if (Number.isFinite(n)) return n;
  }
  for (const val of Object.values(o)) {
    if (val && typeof val === "object") {
      const hit = findNumber(val, key, depth + 1);
      if (hit !== null) return hit;
    }
  }
  return null;
}

/**
 * 조회 한 번. 실패해도 예외를 던지지 않는다 — 이 자료 하나 때문에
 * 페이지 전체가 죽으면 안 된다. 이유만 돌려주고 화면에서 대신 안내한다.
 */
export async function callOpenApi<T = Record<string, unknown>>(
  url: string,
  params: Record<string, string | number>,
  revalidate = 21600,
): Promise<ApiResult<T>> {
  if (!openApiConfigured)
    return { ok: false, reason: "인증키가 설정되지 않았습니다." };

  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  const full = `${url}?serviceKey=${serviceKey()}&${qs}`;

  try {
    const res = await fetch(full, {
      next: { revalidate },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { ok: false, reason: `응답 코드 ${res.status}` };

    const text = await res.text();
    if (!text.trim().startsWith("{") && !text.trim().startsWith("["))
      // XML 오류 문서가 돌아오는 경우가 흔하다. 메시지만 꺼내 준다.
      return {
        ok: false,
        reason:
          text.match(/<returnAuthMsg>([^<]+)</)?.[1] ??
          text.match(/<resultMsg>([^<]+)</)?.[1] ??
          "JSON 이 아닌 응답",
      };

    const json = JSON.parse(text) as unknown;
    const rows = findRows(json);
    if (!rows) return { ok: false, reason: "목록을 찾지 못했습니다." };
    return {
      ok: true,
      rows: rows as T[],
      total: findNumber(json, "totalCount") ?? rows.length,
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "호출 실패" };
  }
}
