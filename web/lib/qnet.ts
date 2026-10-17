import { db, dbConfigured } from "./db";
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

/**
 * 공단 자료는 산업기사를 따로 세지 않고 "기사" 계열에 함께 넣어 준다.
 * 실제로 242종목 가운데 117종목이 산업기사인데, 그대로 두면 화면이
 * "기사 242" 한 덩어리가 되고 종목 안내도 산업기사에게 기사 등급 기준을
 * 읽어 준다. 등급이 다르면 응시 자격도 다르니 이름을 보고 갈라 준다.
 *
 * 이름 끝이 "산업기사" 이거나, 뒤에 (기계분야) 같은 괄호만 붙은 것까지.
 */
export function normSeries(series: string, name: string): string {
  if (series !== "기사") return series;
  return /산업기사(\s*\([^)]*\))?$/.test(name) ? "산업기사" : series;
}

/** 계열 건수와 정렬. 등급 계열이 먼저, 그 밖은 이름순. */
function seriesOf(all: License[]): { name: string; n: number }[] {
  const count = new Map<string, number>();
  for (const l of all) count.set(l.series, (count.get(l.series) ?? 0) + 1);
  return Array.from(count.entries())
    .map(([name, n]) => ({ name, n }))
    .sort((a, b) => {
      const ia = SERIES_ORDER.indexOf(a.name);
      const ib = SERIES_ORDER.indexOf(b.name);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a.name.localeCompare(b.name, "ko");
    });
}

/** 계열 건수와 정렬을 한 곳에서. DB 로 읽든 API 로 읽든 결과가 같아야 한다. */
function board(all: License[], reason: string | null = null): LicenseBoard {
  all.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return {
    ok: all.length > 0,
    reason: all.length ? null : reason ?? "종목이 비어 있습니다.",
    all,
    series: seriesOf(all),
  };
}

/**
 * 국가기술자격만 남긴 보드. 등급(기술사…기능사)으로 거를 수 있는 것들이다.
 *
 * 국가전문자격은 등급 체계가 없어 계열 이름이 곧 자격 이름이다. 그대로
 * 한 화면에 두면 "가맹거래사 1", "감정사 1" 같은 칩이 서른 개 넘게 깔려
 * 정작 등급 칩이 묻힌다. 화면을 나눈다.
 */
export function techBoard(b: LicenseBoard): LicenseBoard {
  return board(b.all.filter((l) => l.kind === "T"), b.reason);
}

/** 국가전문자격만 남긴 보드. 시행 기관이 부처마다 달라 따로 본다. */
export function proBoard(b: LicenseBoard): LicenseBoard {
  return board(b.all.filter((l) => l.kind !== "T"), b.reason);
}

/**
 * 계열(자격) → 종목. 국가전문자격 화면이 쓴다.
 *
 * 관광통역안내사처럼 언어별로, 국가유산수리기능자처럼 직능별로 나뉘는
 * 자격이 있는가 하면 한 종목뿐인 자격이 스물 넘는다. 갈래가 여럿인 것만
 * 묶어 보이고 하나뿐인 것은 한자리에 모은다.
 */
export function groupBySeries(list: License[]) {
  const map = new Map<string, License[]>();
  for (const l of list) map.set(l.series, [...(map.get(l.series) ?? []), l]);
  const groups = Array.from(map.entries())
    .map(([series, items]) => ({ series, items }))
    .sort((a, b) => b.items.length - a.items.length || a.series.localeCompare(b.series, "ko"));
  return {
    multi: groups.filter((g) => g.items.length > 1),
    single: groups
      .filter((g) => g.items.length === 1)
      .map((g) => g.items[0])
      .sort((a, b) => a.name.localeCompare(b.name, "ko")),
  };
}

/**
 * 수집해 둔 표에서 읽는다.
 *
 * 예전에는 화면을 그릴 때마다 Q-Net API 를 직접 불렀다. 613종목을 이미
 * 매일 license_items 에 모아 두고 있는데 쓰지 않고 있었다. API 가 흔들리면
 * 자격증 화면이 통째로 비었다 — 채용에서 겪고 고쳤던 것과 같은 모양이다.
 *
 * 표가 비어 있으면(첫 배포·수집 실패) 그때만 API 로 간다.
 */
async function fromStore(): Promise<LicenseBoard | null> {
  if (!dbConfigured) return null;
  try {
    const { data } = await db
      .from("license_items")
      .select("code,name,kind,kind_name,series,field,sub_field")
      .limit(2000);
    const rows = (data ?? []) as {
      code: string; name: string; kind: string; kind_name: string | null;
      series: string | null; field: string | null; sub_field: string | null;
    }[];
    if (!rows.length) return null;
    return board(rows.map((r) => ({
      code: r.code,
      name: r.name,
      kind: r.kind,
      kindName: r.kind_name ?? "",
      series: normSeries(r.series ?? "기타", r.name),
      field: r.field ?? "",
      subField: r.sub_field ?? "",
    })));
  } catch {
    return null;
  }
}

export async function getLicenses(): Promise<LicenseBoard> {
  const stored = await fromStore();
  if (stored) return stored;

  const res = await callOpenApiXml(URL, {}, 7 * 86400, { keyParam: "ServiceKey" });
  if (!res.ok) return { ok: false, reason: res.reason, all: [], series: [] };

  // ?? 는 null 만 걸러서 빈 문자열이 그대로 지나간다. 이 API 는 없는 값을
  // <obligfldnm></obligfldnm> 처럼 빈 태그로 주기 때문에, 화면에 이름 없는
  // 묶음이 생겼다("(빈칸) 100종목"). 공백까지 없는 값으로 본다.
  const val = (v: string | undefined, fallback = "") => {
    const t = (v ?? "").trim();
    return t || fallback;
  };

  const all: License[] = [];
  for (const r of res.rows) {
    const name = val(r.jmfldnm);
    if (!name) continue;
    const kindName = val(r.qualgbnm);
    all.push({
      code: val(r.jmcd),
      name,
      kind: val(r.qualgbcd),
      kindName,
      series: normSeries(val(r.seriesnm, "기타"), name),
      // 국가전문자격(청소년상담사·관광통역안내사 등)은 대직무분야가 없다.
      // 없는 것을 "기타"로 뭉뚱그리지 말고 무엇인지 그대로 적는다.
      field: val(r.obligfldnm, kindName || "국가전문자격"),
      subField: val(r.mdobligfldnm),
    });
  }
  return board(all);
}

/**
 * 종목별 최근 두 해 응시자 수(필기·실기처럼 단계별 줄을 더한 값). exam_stats 에서 종목마다 가장 최근 두 해를 쓴다 —
 * 큐넷은 지난해 통계를 이듬해에야 내므로 "올해−2 이후" 로 자르면 연초에 한 해치만 남아 숫자가 반토막 난다.
 * code 를 주면 그 종목만 읽는다. 오류이거나 줄이 하나도 없으면 던진다 — 부르는 쪽이 "색인 유지" 로 받는다.
 */
export async function licenseApplicants(code?: string): Promise<Map<string, number>> {
  type R = { code: string; year: number; applicants: number | null };
  const since = new Date().getFullYear() - 3;
  const rows: R[] = [];
  // PostgREST 는 한 번에 1,000줄까지만 준다(613종목 × 해 × 단계 ≈ 3,700줄). 나눠 읽는다.
  for (let from = 0; from < 10_000; from += 1000) {
    let q = db.from("exam_stats").select("code,year,applicants").gte("year", since);
    if (code) q = q.eq("code", code);
    const { data, error } = await q.order("id").range(from, from + 999);
    if (error) throw new Error(`[licenseApplicants] ${error.message}`);
    rows.push(...((data ?? []) as R[]));
    if (!data || data.length < 1000) break;
  }
  if (!rows.length) throw new Error("[licenseApplicants] exam_stats 에 줄이 없다");
  const byCode = new Map<string, Map<number, number>>();
  for (const r of rows) {
    const years = byCode.get(r.code) ?? new Map<number, number>();
    years.set(r.year, (years.get(r.year) ?? 0) + (r.applicants ?? 0));
    byCode.set(r.code, years);
  }
  const out = new Map<string, number>();
  byCode.forEach((years, c) => {
    const recent = Array.from(years.entries()).sort((a, b) => b[0] - a[0]).slice(0, 2);
    out.set(c, recent.reduce((s, [, n]) => s + n, 0));
  });
  return out;
}

/** 찾는 사람이 있다고 보는 최근 두 해 응시자 수. 2026-10-17 기준 국가기술자격 513종목 가운데 283종목이 넘는다. */
export const LICENSE_DEMAND_MIN = 1000;

/**
 * 종목 쪽을 검색엔진에 색인시킬지(2026-10-17). 사이트 전체가 색인에서 빠졌고, 613종목 쪽은 등급 단위
 * 같은 글에 이름만 바뀌는 꼴이라 찾는 사람이 있는 종목만 남긴다. 나머지도 쪽은 그대로 열린다(noindex,follow).
 *  - 최근 두 해 응시자가 LICENSE_DEMAND_MIN 이상인 종목
 *  - 응시자 통계가 없는 종목(국가전문자격 100종목 전부)은 계열마다 첫 종목(코드가 가장 작은 것) 하나만 —
 *    관광통역안내사(언어 12갈래)·국가유산수리기능자(직종 24갈래)처럼 같은 글이 갈래만 바꿔 되풀이된다.
 *    첫 종목은 수요가 아니라 코드 순서로 고른 대표다.
 */
export function licenseIndexable(l: License, all: License[], applicants: Map<string, number>): boolean {
  const n = applicants.get(l.code) ?? 0;
  if (n >= LICENSE_DEMAND_MIN) return true;
  if (n > 0) return false;
  const first = all.filter((x) => x.series === l.series).reduce((a, x) => (x.code < a ? x.code : a), l.code);
  return first === l.code;
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
        .map(([subField, items]) => ({ subField: subField || "분류 없음", items }))
        .sort((a, b) => b.items.length - a.items.length),
    }))
    .sort((a, b) => b.n - a.n);
}
