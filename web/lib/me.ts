/**
 * 이 브라우저의 사람이 지난번에 넣은 조건과 최근 본 공고. localStorage 에만 둔다.
 *
 * 서버로 보내지 않는다. 사는 곳·나이는 그 사람 것이고, 다음에 왔을 때 다시
 * 고르지 않게 하려는 것뿐이다. 읽기·쓰기 모두 실패해도 화면이 죽지 않게
 * try/catch 로 감싼다(사생활 모드, 저장 막힘).
 */
export type Me = {
  sido?: string;
  sigungu?: string;
  age?: number;
  emp?: string;
  hh?: string[];
  at: number;
};

export type Recent = {
  kind: "p" | "job";
  id: string;
  title: string;
  sub?: string;
  at: number;
};

const ME = "jw.me.v1";
const RECENT = "jw.recent.v1";
const RECENT_MAX = 12;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // 저장이 막힌 브라우저. 기억 못 할 뿐이다.
  }
}

export function readMe(): Me | null {
  const m = read<Me>(ME);
  return m && (m.sido || m.age) ? m : null;
}

export function writeMe(patch: Omit<Me, "at">) {
  write(ME, { ...patch, at: Date.now() });
}

export function clearMe() {
  try { localStorage.removeItem(ME); } catch { /* 무시 */ }
}

/** 조건을 첫 화면 주소로. "/?sido=…&age=…" */
export function meQuery(m: Me, extra: Record<string, string> = {}) {
  const q = new URLSearchParams();
  if (m.sido) q.set("sido", m.sido);
  if (m.sigungu) q.set("sigungu", m.sigungu);
  if (m.age) q.set("age", String(m.age));
  if (m.emp) q.set("emp", m.emp);
  for (const h of m.hh ?? []) q.append("hh", h);
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return `/?${q.toString()}`;
}

/** 사람 말로. "서울특별시 강남구 · 34세 · 재직 · 한부모·조손" */
export function meLabel(m: Me) {
  return [
    [m.sido, m.sigungu].filter(Boolean).join(" "),
    m.age ? `${m.age}세` : "",
    m.emp ?? "",
    ...(m.hh ?? []),
  ].filter(Boolean).join(" · ");
}

export function readRecent(): Recent[] {
  const list = read<Recent[]>(RECENT);
  return Array.isArray(list) ? list.filter((r) => r && r.id && r.title) : [];
}

export function pushRecent(r: Omit<Recent, "at">) {
  const rest = readRecent().filter((x) => !(x.kind === r.kind && x.id === r.id));
  write(RECENT, [{ ...r, at: Date.now() }, ...rest].slice(0, RECENT_MAX));
}

export function clearRecent() {
  try { localStorage.removeItem(RECENT); } catch { /* 무시 */ }
}

export function recentHref(r: Recent) {
  return r.kind === "job" ? `/jobs/${encodeURIComponent(r.id)}` : `/p/${encodeURIComponent(r.id)}`;
}
