/**
 * 수집 대상의 이름표.
 *
 * 화면(클라이언트)과 수집기(서버)가 같이 쓴다. collectors.ts 는 supabase 와
 * 인증키를 읽는 서버 전용 모듈이라, 거기서 이름표를 가져오면 그 모듈 전체가
 * 브라우저 번들로 딸려 온다. 이름표만 따로 둔다.
 */

export type CollectKey =
  | "gojobs" | "worldjob"
  | "license" | "agency_business" | "agency_event" | "agency_facility" | "jeonse";

export const COLLECT_LABEL: Record<CollectKey, string> = {
  gojobs: "나라일터 채용",
  worldjob: "해외취업",
  license: "국가자격 종목",
  agency_business: "공공기관 사업",
  agency_event: "공공기관 행사",
  agency_facility: "공공기관 시설",
  jeonse: "전세대출 금리",
};

export const COLLECT_KEYS = Object.keys(COLLECT_LABEL) as CollectKey[];

export type CollectResult = {
  key: CollectKey; ok: boolean; saved: number; reason?: string; elapsedMs: number;
  /** 이어 읽을 것이 남았나 (채용만) */
  more?: boolean;
};

/** 마지막 채용 수집 기록. 화면이 읽을 수 있게 여기에 둔다. */
export type LastRunView = {
  source: string;
  state: "running" | "done" | "failed";
  startedAt: string;
  finishedAt?: string;
  by: "cron" | "admin";
  report?: { ok: boolean; saved: number; reason?: string; timeUp?: boolean };
};
