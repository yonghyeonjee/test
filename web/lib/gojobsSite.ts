/**
 * 나라일터 웹사이트를 직접 읽어 오는 길을 살펴본다.
 *
 * 공공데이터포털 API(PblJobService)는 오래된 것부터 주고 최신은 2,901쪽
 * 뒤에 있는데, 그 깊이의 쪽이 한 번도 응답하지 않았다. 사이트 목록은
 * 최신이 1쪽에 있으니 그쪽이 되면 훨씬 낫다.
 *
 * 다만 남의 사이트를 긁는 일이라 지킬 것을 먼저 지킨다.
 *  - robots.txt 를 먼저 읽고, 막아 두었으면 긁지 않는다.
 *  - 우리가 누구인지 밝히는 User-Agent 를 보낸다.
 *  - 하루 한 번, 앞쪽 몇 쪽만 읽는다. 과거 29만 건을 훑지 않는다.
 *
 * 이 파일은 지금은 "볼 수 있는지"만 확인한다. 실제 파싱은 아래 점검
 * 결과(진짜 HTML 모양)를 보고 나서 붙인다 — 안 보고 짐작으로 쓰면
 * 항목 이름을 틀렸던 지난번을 되풀이하게 된다.
 */

const BASE = "https://www.gojobs.go.kr";
export const LIST_URL =
  `${BASE}/apmList.do?menuNo=401&mngrMenuYn=N&selMenuNo=400&upperMenuNo=`;

const UA = "NarajiwonBot/1.0 (+https://jiwon.knowhow-it.com; 공공채용 공고 안내)";

export type SiteProbe = {
  step: string;
  ok: boolean;
  detail: string;
  ms: number;
};

async function get(url: string, ms = 15_000) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      signal: AbortSignal.timeout(ms),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, type: res.headers.get("content-type") ?? "", text, ms: Date.now() - t0 };
  } catch (e) {
    return {
      ok: false, status: 0, type: "", text: "",
      ms: Date.now() - t0,
      err: e instanceof Error ? (e.name === "TimeoutError" ? `${ms / 1000}초 안에 응답 없음` : `${e.name}: ${e.message}`) : String(e),
    };
  }
}

/** robots.txt 에서 우리에게 걸리는 줄만 뽑는다. */
function robotsVerdict(txt: string) {
  const lines = txt.split(/\r?\n/).map((l) => l.trim());
  const blocks: { agents: string[]; rules: string[] }[] = [];
  let cur: { agents: string[]; rules: string[] } | null = null;
  for (const l of lines) {
    if (/^user-agent:/i.test(l)) {
      const a = l.split(":")[1].trim();
      if (cur && cur.rules.length) { blocks.push(cur); cur = null; }
      cur = cur ?? { agents: [], rules: [] };
      cur.agents.push(a);
    } else if (/^(dis)?allow:/i.test(l) && cur) {
      cur.rules.push(l);
    }
  }
  if (cur) blocks.push(cur);
  const mine = blocks.filter((b) => b.agents.some((a) => a === "*" || /narajiwon/i.test(a)));
  const rules = mine.flatMap((b) => b.rules);
  const blocked = rules.some((r) => {
    const m = r.match(/^disallow:\s*(\S*)/i);
    if (!m) return false;
    const path = m[1];
    return path === "/" || (path && "/apmList.do".startsWith(path));
  });
  return { blocked, rules: rules.length ? rules.join(" | ") : "우리에게 걸리는 규칙 없음" };
}

/** HTML 의 뼈대를 요약한다. 파서를 쓰려면 진짜 모양을 봐야 한다. */
function outline(html: string) {
  const count = (re: RegExp) => (html.match(re) ?? []).length;
  const heads = [...html.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
    .map((m) => m[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 15);
  const rows = [...html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  // 머리글 줄이 아니라 실제 자료가 든 첫 줄을 고른다.
  const body = rows.find((r) => /<td/i.test(r));
  return [
    `길이 ${html.length.toLocaleString()}자`,
    `table ${count(/<table[^>]*>/gi)} · tr ${rows.length} · li ${count(/<li[^>]*>/gi)}`,
    heads.length ? `표 머리글: ${heads.join(" / ")}` : "표 머리글 없음",
    body ? `첫 자료 줄:\n${body.replace(/\s+/g, " ").slice(0, 1200)}` : "td 가 든 줄을 못 찾음",
  ].join("\n");
}

/**
 * 사이트에서 받아올 수 있는지 한 번에 본다.
 * robots.txt → 목록 1쪽 → 뼈대 요약 순으로 보고, 막혀 있으면 거기서 멈춘다.
 */
export async function probeSite(): Promise<SiteProbe[]> {
  const out: SiteProbe[] = [];

  const rb = await get(`${BASE}/robots.txt`, 10_000);
  if (!rb.ok) {
    out.push({
      step: "robots.txt",
      ok: false,
      detail: "err" in rb ? rb.err! : `응답 ${rb.status} — robots.txt 가 없으면 보통 전체 허용으로 봅니다.`,
      ms: rb.ms,
    });
  } else {
    const v = robotsVerdict(rb.text);
    out.push({
      step: "robots.txt",
      ok: !v.blocked,
      detail: v.blocked
        ? `막혀 있습니다. 긁지 않습니다. → ${v.rules}`
        : `허용. ${v.rules}`,
      ms: rb.ms,
    });
    if (v.blocked) return out;
  }

  const page = await get(LIST_URL, 20_000);
  if (!page.ok) {
    out.push({
      step: "목록 1쪽",
      ok: false,
      detail: "err" in page ? page.err! : `응답 ${page.status}`,
      ms: page.ms,
    });
    return out;
  }
  out.push({ step: "목록 1쪽", ok: true, detail: `응답 ${page.status} · ${page.type}`, ms: page.ms });
  out.push({ step: "HTML 뼈대", ok: true, detail: outline(page.text), ms: 0 });
  return out;
}
