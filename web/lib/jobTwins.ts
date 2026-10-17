/**
 * 같은 공고가 나라일터와 잡알리오에 둘 다 올라온 것("쌍둥이")을 목록에서 하나로.
 *
 * 공공기관 공고는 두 곳에 같이 올라오는 일이 많다. 잡알리오를 받을 때 나라일터 제목을 보고 거르지만
 * (lib/alioJobs.ts), 나라일터 쪽이 하루이틀 늦게 들어오면 못 거른다 — 2026-10-17 에 접수 중 잡알리오
 * 305건 중 25건이 그랬다. 그래서 읽을 때 한 번 더 거른다: 등록일·마감일이 같고 제목이 같거나 한쪽이
 * 다른 쪽을 품으면 잡알리오 쪽을 뺀다(나라일터 쪽에 첨부·요약이 붙는다). 잡알리오 번호는 a 로 시작한다.
 * 같은 결과 묶음 안에서만 견주므로 DB 를 더 부르지 않는다.
 */
const norm = (t: string) => t.replace(/[\s\[\]()「」『』"'·ㆍ.,\-_]/g, "").toLowerCase();

export type Twinable = { id: string; title: string; reg?: string | null; end?: string | null };

export const isAlioId = (id: string) => id.startsWith("a");

/** 두 공고가 같은 공고인지(등록일·마감일이 같고 제목이 같거나 한쪽이 품음). 출처는 보지 않는다. */
export function isTwin(a: Twinable, b: Twinable): boolean {
  if (a.id === b.id || (a.reg ?? "") !== (b.reg ?? "") || (a.end ?? "") !== (b.end ?? "")) return false;
  const x = norm(a.title), y = norm(b.title);
  return x === y || (x.length >= 8 && y.includes(x)) || (y.length >= 8 && x.includes(y));
}

export function dropAlioTwins<T>(rows: T[], pick: (r: T) => Twinable): T[] {
  const byKey = new Map<string, string[]>();
  for (const r of rows) {
    const x = pick(r);
    if (isAlioId(x.id)) continue;
    const k = `${x.reg ?? ""}|${x.end ?? ""}`;
    const list = byKey.get(k);
    if (list) list.push(norm(x.title)); else byKey.set(k, [norm(x.title)]);
  }
  if (!byKey.size) return rows;
  return rows.filter((r) => {
    const x = pick(r);
    if (!isAlioId(x.id)) return true;
    const list = byKey.get(`${x.reg ?? ""}|${x.end ?? ""}`);
    if (!list) return true;
    const n = norm(x.title);
    // 한쪽이 다른 쪽을 품는 경우: "[오대산] …", "… _기관명" 처럼 앞뒤에 기관 표시만 붙은 것. 짧은 제목끼리 우연히 겹치지 않게 8자 이상만.
    return !list.some((t) => t === n || (t.length >= 8 && n.includes(t)) || (n.length >= 8 && t.includes(n)));
  });
}
