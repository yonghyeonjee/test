/**
 * BUILD_NO_DB=1 로 빌드하면 빌드 중에는 DB 에 가지 않고 "0건" 응답을 바로 받는다(미리 그리는 쪽은 빈 채로 나가고
 * 운영에서 첫 갱신 때 채워진다). 2026-10-06 DB 가 IO 한도에 걸려 빌드가 시간 초과로 실패해, 장애를 고치는 배포조차
 * 못 나갔을 때 쓴다. 운영 실행 때는 영향 없음.
 */
export const buildWithoutDb = process.env.BUILD_NO_DB === "1" && process.env.NEXT_PHASE === "phase-production-build";

/** PostgREST 가 0건일 때 돌려주는 모양 그대로. 한 건을 요구한 조회(.single)는 PGRST116. */
export async function emptyDbFetch(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const accept = new Headers(init?.headers).get("accept") ?? "";
  if (accept.includes("vnd.pgrst.object")) {
    return new Response(JSON.stringify({ code: "PGRST116", details: "The result contains 0 rows", hint: null, message: "JSON object requested, multiple (or no) rows returned" }),
      { status: 406, headers: { "content-type": "application/json" } });
  }
  return new Response(init?.method === "HEAD" ? null : "[]", { status: 200, headers: { "content-type": "application/json", "content-range": "*/0" } });
}
