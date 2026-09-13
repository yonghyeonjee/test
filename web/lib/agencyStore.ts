import { unstable_cache } from "next/cache";
import { db, dbConfigured } from "./db";
import type { AlioItem } from "./alioplus";

/**
 * 공공기관 사업·행사·시설을 DB 에서 읽는다.
 *
 * 화면이 알리오를 직접 부르고 있었다. 그쪽이 늦거나 막히면 화면에
 * "지금은 자료를 불러오지 못했습니다"만 남는다 — 실제로 그렇게 됐다.
 * 매일 받아 둔 agency_items 를 먼저 보고, 비었을 때만 직접 부른다.
 *
 * 다만 코드로 거르는 갈래(종류·생애주기·서비스)는 저장분에 그 코드가
 * 없다 — 이름만 들어 있다. 그런 조건이 걸리면 조용히 안 먹히는 대신
 * 저장분을 쓰지 않고 알리오를 직접 부른다. 지역과 검색어만 여기서 푼다.
 */
export type AgencyKind = "business" | "event" | "facility";

async function load(
  kind: AgencyKind, sido?: string, q?: string,
): Promise<AlioItem[] | null> {
  if (!dbConfigured) return null;
  let sel = db.from("agency_items").select("*").eq("kind", kind).limit(300);
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
    target: r.target ?? null,
    desc: r.descr ?? null,
    address: r.address ?? null,
    start: r.start_date ?? null,
    end: r.end_date ?? null,
    url: r.url ?? null,
    tags: (r.tags as string[] | null) ?? [],
  }));
}

/**
 * 저장분을 읽는다. 저장분으로 못 푸는 조건(byCode)이 걸려 있으면 바로 null —
 * 부르는 쪽이 알리오를 직접 부른다. 조건마다 따로 여섯 시간 캐시한다.
 */
export function agencyFromStore(
  kind: AgencyKind,
  { sido, q, byCode }: { sido?: string; q?: string; byCode?: (string | undefined)[] },
): Promise<AlioItem[] | null> {
  if (byCode?.some(Boolean)) return Promise.resolve(null);
  const tag = `${kind}|${sido ?? ""}|${q ?? ""}`;
  return unstable_cache(() => load(kind, sido, q), ["agency", tag], { revalidate: 21600 })();
}
