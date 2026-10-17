import { unstable_cache } from "next/cache";
import { db, dbLive, dbConfigured } from "./db";
import { EVT_CATE, FCLT_CATE, LIFE_CYCLE, SVC_CATE, plainText, type AlioItem } from "./alioplus";

/**
 * 공공기관 사업·행사·시설을 DB 에서 읽는다.
 *
 * 화면이 알리오를 직접 부르고 있었다. 그쪽이 늦거나 막히면 화면에
 * "지금은 자료를 불러오지 못했습니다"만 남는다 — 실제로 그렇게 됐다.
 * 매일 받아 둔 agency_items 를 먼저 보고, 비었을 때만 직접 부른다.
 *
 * 2026-10-17: 생애주기(?life=03)·형태(?svc=)·갈래(?cate=) 조건도 저장분에서 푼다.
 * 전에는 코드 조건이 걸리면 저장분을 건너뛰고 알리오를 직접 불렀는데, 서버에서 그 호출이
 * 막혀 /agency?life=03 이 빈 화면이었다. 저장분에는 코드가 아니라 이름이 들어 있으니
 * 코드표(alioplus.ts)로 이름을 찾아 맞춘다. 사업의 분야(B06…)만은 저장분에 이름도 없어
 * 여전히 알리오를 직접 부르고, 그마저 안 되면 분야를 뺀 저장분을 보여 준다.
 */
export type AgencyKind = "business" | "event" | "facility";

const LIFE_BY_CODE = new Map(LIFE_CYCLE.map((l) => [l.code, l.label]));
const norm = (s: string) => s.replace(/[·ㆍ\s/]/g, "");

/**
 * 저장된 꼬리표를 사람 말로. 알리오의 lifeCycleNa 는 어떤 줄은 "청년", 어떤 줄은 "02,03,04" 로 온다.
 * "02,03" → 아동·청소년·청년, "아동청소년" → "아동·청소년". 같은 것은 한 번만.
 */
export function tidyTags(tags: string[]): string[] {
  const out: string[] = [];
  const add = (v: string) => { if (v && !out.includes(v)) out.push(v); };
  for (const t of tags) {
    if (/^\d{2}(,\d{2})*$/.test(t)) {
      for (const c of t.split(",")) { const l = LIFE_BY_CODE.get(c); if (l) add(l); }
      continue;
    }
    const life = LIFE_CYCLE.find((l) => norm(l.label) === norm(t));
    add(life ? life.label : t);
  }
  return out;
}

/** 코드 조건을 저장분의 이름과 맞춘다. 모르는 코드는 조건을 못 거니 아무것도 안 남긴다. */
export function matchesCodes(kind: AgencyKind, it: AlioItem, c: { life?: string; svc?: string; cate?: string }): boolean {
  if (c.life) { const l = LIFE_BY_CODE.get(c.life); if (!l || !it.tags.includes(l)) return false; }
  if (c.svc) { const s = SVC_CATE.find((x) => x.code === c.svc)?.label; if (!s || !it.tags.some((t) => norm(t) === norm(s))) return false; }
  if (c.cate) {
    // 행사·시설은 cate 칸에 분류 이름이 있다("체육시설", "교육/강연"). 사업은 없다 — 부르는 쪽이 알리오로 간다.
    const table = kind === "event" ? EVT_CATE : kind === "facility" ? FCLT_CATE : null;
    const label = table?.find((x) => x.code === c.cate)?.label;
    if (!label) return false;
    // 저장된 분류는 "시설 > 강당 > 강의교육실" 꼴. 마디마다 코드표 이름의 조각("강당", "강의실")과 견준다.
    const segs = (it.cate ?? "").split(">").map((s) => norm(s)).filter(Boolean);
    const cands = label.split(/[·ㆍ]/).map((s) => norm(s)).filter(Boolean);
    if (!segs.some((s) => cands.some((cd) => s === cd || s.includes(cd)))) return false;
  }
  return true;
}

async function load(
  kind: AgencyKind, sido?: string, q?: string,
): Promise<AlioItem[] | null> {
  if (!dbConfigured) return null;
  // 검색어 조회는 캐시에 남기지 않는다(아래 agencyFromStore). 검색 화면은 어차피 요청마다 그린다.
  let sel = (q?.trim() ? dbLive : db).from("agency_items").select("*").eq("kind", kind).limit(1200);
  if (sido) sel = sel.eq("sido", sido);
  if (q) sel = sel.ilike("title", `%${q}%`);
  const { data, error } = await sel;
  // 비었으면 null. 부르는 쪽이 "아직 안 받았구나" 하고 직접 부른다.
  if (error || !data?.length) return null;
  return data.map((r) => ({
    id: String(r.id),
    title: String(r.title ?? ""),
    org: r.org ?? null,
    cate: r.cate ?? null,
    target: plainText(r.target),
    desc: plainText(r.descr),
    address: r.address ?? null,
    start: r.start_date ?? null,
    end: r.end_date ?? null,
    url: r.url ?? null,
    tags: tidyTags((r.tags as string[] | null) ?? []),
  }));
}

/** 저장분을 통째로 캐시에서 읽는다(지역·검색어까지만). 조건마다 따로 여섯 시간 캐시한다. */
function loadCached(kind: AgencyKind, sido?: string, q?: string) {
  // 검색어가 있으면 캐시에 남기지 않는다. 검색어마다 저장이 하나씩 쌓이고(ISR Writes) 다시 쓰일 일은 드물다.
  if (q?.trim()) return load(kind, sido, q);
  const tag = `${kind}|${sido ?? ""}|`;
  return unstable_cache(() => load(kind, sido, q), ["agency-v2", tag], { revalidate: 21600 })();
}

/**
 * 저장분을 읽어 조건으로 거른다. 저장분이 아예 없으면 null — 부르는 쪽이 알리오를 직접 부른다.
 * 저장분으로 못 푸는 조건(사업의 분야 코드)이 있으면 역시 null 을 돌려 알리오로 가게 한다.
 * 조건은 맞는데 남는 것이 없으면 빈 배열(화면은 "조건에 맞는 것이 없습니다").
 */
export async function agencyFromStore(
  kind: AgencyKind,
  { sido, q, life, svc, cate, byCode }: {
    sido?: string; q?: string; life?: string; svc?: string; cate?: string;
    /** 예전 호출 모양. 값이 하나라도 있으면 저장분으로 못 푸는 조건으로 본다. */
    byCode?: (string | undefined)[];
  },
): Promise<AlioItem[] | null> {
  if (byCode?.some(Boolean)) return null;
  if (cate && kind === "business") return null;
  const rows = await loadCached(kind, sido, q);
  if (!rows) return null;
  if (!life && !svc && !cate) return rows;
  return rows.filter((it) => matchesCodes(kind, it, { life, svc, cate }));
}
