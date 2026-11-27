/**
 * 저장한 공고·사업(즐겨찾기) — 서버 보관.
 *
 * 저장 조건(lib/saved.ts)과 같은 기기 열쇠가 주인이다. 로그인하면 계정 열쇠로 이어지고,
 * 브라우저를 정리해도, 기기를 바꿔도(계정·복구 코드) 남는다. 이름·연락처는 받지 않는다.
 */
import { api, deviceKey } from "./saved";

export type SavedItem = {
  /** org: 저장한 기관(2026-11-27). item_id 가 기관 이름이고, 목록 화면은 lib/savedOrgs 가 따로 그린다. */
  kind: "p" | "job" | "org";
  item_id: string;
  title: string;
  sub: string | null;
  end_date: string | null;
  created_at: string;
  /** 기관만: 그 기관의 공고를 마지막으로 본 때. */
  seen_at?: string | null;
};

export async function listItems(): Promise<SavedItem[]> {
  const key = deviceKey();
  if (!key) return [];
  return (await api<SavedItem[]>("/api/saved/items", { key })) ?? [];
}

export async function addItem(it: { kind: SavedItem["kind"]; id: string; title: string; sub?: string | null; endDate?: string | null; seen?: string }) {
  const key = deviceKey();
  if (!key) return false;
  const r = await api<{ ok: boolean }>("/api/saved/items", {
    method: "POST", key,
    body: { action: "add", kind: it.kind, id: it.id, title: it.title, sub: it.sub ?? null, end: it.endDate ?? null, seen: it.seen },
  });
  return Boolean(r?.ok);
}

/** 저장한 기관의 공고 목록을 봤다(서버의 seen_at 을 지금으로). */
export async function seenOrg(name: string) {
  const key = deviceKey();
  if (!key) return false;
  const r = await api<{ ok: boolean }>("/api/saved/items", { method: "POST", key, body: { action: "seen", kind: "org", id: name } });
  return Boolean(r?.ok);
}

export async function removeItem(kind: SavedItem["kind"], id: string) {
  const key = deviceKey();
  if (!key) return false;
  const r = await api<{ ok: boolean }>("/api/saved/items", { method: "POST", key, body: { action: "remove", kind, id } });
  return Boolean(r?.ok);
}

export const itemHref = (it: Pick<SavedItem, "kind" | "item_id">) =>
  it.kind === "job" ? `/jobs/${encodeURIComponent(it.item_id)}`
    : it.kind === "org" ? `/jobs/org/${encodeURIComponent(it.item_id)}`
    : `/p/${encodeURIComponent(it.item_id)}`;

/** 마감이 지났나. 날짜만 비교(KST 기준은 서버가 아니라 보는 사람 시계). */
export function isClosed(it: Pick<SavedItem, "end_date">, today = new Date()) {
  if (!it.end_date) return false;
  const d = new Date(`${it.end_date}T23:59:59`);
  return d.getTime() < today.getTime();
}
