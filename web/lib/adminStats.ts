/**
 * 관리자 통계 탐색기가 서버(route)와 화면(StatsExplorer)에서 같이 쓰는 이름표.
 * 집계는 sql/019 admin_stat_series 가 한다. 여기 값은 그 함수의 p_unit·p_dim 과 같아야 한다.
 */
export const UNITS = ["hour", "day", "week", "month", "year"] as const;
export type Unit = (typeof UNITS)[number];
export const UNIT_LABEL: Record<Unit, string> = { hour: "시간", day: "일", week: "주", month: "월", year: "년" };

export const DIMS = {
  visit: ["channel", "site", "category", "landing", "term", "campaign"],
  search: ["entry", "kind", "sido", "age_band", "employment", "zero"],
} as const;
export type Src = keyof typeof DIMS;
export type Dim = (typeof DIMS)[Src][number];
export const DIM_LABEL: Record<Dim, string> = {
  channel: "채널", site: "사이트(리퍼러)", category: "도착 화면 갈래", landing: "도착 화면", term: "검색어", campaign: "캠페인",
  entry: "조회 방식", kind: "갈래", sido: "지역", age_band: "나이대", employment: "취업상태", zero: "결과 0건 여부",
};
export const SRC_LABEL: Record<Src, string> = { visit: "유입(사람 수)", search: "검색(조건 조회)" };

export type StatRow = { b: string; k: string; n: number };

/** 기간 미리 고르기. days 가 null 이면 기록 시작(2026-09-06)부터. */
export const PRESETS: { key: string; label: string; days: number | null }[] = [
  { key: "today", label: "오늘", days: 1 },
  { key: "7d", label: "7일", days: 7 },
  { key: "30d", label: "30일", days: 30 },
  { key: "90d", label: "90일", days: 90 },
  { key: "year", label: "올해", days: -1 },
  { key: "all", label: "전체", days: null },
];
export const FIRST_DAY = "2026-09-06";

/** 기간 길이에 맞는 기본 단위. 하루면 시간, 석 달까지 일, 두 해까지 주, 그 뒤는 월. */
export function defaultUnit(fromMs: number, toMs: number): Unit {
  const days = (toMs - fromMs) / 86400_000;
  if (days <= 2) return "hour";
  if (days <= 100) return "day";
  if (days <= 740) return "week";
  return "month";
}
