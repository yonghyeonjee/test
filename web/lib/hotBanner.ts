import { unstable_cache } from "next/cache";
import { db, dbConfigured } from "./db";
import { GRADE_SLUG, getExamRounds, upcoming } from "./qnetExam";

/**
 * 첫 화면에서 돌아가는 띠. "지금 안 하면 놓치는 것"만 싣는다.
 *
 * 이 사이트에 들어오는 사람은 대개 무엇이 있는지 모른 채로 온다. 마감이
 * 걸린 것을 앞에 놓으면 그 자체가 안내가 된다. 마감이 없는 상시 사업은
 * 여기 싣지 않는다 — 급할 것이 없는 것을 급한 척하면 나머지도 안 믿는다.
 */

export type HotKind = "pin" | "exam" | "job" | "biz";

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
function todayKst(): Date {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  return new Date(`${s}T00:00:00Z`);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function daysLeft(end: string, today = todayKst()): number {
  const e = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((e - today.getTime()) / 86400_000);
}

/**
 * 손으로 적어 두는 것. 공공데이터에 없지만 중요한 일정을 싣는다.
 *
 * 청년미래적금 2차는 금융위가 따로 발표한 것이라 우리가 모아 둔 표에
 * 없다. 날짜가 지나면 저절로 빠진다.
 */
const PINNED: Omit<Slide, "days">[] = [
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
function short(t: string, max = 38): string {
  const s = t.replace(/^\[[^\]]{1,12}\]\s*/, "").replace(/\s+/g, " ").trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** 마감이 며칠 남았는지를 사람 말로. */
export function dueLabel(days: number): string {
  if (days <= 0) return "오늘 마감";
  if (days === 1) return "내일 마감";
  return `D-${days}`;
}

async function build(): Promise<Slide[]> {
  const today = todayKst();
  const from = iso(today);
  const to = iso(new Date(today.getTime() + 7 * 86400_000));

  const pinned: Slide[] = PINNED.map((p) => ({ ...p, days: daysLeft(p.end, today) }))
    .filter((p) => p.days >= 0);

  if (!dbConfigured) return pinned;

  const [exam, jobs, biz] = await Promise.all([
    // 자격시험 원서접수. 놓치면 다음 회차까지 몇 달을 기다린다.
    getExamRounds()
      .then((rs) => upcoming(rs, today))
      .then((us) =>
        us
          .filter((u) => u.state === "open" && u.days <= 7)
          .map<Slide>((u) => ({
            key: `exam-${u.round.grade}-${u.stage.label}-${u.stage.to}`,
            kind: "exam",
            days: u.days,
            title: `${u.round.grade} ${u.stage.label} 마감 임박`,
            sub: `접수 ${u.stage.to.replaceAll("-", ".")}까지 · 종목과 상관없이 같은 일정`,
            href: `/license/schedule#${GRADE_SLUG[u.round.grade]}`,
            end: u.stage.to,
          })),
      )
      .catch(() => [] as Slide[]),

    // 공공기관·중앙부처 채용. 지역이 비어 있는 것이 전국 단위다.
    db
      .from("job_posts")
      .select("source_id,title,org,end_date")
      .not("end_date", "is", null)
      .gte("end_date", from)
      .lte("end_date", to)
      .is("region", null)
      .order("end_date", { ascending: true })
      .limit(30)
      .then(({ data }) =>
        (data ?? []).map<Slide>((r) => ({
          key: `job-${r.source_id}`,
          kind: "job",
          days: daysLeft(String(r.end_date), today),
          title: short(String(r.title ?? "")),
          sub: `${r.org ?? "공공기관"} · 원서접수 마감`,
          href: `/jobs/${encodeURIComponent(String(r.source_id))}`,
          end: String(r.end_date),
        })),
      )
      .then((x) => x)
      .then((x) => x, () => [] as Slide[]),

    // 전국 단위 기업지원. 지자체 것은 사는 곳이 맞아야 해서 띠에는 안 싣는다.
    db
      .from("programs_public")
      .select("source_id,title,org_name,apply_end")
      .eq("kind", "business")
      .not("apply_end", "is", null)
      .gte("apply_end", from)
      .lte("apply_end", to)
      .is("sido", null)
      .order("apply_end", { ascending: true })
      .limit(30)
      .then(({ data }) =>
        (data ?? []).map<Slide>((r) => ({
          key: `biz-${r.source_id}`,
          kind: "biz",
          days: daysLeft(String(r.apply_end), today),
          title: short(String(r.title ?? "")),
          sub: `${r.org_name ?? "정부·공공기관"} · 신청 마감`,
          href: `/p/${encodeURIComponent(String(r.source_id))}`,
          end: String(r.apply_end),
        })),
      )
      .then((x) => x, () => [] as Slide[]),
  ]);

  // 한 갈래가 띠를 다 차지하지 않게 갈래마다 둘까지만.
  const pick = (list: Slide[], n: number) =>
    list.filter((s) => s.days >= 0 && s.title.length > 4).slice(0, n);

  const rest = [...pick(exam, 1), ...pick(jobs, 2), ...pick(biz, 2)].sort(
    (a, b) => a.days - b.days,
  );

  return [...pinned, ...rest].slice(0, 6);
}

/** 30분이면 넉넉하다. 마감은 날 단위로 움직인다. */
export const getHotSlides = unstable_cache(build, ["hot-slides"], { revalidate: 1800 });
