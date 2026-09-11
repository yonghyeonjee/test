import { callOpenApiXml } from "./openapi";

/**
 * 국가자격 종목 목록 (한국산업인력공단, q-net).
 *
 * 한 번 부르면 시행 중인 국가자격 종목 전부를 준다. 페이지가 없고,
 * XML 만 준다. 종목 목록은 해마다 몇 개 바뀌는 정도라 일주일에 한 번
 * 받아 오면 충분하다.
 *
 * 명세의 요청 예제가 ServiceKey(대문자 S)로 되어 있어 그대로 따른다.
 */

const URL =
  "http://openapi.q-net.or.kr/api/service/rest/InquiryListNationalQualifcationSVC/getList";

export type License = {
  code: string;
  name: string;
  /** T 국가기술자격 / S 국가전문자격 */
  kind: "T" | "S" | string;
  kindName: string;
  /** 기술사·기능장·기사·산업기사·기능사 … */
  series: string;
  /** 대직무분야 */
  field: string;
  /** 중직무분야 */
  subField: string;
};

export type LicenseBoard = {
  ok: boolean;
  reason: string | null;
  all: License[];
  /** 계열 이름 → 건수. 필터 칩에 쓴다. */
  series: { name: string; n: number }[];
};

/** 기술사부터 기능사까지, 어려운 순. 그 밖의 계열은 뒤에 이름순. */
const SERIES_ORDER = ["기술사", "기능장", "기사", "산업기사", "기능사"];

export async function getLicenses(): Promise<LicenseBoard> {
  const res = await callOpenApiXml(URL, {}, 7 * 86400, { keyParam: "ServiceKey" });
  if (!res.ok) return { ok: false, reason: res.reason, all: [], series: [] };

  const all: License[] = [];
  for (const r of res.rows) {
    const name = (r.jmfldnm ?? "").trim();
    if (!name) continue;
    all.push({
      code: r.jmcd ?? "",
      name,
      kind: r.qualgbcd ?? "",
      kindName: r.qualgbnm ?? "",
      series: r.seriesnm ?? "기타",
      field: r.obligfldnm ?? "기타",
      subField: r.mdobligfldnm ?? "",
    });
  }
  all.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const count = new Map<string, number>();
  for (const l of all) count.set(l.series, (count.get(l.series) ?? 0) + 1);
  const series = Array.from(count.entries())
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => {
      const ia = SERIES_ORDER.indexOf(a.name);
      const ib = SERIES_ORDER.indexOf(b.name);
      if (ia !== -1 || ib !== -1)
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a.name.localeCompare(b.name, "ko");
    });

  return { ok: all.length > 0, reason: all.length ? null : "종목이 비어 있습니다.", all, series };
}

/** 대직무분야 → 중직무분야 → 종목. 화면에서 그대로 접어 보여 준다. */
export function groupByField(list: License[]) {
  const map = new Map<string, Map<string, License[]>>();
  for (const l of list) {
    const sub = map.get(l.field) ?? new Map<string, License[]>();
    const arr = sub.get(l.subField) ?? [];
    arr.push(l);
    sub.set(l.subField, arr);
    map.set(l.field, sub);
  }
  return Array.from(map.entries())
    .map(([field, sub]) => ({
      field,
      n: Array.from(sub.values()).reduce((a, v) => a + v.length, 0),
      subs: Array.from(sub.entries())
        .map(([subField, items]) => ({ subField, items }))
        .sort((a, b) => b.items.length - a.items.length),
    }))
    .sort((a, b) => b.n - a.n);
}
