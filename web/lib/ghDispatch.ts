/**
 * "지금 수집"을 GitHub Actions 에 넘긴다.
 *
 * 서버 함수는 60초에서 끊기고, 그래서 화면(브라우저)이 다음 회차를 불러
 * 왔다 — 창을 열어 두어야 했다. Actions 는 30분까지 돌 수 있으니 거기에
 * 맡기면 창을 닫아도 된다. 실제 받아오는 일은 여전히 Vercel(서울)이 하고,
 * Actions 는 more 가 true 인 동안 같은 주소를 다시 두드리기만 한다.
 *
 * 필요한 것: Vercel 환경변수 GH_DISPATCH_TOKEN — 이 저장소의 Actions 에
 * workflow 실행 권한(actions: write)만 있는 fine-grained 토큰. 없으면
 * null 을 돌려주고, 화면은 예전처럼 창 안에서 돈다.
 */

const REPO = "yonghyeonjee/test";
const WORKFLOW = "collect_past.yml";

export const dispatchConfigured = Boolean(process.env.GH_DISPATCH_TOKEN?.trim());

export async function dispatchCollect(source: string): Promise<{ ok: true; url: string } | { ok: false; reason: string } | null> {
  const token = process.env.GH_DISPATCH_TOKEN?.trim();
  if (!token) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main", inputs: { source } }),
      signal: AbortSignal.timeout(10_000),
    });
    // 204 가 정상. 본문이 없다.
    if (res.status === 204) return { ok: true, url: `https://github.com/${REPO}/actions/workflows/${WORKFLOW}` };
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `GitHub 응답 ${res.status}${text ? ` — ${text.slice(0, 160)}` : ""}` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
