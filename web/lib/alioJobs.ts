import { normSido } from "./geo";
import { allowed, fetchText } from "./orgCrawl";
import { svcDb } from "./svcDb";

/**
 * 잡알리오(공공기관 채용정보시스템, job.alio.go.kr) 채용 목록.
 *
 * 공공기관(공기업·준정부기관·기타공공기관)은 나라일터가 아니라 잡알리오에 공고를 올리는 곳이 많다.
 * 목록 화면(/recruit.do?pageNo=N, 한 쪽 10건)을 읽는다. robots.txt 가 허용하고, 외국 IP 는 막혀 있어
 * 서울 서버에서만 돈다. 공공데이터포털에 같은 자료의 API(기획재정부_공공기관 채용정보)가 있는데,
 * 우리 키가 아직 그 API 에 등록돼 있지 않다. 등록되면 그쪽으로 옮긴다.
 *
 * job_posts 에 source='alio', source_id='a'+idx 로 넣는다(나라일터 번호와 겹치지 않게 a 를 붙인다).
 * 나라일터에도 올라온 같은 공고(같은 제목)는 넣지 않는다.
 */

const BASE = "https://job.alio.go.kr";
const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, " ").trim();

export type AlioRow = {
  idx: string; title: string; org: string; area: string | null; kind: string | null;
  reg: string | null; end: string | null;
};

/** 목록 표의 한 줄: 체크칸(idx) | 번호 | 제목 | 기관명 | 근무지 | 고용형태 | 등록일 | 마감일(D-n) | 상태 */
export function parseAlioList(html: string): AlioRow[] {
  const out: AlioRow[] = [];
  for (const tr of html.split(/<tr[\s>]/i).slice(1)) {
    const idx = /recruitview\.do\?idx=(\d+)/.exec(tr)?.[1];
    if (!idx) continue;
    const tds = tr.split(/<\/td>/i).map((c) => c.replace(/^[\s\S]*?<td[^>]*>/i, ""));
    const cells = tds.map(strip);
    // 제목 칸은 링크가 든 칸. 그 뒤로 기관명·근무지·고용형태·등록일·마감일.
    const ti = tds.findIndex((c) => /recruitview\.do/.test(c));
    if (ti < 0) continue;
    const title = cells[ti];
    const [org, area, kind, regRaw, endRaw] = cells.slice(ti + 1, ti + 6);
    const reg = /(20\d{2})\.(\d{2})\.(\d{2})/.exec(regRaw ?? "");
    const end = /(\d{2})\.(\d{2})\.(\d{2})/.exec(endRaw ?? "");
    if (!title || !org) continue;
    out.push({
      idx, title: title.slice(0, 300), org: org.slice(0, 200), area: area || null, kind: kind || null,
      reg: reg ? `${reg[1]}-${reg[2]}-${reg[3]}` : null,
      end: end ? `20${end[1]}-${end[2]}-${end[3]}` : null,
    });
  }
  return out;
}

const norm = (t: string) => t.replace(/[\s\[\]()「」『』"'·ㆍ.,\-]/g, "");

// 서버 프로세스 하나가 오래 산다. 처음 전체를 받을 때 이어 받을 쪽 번호를 여기 둔다(재시작하면 처음부터).
let fullCursor = 1;

export type AlioResult = { step: string; done: number; found: number; errors: number; more: boolean; notes: string[] };

/**
 * mode=new  첫 쪽부터 읽다가 이미 다 있는 쪽을 만나면 멈춘다(매일).
 * mode=full 전체를 끝까지(처음 한 번, 또는 빠진 것을 메울 때). 부르는 쪽이 more 가 false 일 때까지 다시 부른다.
 */
export async function alioStep(mode: "new" | "full", budgetMs = 40_000): Promise<AlioResult> {
  const until = Date.now() + budgetMs;
  const db = svcDb();
  const res: AlioResult = { step: `alio_${mode}`, done: 0, found: 0, errors: 0, more: false, notes: [] };
  if (!(await allowed(`${BASE}/recruit.do`))) { res.notes.push("robots.txt 가 막음"); return res; }
  let page = mode === "full" ? fullCursor : 1;
  while (Date.now() < until) {
    const r = await fetchText(`${BASE}/recruit.do?pageNo=${page}`, 15_000);
    if (!r.ok) { res.errors++; res.notes.push(`${page}쪽 ${r.status}`); break; }
    const rows = parseAlioList(r.text);
    if (!rows.length) { if (mode === "full") fullCursor = 1; break; } // 끝

    const ids = rows.map((x) => `a${x.idx}`);
    const have = await db.from("job_posts").select("source_id").eq("source", "alio").in("source_id", ids);
    const known = new Set(((have.data ?? []) as { source_id: string }[]).map((x) => x.source_id));
    const fresh = rows.filter((x) => !known.has(`a${x.idx}`));
    if (mode === "new" && !fresh.length) break;

    // 나라일터에 같은 제목이 이미 있으면 넣지 않는다(같은 공고를 두 번 보이지 않게).
    let dup = new Set<string>();
    if (fresh.length) {
      const g = await db.from("job_posts").select("title").eq("source", "gojobs").in("title", fresh.map((x) => x.title));
      dup = new Set(((g.data ?? []) as { title: string }[]).map((x) => norm(x.title)));
    }
    const now = new Date().toISOString();
    const put = fresh.filter((x) => !dup.has(norm(x.title))).map((x) => ({
      id: `alio:a${x.idx}`, source: "alio", source_id: `a${x.idx}`,
      title: x.title, org: x.org, region: normSido(x.area) ?? x.area, hire: "공공", recruit: x.kind,
      reg_date: x.reg, start_date: x.reg, end_date: x.end,
      url: `${BASE}/recruitview.do?idx=${x.idx}`, raw: { from: "job.alio.go.kr", area: x.area, kind: x.kind },
      fetched_at: now,
    }));
    if (put.length) {
      const up = await db.from("job_posts").upsert(put, { onConflict: "id" });
      if (up.error) { res.errors++; res.notes.push(up.error.message.slice(0, 160)); break; }
      res.found += put.length;
    }
    res.done++;
    page++;
    if (mode === "full") fullCursor = page;
    await new Promise((ok) => setTimeout(ok, 400)); // 한 쪽에 0.4초 쉬어 간다
  }
  res.more = mode === "full" && fullCursor > 1 && res.errors === 0;
  res.notes.push(`마지막 쪽 ${page}`);
  return res;
}
