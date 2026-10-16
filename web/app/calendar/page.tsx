import type { Metadata } from "next";
import Link from "next/link";
import CalendarAdd from "@/components/CalendarAdd";
import JsonLd from "@/components/JsonLd";
import LocateButton from "@/components/LocateButton";
import { SIDO_SHORT } from "@/lib/geo";
import { addDays, deadlineDays, deadlineItems, examDays, monthRange, todayKst, type DayItem } from "@/lib/calendar";
import type { CalEvent } from "@/lib/ical";
import { pageGraph } from "@/lib/schema";
import { SITE_URL, withOg } from "@/lib/seo";

export const revalidate = 900;

const TITLE = "마감 달력 — 지원사업·채용·자격시험 마감일을 날짜별로";
const DESC = "정부지원금·공공기관 채용·자격시험의 마감과 접수 일정을 한 달력에 모았습니다. 사는 지역을 고르거나 내 위치를 허용하면 그 지역 것만 남습니다.";

export const metadata: Metadata = withOg({
  title: { absolute: `${TITLE} | K나라지원` },
  description: DESC,
  alternates: { canonical: "/calendar" },
});

type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v);
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const SIDOS = Object.keys(SIDO_SHORT);

function ym(day: string) { return day.slice(0, 7); }
function shiftMonth(ymStr: string, n: number) {
  const [y, m] = ymStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
const label = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일 (${WD[new Date(`${day}T00:00:00Z`).getUTCDay()]})`;

/**
 * 마감 달력. 지도(/map)가 "어디"라면 이쪽은 "언제"다.
 * 달력 칸은 링크라 자바스크립트 없이도 돌아간다. 날짜를 누르면 그날 마감을 아래에 편다.
 */
export default async function CalendarPage({ searchParams }: { searchParams: SP }) {
  const today = todayKst();
  const sido = one(searchParams.sido) || null;
  const sigungu = one(searchParams.sigungu) || null;
  const dParam = one(searchParams.d);
  const mParam = one(searchParams.m);
  const month = /^\d{4}-\d{2}$/.test(mParam ?? "") ? (mParam as string) : /^\d{4}-\d{2}-\d{2}$/.test(dParam ?? "") ? ym(dParam as string) : ym(today);
  const { from, to } = monthRange(month);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dParam ?? "") && (dParam as string) >= from && (dParam as string) <= to
    ? (dParam as string) : ym(today) === month ? today : from;

  const [days, exams, items] = await Promise.all([
    deadlineDays(from, to, sido, sigungu),
    examDays(from, to),
    deadlineItems(day, sido, sigungu),
  ]);
  for (const [d, list] of Object.entries(exams)) { days[d] ??= { p: 0, job: 0, exam: 0 }; days[d].exam = list.length; }
  const dayExams = exams[day] ?? [];

  // 달력 칸. 첫 주는 일요일부터 비워 둔다.
  const firstWd = new Date(`${from}T00:00:00Z`).getUTCDay();
  const lastN = Number(to.slice(8, 10));
  const cells: (string | null)[] = [...Array(firstWd).fill(null), ...Array.from({ length: lastN }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);

  const q = (patch: Record<string, string | null | undefined>) => {
    const sp = new URLSearchParams();
    const all = { m: month, d: day, sido, sigungu, ...patch };
    for (const [k, v] of Object.entries(all)) if (v) sp.set(k, v);
    return `/calendar?${sp}`;
  };
  const where = sido ? [SIDO_SHORT[sido] ?? sido, sigungu].filter(Boolean).join(" ") : "전국";
  const monthTotal = Object.values(days).reduce((a, c) => a + c.p + c.job + c.exam, 0);

  const programs = items.filter((i) => i.kind === "p");
  const jobs = items.filter((i) => i.kind === "job");
  const events: CalEvent[] = [
    ...items.map((i): CalEvent => ({
      title: `[마감] ${i.title}`, start: day, details: [i.org, i.place].filter(Boolean).join(" · "),
      url: `${SITE_URL}/${i.kind === "p" ? "p" : "jobs"}/${encodeURIComponent(i.id)}`,
    })),
    ...dayExams.map((e): CalEvent => ({ title: e.title, start: e.start, end: e.end, url: e.url })),
  ];

  return (
    <main className="pb-12 pt-4 sm:pt-6">
      <JsonLd data={pageGraph({ path: "/calendar", name: TITLE, description: DESC, crumbs: [{ name: "홈", path: "/" }, { name: "마감 달력", path: "/calendar" }] })} />
      <header>
        <p className="text-[12.5px] font-bold text-brand">언제 끝나는지</p>
        <h1 className="display mt-1 text-[1.5rem] leading-tight sm:text-[1.75rem]">마감 달력</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
          지원사업·공공기관 채용·자격시험 마감을 날짜별로 모았습니다. 지역을 고르면 그 지역과 전국 것만 남습니다.
        </p>
      </header>

      {/* 지역 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <LocateButton base="/calendar" keep={{ m: month, d: day }} />
        <Link href={q({ sido: null, sigungu: null })} className={`chip ${!sido ? "chip-on" : ""}`}>전국</Link>
        {SIDOS.map((s) => (
          <Link key={s} href={q({ sido: s, sigungu: null })} className={`chip ${sido === s ? "chip-on" : ""}`}>{SIDO_SHORT[s]}</Link>
        ))}
      </div>
      {sigungu && (
        <p className="mt-2 text-[13px] text-muted">
          <b className="font-semibold text-ink2">{where}</b> 기준.{" "}
          <Link href={q({ sigungu: null })} className="underline underline-offset-4 hover:text-brand">{SIDO_SHORT[sido ?? ""] ?? sido} 전체로 보기</Link>
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        {/* 달력 */}
        <section className="card p-3 sm:p-4" aria-label={`${month} 달력`}>
          <div className="flex items-center justify-between">
            <Link href={q({ m: shiftMonth(month, -1), d: null })} className="btn btn-ghost !px-3 !py-1.5 text-[13px]" aria-label="지난달">‹ 지난달</Link>
            <h2 className="num text-[1.0625rem] font-extrabold tracking-[-.02em]">
              {Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월
              <span className="ml-2 text-[12.5px] font-semibold text-faint">{where} · {monthTotal.toLocaleString("ko-KR")}건</span>
            </h2>
            <Link href={q({ m: shiftMonth(month, 1), d: null })} className="btn btn-ghost !px-3 !py-1.5 text-[13px]" aria-label="다음달">다음달 ›</Link>
          </div>
          <div className="mt-3 grid grid-cols-7 text-center text-[11.5px] font-semibold text-faint">
            {WD.map((w, i) => <span key={w} className={i === 0 ? "text-alert" : i === 6 ? "text-cat-blue" : ""}>{w}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((c, i) => {
              if (!c) return <span key={`e${i}`} />;
              const n = days[c];
              const total = n ? n.p + n.job + n.exam : 0;
              const on = c === day;
              const past = c < today;
              return (
                <Link key={c} href={q({ d: c })} scroll={false} aria-current={on ? "date" : undefined}
                      className={`flex min-h-[56px] flex-col items-center rounded-[10px] px-0.5 py-1.5 text-[13px] transition-colors sm:min-h-[64px]
                                  ${on ? "bg-brand text-white" : past ? "text-faint hover:bg-ground" : "text-ink2 hover:bg-ground"}`}>
                  <span className={`num font-bold ${c === today && !on ? "rounded-full bg-brandSoft px-1.5 text-brand" : ""}`}>{Number(c.slice(8, 10))}</span>
                  {total > 0 && (
                    <span className={`num mt-1 text-[11px] font-semibold ${on ? "text-white/90" : "text-muted"}`}>{total}</span>
                  )}
                  {n && (
                    <span className="mt-auto flex gap-0.5" aria-hidden>
                      {n.p > 0 && <i className={`block h-1.5 w-1.5 rounded-full ${on ? "bg-white" : "bg-brand"}`} />}
                      {n.job > 0 && <i className={`block h-1.5 w-1.5 rounded-full ${on ? "bg-white/70" : "bg-cat-blue"}`} />}
                      {n.exam > 0 && <i className={`block h-1.5 w-1.5 rounded-full ${on ? "bg-white/50" : "bg-cat-orange"}`} />}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-faint">
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-brand" />지원사업</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-cat-blue" />채용</span>
            <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-cat-orange" />자격시험</span>
            <span>숫자는 그날 마감 건수</span>
          </p>
        </section>

        {/* 고른 날 */}
        <section className="card p-4 sm:p-5" aria-label={`${label(day)} 마감`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="num text-[1.0625rem] font-extrabold tracking-[-.02em]">
              {label(day)} <span className="text-[13px] font-semibold text-muted">{items.length + dayExams.length}건 마감</span>
            </h2>
            <span className="flex gap-1 text-[12.5px]">
              <Link href={q({ d: addDays(day, -1) })} scroll={false} className="rounded-ctl px-2 py-1 text-muted hover:bg-ground hover:text-ink">‹ 전날</Link>
              <Link href={q({ d: addDays(day, 1) })} scroll={false} className="rounded-ctl px-2 py-1 text-muted hover:bg-ground hover:text-ink">다음날 ›</Link>
            </span>
          </div>
          {events.length > 0 && <CalendarAdd events={events} label="이날 마감 캘린더에 담기" size="sm" file={`마감 ${day}`} bulk className="mt-3" />}

          {items.length + dayExams.length === 0 && (
            <p className="mt-4 text-[14px] text-muted">이날 마감되는 것이 없습니다. 다른 날짜를 눌러 보세요.</p>
          )}
          {dayExams.length > 0 && (
            <Group title="자격시험" n={dayExams.length} tone="bg-cat-orangeSoft text-cat-orange">
              {dayExams.map((e, i) => (
                <li key={i}>
                  <Link href="/license/schedule" className="flex items-center gap-2 py-2 hover:text-brand">
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{e.title}</span>
                  </Link>
                </li>
              ))}
            </Group>
          )}
          {programs.length > 0 && (
            <Group title="지원사업" n={programs.length} tone="bg-brandSoft text-brand">{programs.map((i) => <Row key={`p${i.id}`} it={i} />)}</Group>
          )}
          {jobs.length > 0 && (
            <Group title="채용" n={jobs.length} tone="bg-cat-blueSoft text-cat-blue">{jobs.map((i) => <Row key={`j${i.id}`} it={i} />)}</Group>
          )}
          {items.length >= 150 && <p className="mt-3 text-[12px] text-faint">150건까지만 보입니다. 지역을 고르면 줄어듭니다.</p>}
        </section>
      </div>

      <p className="mt-6 text-[13px] leading-relaxed text-muted">
        마감일은 기관이 적은 접수 마감일 기준입니다. 당일 접수 시각과 우편 도착 기준은 원문에서 확인하세요.
        시험 일정은 <Link href="/license/schedule" className="underline underline-offset-4 hover:text-brand">자격시험 일정</Link>에서 종목별로 볼 수 있습니다.
      </p>
    </main>
  );
}

function Group({ title, n, tone, children }: { title: string; n: number; tone: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="flex items-center gap-2 text-[13px] font-bold text-ink2">
        <span className={`rounded-[6px] px-1.5 py-0.5 text-[12px] font-bold ${tone}`}>{title}</span>
        <span className="num text-faint">{n}건</span>
      </h3>
      <ul className="mt-1 divide-y divide-line">{children}</ul>
    </div>
  );
}

function Row({ it }: { it: DayItem }) {
  return (
    <li>
      <Link href={`/${it.kind === "p" ? "p" : "jobs"}/${encodeURIComponent(it.id)}`} className="group flex items-center gap-3 py-2.5">
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[14.5px] font-semibold text-ink group-hover:text-brand">{it.title}</b>
          <span className="mt-0.5 block truncate text-[12.5px] text-muted">{[it.org, it.place].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="shrink-0 rounded-pill bg-alertSoft px-2 py-0.5 text-[12px] font-bold text-alert">마감</span>
      </Link>
    </li>
  );
}
