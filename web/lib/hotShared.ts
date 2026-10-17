/**
 * 첫 화면 띠(HotBanner)에서 서버와 클라이언트가 같이 쓰는 것.
 * hotBanner.ts 는 db 를 가져오므로 클라이언트 컴포넌트가 가져오면 안 된다.
 */
/** brief: 오늘의 채용 브리핑(날마다 쓰는 글). 마감이 아니라 "오늘" 표시로 보인다. */
export type HotKind = "pin" | "exam" | "job" | "biz" | "brief";

export type Slide = {
  key: string;
  kind: HotKind;
  /** 남은 날. 0 이면 오늘 마감. */
  days: number;
  title: string;
  sub: string;
  href: string;
  /** 마감일 YYYY-MM-DD. */
  end: string;
};

/** 서울 기준 오늘. 서버가 어디 있든 하루 경계가 같아야 한다. */
export function todayKst(): Date {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  return new Date(`${s}T00:00:00Z`);
}

export const iso = (d: Date) => d.toISOString().slice(0, 10);

export function daysLeft(end: string, today = todayKst()): number {
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((e - today.getTime()) / 86400_000);
}

/**
 * 청년미래적금 2차 일정(금융위 2026-09-16 발표). 신청 10/7~16, 신청한 사람의 계좌 개설 11/16~27.
 * 2026-10-17 신청이 끝났는데 목록에 "신청 중"이 그대로 남아 있었다. 글 목록·글·메뉴가 이 단계를 보고 바뀐다.
 */
export const YFS = { applyEnd: "2026-10-16", openStart: "2026-11-16", openEnd: "2026-11-27" } as const;
export type YfsPhase = "apply" | "wait" | "open" | "done";
export function yfsPhase(today = todayKst()): YfsPhase {
  const t = iso(today);
  if (t <= YFS.applyEnd) return "apply";
  if (t < YFS.openStart) return "wait";
  if (t <= YFS.openEnd) return "open";
  return "done";
}

/**
 * 손으로 적어 두는 것. 공공데이터에 없지만 중요한 일정을 싣는다.
 *
 * 청년미래적금 2차는 금융위가 따로 발표한 것이라 우리가 모아 둔 표에
 * 없다. 날짜가 지나면 저절로 빠진다.
 */
export const PINNED: Omit<Slide, "days">[] = [
  {
    key: "youth-future-savings",
    kind: "pin",
    title: "청년미래적금 2차, 10월 16일까지",
    sub: "월 50만원 3년 · 정부가 최대 12% 얹어 줍니다",
    href: "/blog/youth-future-savings",
    end: "2026-10-16",
  },
];

/** 앞머리의 [지역] 같은 꼬리표를 떼고 길면 자른다. 띠에는 긴 제목이 안 들어간다. */
export function short(t: string, max = 38): string {
  const s = t.replace(/^\[[^\]]{1,12}\]\s*/, "").replace(/\s+/g, " ").trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** 마감이 며칠 남았는지를 사람 말로. */
export function dueLabel(days: number): string {
  if (days <= 0) return "오늘 마감";
  if (days === 1) return "내일 마감";
  return `D-${days}`;
}

