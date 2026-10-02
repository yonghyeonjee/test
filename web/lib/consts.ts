/**
 * 화면(클라이언트 컴포넌트)이 쓰는 상수와 순수 함수.
 *
 * db.ts 에 같이 있었는데, 그 모듈은 맨 위에서 supabase-js 를 불러 클라이언트를
 * 만든다. 클라이언트 컴포넌트가 상수 하나를 가져오려고 db.ts 를 가져오면
 * supabase-js(realtime·auth·storage 포함 300KB)가 쪽마다 브라우저로 내려갔다.
 * 2026-10 모바일 점검에서 잡았다. 여기에는 네트워크를 만지는 것을 두지 않는다.
 */
import type { Program } from "./db";

export const EMPLOYMENT = ["미취업", "재직", "자영업", "구직중", "학생", "퇴직"];
export const HOUSEHOLD = [
  "저소득", "장애인", "한부모·조손", "다자녀",
  "다문화·탈북민", "보훈대상자", "1인가구", "임산부", "무주택",
];

export const BIZ_TARGET = [
  "소상공인", "중소기업", "예비창업자", "창업기업",
  "중견기업", "협동조합", "사회적기업",
];

// 실제 데이터 분포순
/** 공고에 실제로 붙어 있는 업종만. 없는 값을 늘어놓으면 빈 결과만 나온다. */
export const INDUSTRY = [
  "제조업", "음식점업", "정보통신업", "농림어업", "도소매업",
  "개인서비스업", "건설업", "운수·물류업", "숙박업",
  "전문·과학·기술서비스업", "교육서비스업", "예술·스포츠·여가업", "금융·보험업",
];

export const BIZ_FIELD = [
  "경영", "기술", "금융", "판로", "수출", "인력", "시설", "창업",
];

export type ApplyStatus = "closed" | "upcoming" | "ongoing" | "always";

export const STATUS_LABEL: Record<ApplyStatus, string> = {
  closed: "마감",
  upcoming: "예정",
  ongoing: "진행 중",
  always: "상시",
};

/** 서버가 어느 시간대에 있든 한국 날짜로 판단한다. "YYYY-MM-DD". */
function todayKST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date()
  );
}

/**
 * 접수 상태. apply_start / apply_end 는 date 라 문자열 비교로 충분하다.
 * 날짜가 아예 없는 공고는 "진행 중"으로 본다 — 원문에서 기간을 못 뽑은
 * 경우가 많아 마감으로 단정하면 멀쩡한 공고가 죽어 보인다.
 */
export function applyStatus(
  p: Pick<Program, "apply_start" | "apply_end" | "is_always_on">
): ApplyStatus {
  if (p.is_always_on) return "always";
  const today = todayKST();
  if (p.apply_end && p.apply_end < today) return "closed";
  if (p.apply_start && p.apply_start > today) return "upcoming";
  return "ongoing";
}

export function daysLeft(p: Pick<Program, "apply_end" | "is_always_on">) {
  if (p.is_always_on || !p.apply_end) return null;
  const end = new Date(p.apply_end + "T23:59:59+09:00").getTime();
  return Math.ceil((end - Date.now()) / 86_400_000);
}

export function ageLabel(p: Pick<Program, "age_min" | "age_max">) {
  if (p.age_min !== null && p.age_max !== null) return `만 ${p.age_min}~${p.age_max}세`;
  if (p.age_min !== null) return `만 ${p.age_min}세 이상`;
  if (p.age_max !== null) return `만 ${p.age_max}세 이하`;
  return null;
}
