/**
 * 저장한 기관(2026-11-27). "○○ 채용공고"로 찾아온 사람이 그 기관의 다음 공고를 놓치지 않게.
 *
 * 방문자의 절반이 기관 이름으로 채용을 찾아 들어오는데(다음·네이버 검색어 상위가 전부 "기관 + 채용"),
 * 한 번 보고 나가면 다음 공고를 알 길이 없었다. 기관을 저장해 두면 다시 왔을 때 그 사이 올라온 공고를 센다.
 *
 * 이 브라우저(localStorage)에만 둔다. 서버 표 saved_item 은 kind 가 p·job 만 받게 묶여 있어(check 제약)
 * 기관을 넣으려면 표를 고쳐야 한다. 계정으로 옮겨 다니게 하려면 그때 서버로 올린다.
 * 화면에서만 부른다(window 가 없으면 빈 목록).
 */

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

export function addOrg(name: string): boolean {
  const now = new Date().toISOString();
  return write([{ name, at: now, seen: now }, ...readOrgs().filter((o) => o.name !== name)]);
}

export function removeOrg(name: string): boolean {
  return write(readOrgs().filter((o) => o.name !== name));
}

/** 그 기관의 공고 목록을 봤다. 새 공고 표시를 지운다. */
export function markOrgSeen(name: string) {
  const list = readOrgs();
  if (!list.some((o) => o.name === name)) return;
  const now = new Date().toISOString();
  write(list.map((o) => (o.name === name ? { ...o, seen: now } : o)));
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
