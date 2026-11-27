/**
 * 저장한 기관(2026-11-27). "○○ 채용공고"로 찾아온 사람이 그 기관의 다음 공고를 놓치지 않게.
 *
 * 방문자의 절반이 기관 이름으로 채용을 찾아 들어오는데(다음·네이버 검색어 상위가 전부 "기관 + 채용"),
 * 한 번 보고 나가면 다음 공고를 알 길이 없었다. 기관을 저장해 두면 다시 왔을 때 그 사이 올라온 공고를 센다.
 *
 * 브라우저(localStorage)와 서버(saved_item 의 kind org, sql/020) 두 곳에 둔다. 화면은 브라우저 목록으로 바로 그리고,
 * 서버에는 뒤따라 적는다 — 브라우저를 정리해도, 계정으로 다른 기기에서도 이어진다(syncOrgs 가 맞춘다).
 * 화면에서만 부른다(window 가 없으면 빈 목록).
 */
import { addItem, listItems, removeItem, seenOrg } from "./savedItems";

export type SavedOrg = {
  name: string;
  /** 저장한 때(ISO). */
  at: string;
  /** 이 기관의 공고를 마지막으로 본 때(ISO). 이 뒤에 들어온 공고가 "새 공고"다. */
  seen: string;
};

const KEY = "knara.orgs.v1";
const MAX = 20;
/** 목록이 바뀌면 같은 화면의 다른 칸(단추·띠)이 따라 고치게 알린다. */
export const ORGS_EVENT = "knara:orgs";

export function readOrgs(): SavedOrg[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is SavedOrg => x && typeof x.name === "string" && typeof x.at === "string" && typeof x.seen === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

function write(list: SavedOrg[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event(ORGS_EVENT));
    return true;
  } catch {
    return false; // 사생활 보호 창 등 저장이 막힌 브라우저
  }
}

export const hasOrg = (name: string) => readOrgs().some((o) => o.name === name);

// 아래 셋은 브라우저 목록을 먼저 고치고(바로 화면에 보이게), 서버에는 뒤따라 적는다. 서버에 못 적어도
// 이 브라우저에서는 그대로 쓰이고, 다음에 syncOrgs 가 다시 올린다.
export function addOrg(name: string): boolean {
  const now = new Date().toISOString();
  const ok = write([{ name, at: now, seen: now }, ...readOrgs().filter((o) => o.name !== name)]);
  if (ok) void addItem({ kind: "org", id: name, title: name, seen: now }).catch(() => false);
  return ok;
}

export function removeOrg(name: string): boolean {
  const ok = write(readOrgs().filter((o) => o.name !== name));
  if (ok) void removeItem("org", name).catch(() => false);
  return ok;
}

/** 그 기관의 공고 목록을 봤다. 새 공고 표시를 지운다. */
export function markOrgSeen(name: string) {
  const list = readOrgs();
  if (!list.some((o) => o.name === name)) return;
  const now = new Date().toISOString();
  write(list.map((o) => (o.name === name ? { ...o, seen: now } : o)));
  void seenOrg(name).catch(() => false);
}

let synced: Promise<void> | null = null;
/**
 * 서버(saved_item, kind org)와 이 브라우저의 목록을 맞춘다. 화면마다 한 번만.
 * 서버에 있는 것은 내려받고(계정으로 다른 기기에서 저장한 기관), 브라우저에만 있는 것은 올린다.
 * 본 때(seen)는 둘 가운데 늦은 쪽. 기기 열쇠가 없으면 서버 목록이 비어 브라우저 것만 남는다.
 */
export function syncOrgs(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  synced ??= (async () => {
    try {
      const server = (await listItems()).filter((s) => s.kind === "org");
      const local = readOrgs();
      const by = new Map<string, SavedOrg>();
      for (const s of server) by.set(s.item_id, { name: s.item_id, at: s.created_at, seen: s.seen_at ?? s.created_at });
      for (const o of local) {
        const x = by.get(o.name);
        if (!x) { by.set(o.name, o); void addItem({ kind: "org", id: o.name, title: o.name, seen: o.seen }).catch(() => false); }
        else if (Date.parse(o.seen) > Date.parse(x.seen)) by.set(o.name, { ...x, seen: o.seen });
      }
      const merged = [...by.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      if (JSON.stringify(merged) !== JSON.stringify(local)) write(merged);
    } catch {
      /* 서버를 못 읽으면 브라우저 목록 그대로 */
    }
  })();
  return synced;
}

export const orgHref = (name: string) => `/jobs/org/${encodeURIComponent(name)}`;

export type OrgNews = {
  name: string;
  /** seen 뒤에 들어온 공고 수(같이 올라온 나라일터·잡알리오 쌍은 한 번). */
  fresh: number;
  /** 지금 접수 중인 공고 수. */
  open: number;
  items: { id: string; title: string; end: string | null }[];
};

export async function fetchOrgNews(list: SavedOrg[]): Promise<OrgNews[]> {
  if (!list.length) return [];
  try {
    const r = await fetch("/api/orgs/news", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgs: list.map((o) => ({ name: o.name, since: o.seen })) }),
    });
    return r.ok ? ((await r.json()) as OrgNews[]) : [];
  } catch {
    return [];
  }
}
