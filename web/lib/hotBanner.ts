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

export { dueLabel, type HotKind, type Slide } from "./hotShared";
import type { Slide } from "./hotShared";
import { todayKst, iso, daysLeft, PINNED, short } from "./hotShared";
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
