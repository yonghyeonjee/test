import { unstable_cache } from "next/cache";
import { db, dbConfigured, type Detail } from "./db";
import { readAll } from "./pubJobs";

/**
 * 지역 간 비교(2026-11-17): 같은 사업을 다른 지역은 어떤 조건으로 하고 있나.
 *
 * 복지로·소상공인24 원문은 한 지역의 사업 한 건만 적는다. "출산장려금 지원"처럼 여러 시·군·구가 같은 이름으로
 * 따로 운영하는 사업은 나이·소득 기준과 지원 내용이 지역마다 다른데, 그 차이는 자료를 모아 나란히 놓아야 보인다.
 * 원문에 없는 내용이라 사업 쪽의 고유 자료로 싣는다.
 *
 * 이름이 조금씩 다른 것("…지원", "…지급", "… 사업")은 꼬리를 떼고 같은 사업으로 묶는다. 금액은 원문 글에서
 * 숫자를 뽑지 않는다 — 소득 기준 금액이나 첫째·둘째 금액을 잘못 집을 수 있다. 지원내용 앞부분을 그대로 옮긴다.
 */

export type Peer = {
  id: string;
  title: string;
  sido: string | null;
  sigungu: string | null;
  age_min: number | null;
  age_max: number | null;
  income_pct: number | null;
  /** 지원내용 앞부분(60자). */
  benefit: string;
  apply_end: string | null;
  is_always_on: boolean;
};

/** 묶는 열쇠. 괄호·연도·띄어쓰기와 끝의 "지원/지급/사업/제도"를 뗀다. 네 글자 미만이면 묶지 않는다(""). */
export function programKey(title: string): string {
  let t = title.replace(/[(（\[][^)）\]]*[)）\]]/g, "").replace(/20\d\d\s*년?도?/g, "").replace(/[\s·ㆍ,.\-]/g, "");
  for (let i = 0; i < 3; i++) t = t.replace(/(지원사업|지원금|지원|지급|사업|제도|안내)$/, "");
  return t.length >= 4 ? t : "";
}

const areaOf = (p: Pick<Peer, "sido" | "sigungu">) => `${p.sido ?? ""}/${p.sigungu ?? ""}`;

const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").replace(/^[\s○◦▶■□※\-·*]+/, "").trim();
  return t.length > n ? `${t.slice(0, n).trim()}…` : t;
};

async function load(): Promise<[string, Peer[]][]> {
  if (!dbConfigured) return [];
  type R = Omit<Peer, "id" | "benefit"> & { source_id: string; benefit_text: string | null; summary: string | null };
  const rows = await readAll<R>((from, to) => db
    .from("program_detail")
    .select("source_id,title,sido,sigungu,age_min,age_max,income_pct,benefit_text,summary,apply_end,is_always_on")
    .neq("status", "closed").in("source", ["bokjiro_local", "bokjiro_central", "sbiz24"])
    .order("source_id").range(from, to), 9000);
  const groups = new Map<string, Peer[]>();
  for (const r of rows) {
    const key = programKey(r.title);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push({
      id: r.source_id, title: r.title, sido: r.sido, sigungu: r.sigungu, age_min: r.age_min, age_max: r.age_max,
      income_pct: r.income_pct, benefit: clip(r.benefit_text ?? r.summary, 60), apply_end: r.apply_end, is_always_on: r.is_always_on,
    });
    groups.set(key, list);
  }
  // 두 지역 이상이 하는 사업만 남긴다(캐시 한 칸 2MB 한도). 한 묶음은 40건까지.
  return [...groups].filter(([, l]) => new Set(l.map(areaOf)).size >= 2).map(([k, l]): [string, Peer[]] => [k, l.slice(0, 40)]);
}

/** 여섯 시간마다 다시 묶는다. 못 읽으면 빈 목록(비교 칸이 빠질 뿐이다). */
const getGroups = unstable_cache(async () => {
  try {
    return await load();
  } catch {
    return [] as [string, Peer[]][];
  }
}, ["program-peers-v1"], { revalidate: 21600 });

export type ProgramCompare = {
  /** 이 사업을 뺀 다른 지역의 같은 사업. 같은 시·도가 앞에 온다. 최대 8건. */
  peers: Peer[];
  /** 이 사업을 포함해 같은 사업을 접수 중인 지역 수. */
  areas: number;
  /** 소득 기준(기준 중위소득 %)의 가장 낮은 값과 높은 값. 적은 지역이 둘 이상일 때만. */
  income: { min: number; max: number; n: number } | null;
};

export async function getProgramCompare(p: Detail): Promise<ProgramCompare | null> {
  const key = programKey(p.title);
  if (!key) return null;
  const all = new Map(await getGroups()).get(key);
  if (!all) return null;
  const mine = areaOf(p);
  // 같은 지역의 같은 이름(연도·차수만 다른 공고)은 비교가 아니다. 지역마다 하나만.
  const seen = new Set([mine]);
  const others: Peer[] = [];
  for (const x of all) {
    if (x.id === p.source_id || seen.has(areaOf(x))) continue;
    seen.add(areaOf(x));
    others.push(x);
  }
  if (others.length === 0) return null;
  others.sort((a, b) => Number(b.sido === p.sido) - Number(a.sido === p.sido) || areaOf(a).localeCompare(areaOf(b), "ko"));
  const pcts = [p.income_pct, ...others.map((x) => x.income_pct)].filter((v): v is number => v !== null);
  return {
    peers: others.slice(0, 8),
    areas: others.length + 1,
    income: pcts.length >= 2 ? { min: Math.min(...pcts), max: Math.max(...pcts), n: pcts.length } : null,
  };
}
