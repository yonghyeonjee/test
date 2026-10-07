import { fetchText } from "./orgCrawl";
import { normSido, sidoInText } from "./geo";
import { svcDb } from "./svcDb";

/**
 * 나라일터 공고 상세(apmView.do)에서 첨부파일과 몇 가지 칸을 읽어 둔다.
 *
 * 목록(gojobsSite)에는 제목·기관·날짜뿐이라 상세 화면의 "원문 보기" 가 나라일터 첫 화면으로 가고
 * 첨부파일도 없었다(2026-10-07 지적). 상세 주소는 목록의 fn_apmView(jobsecode, empmnsn) 가 만든다:
 *   apmView.do (060 → smbView.do, INJAE → apmViewNew.do) 에 empmnsn·searchJobsecode 를 실어 보낸다.
 *   GET 으로도 같은 화면이 온다(2026-10-07 서울 서버에서 확인).
 * 첨부는 gfn_fileDown(filenm, uuid, saveGbn) → /downFile.do 로 받는다. 세 값을 그대로 적어 두고,
 * 화면은 그 값으로 내려받기 주소를 만든다.
 *
 * 본문은 옮기지 않는다. 첨부 이름·근무지역·채용직급 같은 짧은 칸만 적는다. 하루 한 번, 접수 중인
 * 공고 가운데 아직 안 읽은 것만, 요청 사이 0.4초.
 */

const ORIGIN = "https://www.gojobs.go.kr";

/** fn_apmView 가 만드는 상세 주소. */
export function gojobsViewUrl(sys: string | null | undefined, id: string): string {
  const path = sys === "060" ? "smbView.do" : sys === "INJAE" ? "apmViewNew.do" : "apmView.do";
  return `${ORIGIN}/${path}?empmnsn=${encodeURIComponent(id)}&searchJobsecode=${encodeURIComponent(sys || "020")}`;
}

export type GojobsFile = { name: string; ext: string; uuid: string; path: string };
export type GojobsDetail = {
  files: GojobsFile[];
  /** 표의 칸들. 없으면 null. */
  grade: string | null;    // 채용직급
  workArea: string | null; // 근무지역
  disabled: string | null; // 장애인 채용 우대
  fetchedAt: string;
};

/** gfn_fileDown 의 세 인자로 내려받기 주소. GET 으로 열린다(2026-10-07 확인). */
export function gojobsFileUrl(f: GojobsFile): string {
  return `${ORIGIN}/downFile.do?filenm=${encodeURIComponent(f.name)}&uuid=${encodeURIComponent(f.uuid)}&saveGbn=${encodeURIComponent(f.path)}`;
}

const text = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

const unq = (s: string) => s.replace(/\\'/g, "'").replace(/\\"/g, '"');

/**
 * 상세 HTML 에서 첨부와 칸을 읽는다. 공고 표가 없으면 null(없는 공고·막힌 응답).
 *
 * 줄 모양(2026-10 확인):
 *   <th>첨부파일</th><td><p class="download"><a href="javascript:gfn_fileDown('공고문.pdf','5983…','employ/인천남동우체국')">공고문.pdf</a></p>…
 *   <th>근무지역</th><td>…</td>
 */
export function parseDetail(html: string): GojobsDetail | null {
  if (!/gfn_fileDown|공고명/.test(html)) return null;
  const files: GojobsFile[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/gfn_fileDown\(\s*'((?:\\'|[^'])*)'\s*,\s*'([^']*)'\s*,\s*'((?:\\'|[^'])*)'\s*\)/g)) {
    const name = text(unq(m[1])), uuid = m[2].trim(), path = unq(m[3]).trim();
    if (!name || !uuid || seen.has(uuid)) continue;
    seen.add(uuid);
    files.push({ name, ext: (name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "").toLowerCase(), uuid, path });
  }
  const cellAfter = (label: string) => {
    const m = new RegExp(`<th[^>]*>\\s*${label}\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`).exec(html);
    const v = m ? text(m[1]) : "";
    return v && v !== "-" ? v.slice(0, 120) : null;
  };
  return {
    files, grade: cellAfter("채용직급"), workArea: cellAfter("근무지역"), disabled: cellAfter("장애인 채용 우대"),
    fetchedAt: new Date().toISOString(),
  };
}

export type StepResult = { step: string; done: number; found: number; errors: number; more: boolean; notes: string[] };

const PAUSE_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 접수 중인 나라일터 공고 가운데 상세를 아직 안 읽은 것을 차례로 읽는다. 예산(기본 30초) 안에서.
 * 읽은 것은 raw.gojobs 에 적힌다. 실패도 적어(gojobs.err) 같은 공고를 날마다 두드리지 않는다 — 일주일 뒤 다시.
 */
export async function gojobsDetailStep(budgetMs = 30_000): Promise<StepResult> {
  const t0 = Date.now();
  const res: StepResult = { step: "gojobs_detail", done: 0, found: 0, errors: 0, more: false, notes: [] };
  const db = svcDb();
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  // 아직 안 읽은 것(raw.gojobs 없음)과, 실패했던 것 가운데 일주일 지난 것. 마감이 가까운 순.
  const { data, error } = await db
    .from("job_posts").select("id,source_id,title,org,region,raw")
    .eq("source", "gojobs").gte("end_date", today)
    .or(`raw->gojobs.is.null,and(raw->gojobs->>err.not.is.null,raw->gojobs->>fetchedAt.lt.${weekAgo})`)
    .order("end_date", { ascending: true }).limit(400);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; source_id: string; title: string; org: string | null; region: string | null; raw: Record<string, unknown> | null }[];

  for (const r of rows) {
    if (Date.now() - t0 > budgetMs) { res.more = true; break; }
    const sys = (r.raw?.sys as string | undefined) ?? "020";
    const patch: Record<string, unknown> = {};
    try {
      const g = await fetchText(gojobsViewUrl(sys, r.source_id), 15_000);
      await sleep(PAUSE_MS);
      if (!g.ok) throw new Error(`상세 ${g.status}`);
      const d = parseDetail(g.text);
      if (!d) throw new Error("공고 표를 못 찾음");
      patch.raw = { ...(r.raw ?? {}), gojobs: d };
      patch.url = patch.url ?? gojobsViewUrl(sys, r.source_id);
      // 근무지역 칸으로 비어 있던 시·도를 채운다. 지역별 목록·지도가 이 칸을 본다.
      if (!r.region && d.workArea) {
        const sido = normSido(d.workArea.split(/[\s,·/]+/)[0]) ?? sidoInText(d.workArea);
        if (sido) patch.region = sido;
      }
      if (d.files.length) res.found++;
    } catch (e) {
      res.errors++;
      patch.raw = { ...(r.raw ?? {}), gojobs: { files: [], grade: null, workArea: null, disabled: null, fetchedAt: new Date().toISOString(), err: (e instanceof Error ? e.message : String(e)).slice(0, 120) } };
    }
    const { error: eu } = await db.from("job_posts").update(patch).eq("id", r.id);
    if (eu) res.notes.push(`${r.id}: ${eu.message}`);
    res.done++;
  }
  res.notes.unshift(`남은 공고 ${Math.max(0, rows.length - res.done)}${rows.length >= 400 ? "+" : ""}`);
  if (res.notes.length > 20) res.notes.length = 20;
  return res;
}
