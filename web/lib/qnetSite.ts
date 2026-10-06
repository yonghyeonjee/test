import { allowed, fetchText } from "./orgCrawl";

/**
 * 큐넷 누리집의 종목별 시험 일정·수험자 동향.
 *
 * 공공데이터 API 는 등급(기사·기능사…) 단위의 올해 회차만 준다. "이 종목은 어느 회차를 치르나",
 * "지난해 몇 명이 봐서 몇 명이 붙었나" 는 큐넷 누리집의 종목 안내 화면에만 있다. 두 화면을 읽는다.
 *
 *   일정  crf005.do?id=crf00503s02&jmCd=…   올해 회차 표. 국가기술자격 표(7칸: 구분·필기접수·필기시험·
 *         필기합격·실기접수·실기시험·최종합격)와 국가전문자격 표(7칸: 구분·접수·서류·시험·의견·정답·합격)가 다르다.
 *         해를 고르는 요청 항목이 없다(implYy 따위를 붙여도 올해만 온다). 그래서 해마다 쌓아 둔다.
 *   통계  crf005.do?id=crf00504s01&statisYy=…&implSeq=1|2&jmCd=…   한 해·한 단계(1 필기, 2 실기)의
 *         접수자·응시자·합격자. 남자·여자 두 줄로 와서 더한다. 공단이 시행하지 않는 종목은 "집계 결과가 없습니다".
 *
 * 둘 다 robots.txt 가 허용한다(2026-10 확인). 서울 서버에서 읽고(외국 IP 차단), 요청 사이 0.35초 쉰다.
 * 글은 옮기지 않는다 — 날짜와 숫자만 적는다.
 */

const ORIGIN = "https://www.q-net.or.kr";

export const schedUrl = (code: string) =>
  `${ORIGIN}/crf005.do?id=crf00503s02&gSite=Q&gId=&jmCd=${encodeURIComponent(code)}&jmInfoDivCcd=B0&jmNm=x&seriesCd=67`;

export const statsUrl = (code: string, year: number, stage: "필기" | "실기") =>
  `${ORIGIN}/crf005.do?id=crf00504s01&gSite=Q&gId=&statisYy=${year}&implSeq=${stage === "필기" ? 1 : 2}` +
  `&trendDiv=01&trendDetail=1&examInstiCd=&jmCd=${encodeURIComponent(code)}&jmNm=x`;

/** 사람이 큐넷에서 같은 표를 보는 주소(화면 링크용). */
export const schedPageUrl = (code: string) => `${ORIGIN}/crf005.do?id=crf00503s02&jmCd=${encodeURIComponent(code)}`;

// ── HTML 읽기 ───────────────────────────────────────────

const DATE_RE = /(20\d{2})\.(\d{2})\.(\d{2})/g;

const text = (html: string) =>
  html.replace(/<!--[\s\S]*?-->/g, " ").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim();

/** 칸 하나에서 날짜를 꺼낸다. "빈자리" 뒤는 추가접수라 뺀다. 날짜가 하나면 시작=끝. */
function dates(cell: string): { start: string | null; end: string | null } {
  const t = text(cell);
  const main = t.split(/빈자리/)[0];
  const found = Array.from(main.matchAll(DATE_RE)).map((m) => `${m[1]}-${m[2]}-${m[3]}`)
    .filter((iso) => !Number.isNaN(Date.parse(iso)));
  if (!found.length) return { start: null, end: null };
  return { start: found[0], end: found[found.length - 1] };
}

function rows(tbody: string): string[][] {
  return Array.from(tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi))
    .map((m) => Array.from(m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((c) => c[1]));
}

export type SchedRow = {
  id: string; code: string; year: number; label: string; stage: string | null;
  reg_start: string | null; reg_end: string | null;
  exam_start: string | null; exam_end: string | null;
  pass_date: string | null;
  prac_reg_start: string | null; prac_reg_end: string | null;
  prac_exam_start: string | null; prac_exam_end: string | null;
  final_pass: string | null;
};

/**
 * 일정 표를 줄 단위로 읽는다. 표가 없으면(일정 미공고·없는 종목) 빈 배열.
 *
 * 머리글의 낱말로 칸의 뜻을 정한다. 칸 순서를 믿지 않는다 — 두 표의 순서가 다르고,
 * 큐넷이 칸을 더하거나 빼면 순서로 읽은 값이 통째로 어긋난다.
 */
export function parseSched(html: string, code: string): SchedRow[] {
  // "시험일정" 제목 뒤의 첫 표.
  const at = html.indexOf("시험일정</b>");
  const from = at >= 0 ? at : 0;
  const table = /<table[\s\S]*?<\/table>/i.exec(html.slice(from))?.[0];
  if (!table) return [];
  const thead = /<thead>([\s\S]*?)<\/thead>/i.exec(table)?.[1] ?? "";
  const tbody = /<tbody>([\s\S]*?)<\/tbody>/i.exec(table)?.[1] ?? "";
  const heads = rows(thead)[0]?.map(text) ?? [];
  if (heads.length < 3) return [];

  type Role = "label" | "reg" | "exam" | "pass" | "pracReg" | "pracExam" | "finalPass" | null;
  const role = (h: string): Role => {
    if (h.startsWith("구분")) return "label";
    if (/필기원서접수|^접수기간/.test(h)) return "reg";
    if (/필기시험|^시험일정/.test(h)) return "exam";
    if (/필기합격|^합격자 ?발표/.test(h)) return "pass";
    if (/실기원서접수/.test(h)) return "pracReg";
    if (/실기시험/.test(h)) return "pracExam";
    if (/최종합격자/.test(h)) return "finalPass";
    return null;
  };
  const roles = heads.map(role);
  if (!roles.includes("label") || !roles.includes("exam")) return [];

  const out: SchedRow[] = [];
  for (const cells of rows(tbody)) {
    if (cells.length !== heads.length) continue;
    const get = (r: Role) => { const i = roles.indexOf(r); return i >= 0 ? cells[i] : ""; };
    const labelFull = text(get("label"));
    const ym = /^(20\d{2})년\s*/.exec(labelFull);
    if (!ym) continue;
    const year = Number(ym[1]);
    let label = labelFull.slice(ym[0].length).trim();
    // 전문자격 표는 "25회 필기" 처럼 단계가 구분 칸에 붙어 온다.
    const st = /(필기|실기|면접|1차|2차|3차)$/.exec(label)?.[1] ?? null;
    if (st) label = label.slice(0, -st.length).trim();
    const reg = dates(get("reg")), exam = dates(get("exam")), pass = dates(get("pass"));
    const pReg = dates(get("pracReg")), pExam = dates(get("pracExam")), fin = dates(get("finalPass"));
    if (!exam.start && !reg.start) continue;
    const id = `${code}|${year}|${label}${st ? ` ${st}` : ""}`;
    out.push({
      id, code, year, label, stage: st,
      reg_start: reg.start, reg_end: reg.end, exam_start: exam.start, exam_end: exam.end, pass_date: pass.start,
      prac_reg_start: pReg.start, prac_reg_end: pReg.end, prac_exam_start: pExam.start, prac_exam_end: pExam.end,
      final_pass: fin.start,
    });
  }
  return out;
}

export type StatsRow = {
  id: string; code: string; year: number; stage: "필기" | "실기";
  applicants: number | null; takers: number | null; passers: number | null; pass_rate: number | null;
};

/** 통계 표. 남자·여자 줄을 더한다. 집계가 없으면 숫자가 전부 null 인 줄(확인했다는 표시). */
export function parseStats(html: string, code: string, year: number, stage: "필기" | "실기"): StatsRow {
  const empty: StatsRow = { id: `${code}|${year}|${stage}`, code, year, stage, applicants: null, takers: null, passers: null, pass_rate: null };
  const tbody = /<tbody>([\s\S]*?)<\/tbody>/i.exec(html)?.[1];
  if (!tbody || /집계 결과가 없습니다/.test(tbody)) return empty;
  const num = (s: string) => { const n = Number(text(s).replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
  let applicants = 0, takers = 0, passers = 0, any = false;
  for (const c of rows(tbody)) {
    if (c.length < 6) continue;
    any = true;
    applicants += num(c[1]); takers += num(c[2]); passers += num(c[4]);
  }
  if (!any) return empty;
  return { ...empty, applicants, takers, passers, pass_rate: takers ? Math.round((passers / takers) * 1000) / 10 : null };
}

// ── 수집 ──────────────────────────────────────────────

import { svcDb } from "./svcDb";

export type StepResult = { step: string; done: number; found: number; errors: number; more: boolean; notes: string[] };

const PAUSE_MS = 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 일정은 일주일마다 다시, 통계는 해가 바뀐 뒤 한 번만(300일). */
const SCHED_EVERY_MS = 6 * 86_400_000;
const STATS_EVERY_MS = 300 * 86_400_000;
/** 통계를 받을 해. 큐넷은 지난해까지만 집계를 낸다(2026-10 기준 2025 까지). */
export const statsYears = (today = new Date()) => [1, 2, 3].map((d) => today.getFullYear() - d);

/**
 * 한 번 부르면 예산(기본 40초) 안에서 종목을 차례로 읽는다. 남으면 more=true.
 * 처음 한 번은 종목 613개 × (일정 1 + 통계 6) 요청이라 여러 번 불러야 끝난다. 그 뒤로는 주마다 일정만.
 */
export async function qnetSiteStep(budgetMs = 40_000): Promise<StepResult> {
  const t0 = Date.now();
  const res: StepResult = { step: "qnet", done: 0, found: 0, errors: 0, more: false, notes: [] };
  const db = svcDb();

  if (!(await allowed(schedUrl("1320")))) { res.notes.push("robots.txt 가 막음"); return res; }

  // 상태 줄이 없는 종목을 채운다(새 종목·첫 실행).
  const { data: items, error: e1 } = await db.from("license_items").select("code").order("code");
  if (e1) throw new Error(e1.message);
  const { data: states, error: e2 } = await db.from("exam_site_state").select("code,sched_at,stats_at,fails");
  if (e2) throw new Error(e2.message);
  const have = new Set((states ?? []).map((s) => s.code as string));
  const missing = (items ?? []).map((i) => i.code as string).filter((c) => c && !have.has(c));
  if (missing.length) {
    const { error } = await db.from("exam_site_state").upsert(missing.map((code) => ({ code })), { onConflict: "code", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  const now = Date.now();
  const stale = (iso: string | null, every: number) => !iso || now - Date.parse(iso) > every;
  const todo = [
    ...missing.map((code) => ({ code, sched_at: null as string | null, stats_at: null as string | null, fails: 0 })),
    ...(states ?? []).map((s) => ({ code: s.code as string, sched_at: s.sched_at as string | null, stats_at: s.stats_at as string | null, fails: (s.fails as number) ?? 0 })),
  ]
    .filter((s) => s.fails < 5 && (stale(s.sched_at, SCHED_EVERY_MS) || stale(s.stats_at, STATS_EVERY_MS)))
    // 한 번도 안 읽은 것 먼저.
    .sort((a, b) => (a.sched_at ?? "").localeCompare(b.sched_at ?? ""));

  const years = statsYears();
  for (const s of todo) {
    if (Date.now() - t0 > budgetMs) { res.more = true; break; }
    const patch: Record<string, unknown> = {};
    try {
      if (stale(s.sched_at, SCHED_EVERY_MS)) {
        const r = await fetchText(schedUrl(s.code), 15_000);
        await sleep(PAUSE_MS);
        if (!r.ok) throw new Error(`일정 ${r.status}`);
        const rows = parseSched(r.text, s.code);
        if (rows.length) {
          // 올해 줄은 큐넷 표 그대로 다시 쓴다(회차가 빠지거나 이름이 바뀔 수 있다). 지난해 줄은 둔다.
          const yrs = Array.from(new Set(rows.map((x) => x.year)));
          const { error: ed } = await db.from("exam_sched").delete().eq("code", s.code).in("year", yrs);
          if (ed) throw new Error(ed.message);
          const { error: ei } = await db.from("exam_sched").upsert(rows.map((x) => ({ ...x, fetched_at: new Date().toISOString() })), { onConflict: "id" });
          if (ei) throw new Error(ei.message);
          res.found += rows.length;
        }
        patch.sched_at = new Date().toISOString();
      }
      if (stale(s.stats_at, STATS_EVERY_MS)) {
        const { data: got, error: eg } = await db.from("exam_stats").select("id").eq("code", s.code);
        if (eg) throw new Error(eg.message);
        const haveIds = new Set((got ?? []).map((g) => g.id as string));
        for (const y of years) for (const st of ["필기", "실기"] as const) {
          if (haveIds.has(`${s.code}|${y}|${st}`)) continue;
          if (Date.now() - t0 > budgetMs + 10_000) break;
          const r = await fetchText(statsUrl(s.code, y, st), 15_000);
          await sleep(PAUSE_MS);
          if (!r.ok) throw new Error(`통계 ${y} ${st} ${r.status}`);
          const row = parseStats(r.text, s.code, y, st);
          const { error: es } = await db.from("exam_stats").upsert({ ...row, fetched_at: new Date().toISOString() }, { onConflict: "id" });
          if (es) throw new Error(es.message);
          haveIds.add(row.id);
          if (row.takers) res.found++;
        }
        // 여섯 칸을 다 채웠을 때만 끝난 것으로 본다. 예산에 걸려 멈췄으면 다음 번에 이어서.
        if (years.every((y) => haveIds.has(`${s.code}|${y}|필기`) && haveIds.has(`${s.code}|${y}|실기`))) patch.stats_at = new Date().toISOString();
      }
      patch.fails = 0; patch.last_error = null;
    } catch (e) {
      res.errors++;
      patch.fails = s.fails + 1;
      patch.last_error = (e instanceof Error ? e.message : String(e)).slice(0, 200);
      // 실패도 읽은 것으로 쳐서 같은 종목에 계속 매달리지 않게 한다. 다음 주에 다시.
      patch.sched_at = patch.sched_at ?? new Date().toISOString();
    }
    const { error: eu } = await db.from("exam_site_state").update(patch).eq("code", s.code);
    if (eu) res.notes.push(`state ${s.code}: ${eu.message}`);
    res.done++;
  }
  if (res.notes.length > 20) res.notes.length = 20;
  res.notes.unshift(`남은 종목 ${Math.max(0, todo.length - res.done)}`);
  return res;
}
