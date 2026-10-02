/**
 * 브라우저에서 쓰는 Supabase RPC 호출. supabase-js 없이 fetch 로 한다.
 *
 * supabase-js 는 realtime·auth·storage 까지 300KB 라, 클라이언트 컴포넌트가
 * 가져오면 쪽마다 그만큼 내려간다. 여기서 하는 일은 공개 키로 RPC 하나를
 * 부르는 것뿐이라 fetch 로 충분하다. 반환 모양은 supabase-js 와 같게 둔다.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const restConfigured = Boolean(URL_ && KEY);

export async function rpc<T = unknown>(
  fn: string, args: Record<string, unknown> = {},
): Promise<{ data: T | null; error: string | null }> {
  if (!URL_ || !KEY) return { data: null, error: "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY 미설정" };
  try {
    const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` },
      body: JSON.stringify(args),
    });
    const text = await r.text();
    if (!r.ok) return { data: null, error: text.slice(0, 300) || `HTTP ${r.status}` };
    return { data: (text ? JSON.parse(text) : null) as T, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : String(e) };
  }
}
