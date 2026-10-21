import type { Metadata } from "next";
import Link from "next/link";
import CalendarAdd from "@/components/CalendarAdd";
import CalendarCond from "@/components/CalendarCond";
import JsonLd from "@/components/JsonLd";
import LocateButton from "@/components/LocateButton";
import { SIDO_SHORT, sggChoices } from "@/lib/geo";
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
const many = (v: SP[string]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
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
  // 내 조건(첫 화면과 같은 이름: age·emp·hh). 지원사업만 거른다. CalendarCond 가 저장된 조건을 주소에 붙여 준다.
  const ageRaw = Number(one(searchParams.age));
  const age = Number.isInteger(ageRaw) && ageRaw > 0 && ageRaw < 120 ? ageRaw : null;
  const emp = one(searchParams.emp) || null;
  const hh = many(searchParams.hh).filter((h) => h.length <= 20).slice(0, 9);
  const hasCond = Boolean(age || emp || hh.length);
  // 갈래(?k=): w 복지, b 기업, j 채용, x 시험. 비우면 전부 — 단, 내 조건(나이·가구)이 걸려 있으면 기업 지원은 뺀다.
  // 달력의 마감은 기업 지원(924건/석 달)과 채용이 대부분이라, 조건을 넣은 사람에게 그것까지 세어 주면 조건이 먹지 않는 것처럼 보인다.
  // 자영업이면 기업 지원도 남긴다.
  const kRaw = (one(searchParams.k) ?? "").replace(/[^wbjx]/g, "");
  const kinds = new Set<"w" | "b" | "j" | "x">(kRaw ? (kRaw.split("") as ("w" | "b" | "j" | "x")[]) : hasCond && emp !== "자영업" ? ["w", "j", "x"] : ["w", "b", "j", "x"]);
  const pKinds = (["welfare", "business"] as const).filter((k) => kinds.has(k === "welfare" ? "w" : "b"));
  const cond = { age, emp, hh, kinds: pKinds.length === 2 ? undefined : pKinds };
  const dParam = one(searchParams.d);
  const mParam = one(searchParams.m);
  // 달은 지난 석 달부터 앞으로 열두 달까지만. 예전에는 지난달·다음달이 끝없이 이어져(마감 기록이
  // 1901년까지 있다) 검색 로봇이 수천 개 주소를 긁었다(2026-10-17 점검). 범위 밖은 이번 달로.
  const minMonth = shiftMonth(ym(today), -3);
  const maxMonth = shiftMonth(ym(today), 12);
  // 13월·00월 같은 값은 문자열 비교로는 범위 안으로 들어와 달력 칸을 만들다 500 이 났다. 진짜 달만 받는다.
  const okM = (v?: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v ?? "");
  const okD = (v?: string) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v ?? "");
  const asked = okM(mParam) ? (mParam as string) : okD(dParam) ? ym(dParam as string) : ym(today);
  const month = asked >= minMonth && asked <= maxMonth ? asked : ym(today);
  const { from, to } = monthRange(month);
  const day = okD(dParam) && (dParam as string) >= from && (dParam as string) <= to
    ? (dParam as string) : ym(today) === month ? today : from;

  const [days, exams, itemsAll] = await Promise.all([
    pKinds.length ? deadlineDays(from, to, sido, sigungu, cond) : deadlineDays(from, to, sido, sigungu, { ...cond, kinds: ["welfare"] }).then((d) => { for (const v of Object.values(d)) v.p = 0; return d; }),
    kinds.has("x") ? examDays(from, to) : Promise.resolve({} as Awaited<ReturnType<typeof examDays>>),
    deadlineItems(day, sido, sigungu, cond),
  ]);
  if (!kinds.has("j")) for (const v of Object.values(days)) v.job = 0;
  for (const [d, list] of Object.entries(exams)) { days[d] ??= { p: 0, job: 0, exam: 0 }; days[d].exam = list.length; }
  const items = itemsAll.filter((i) => (i.kind === "job" ? kinds.has("j") : pKinds.length > 0));
  const dayExams = exams[day] ?? [];
  const kLabel: Record<string, string> = { w: "복지", b: "기업 지원", j: "채용", x: "자격시험" };
  const kHref = (k: "w" | "b" | "j" | "x") => {
    const next = new Set(kinds);
    if (next.has(k)) next.delete(k); else next.add(k);
    return ["w", "b", "j", "x"].filter((x) => next.has(x as "w")).join("") || "w";
  };

  // 달력 칸. 첫 주는 일요일부터 비워 둔다.
  const firstWd = new Date(`${from}T00:00:00Z`).getUTCDay();
  const lastN = Number(to.slice(8, 10));
  const cells: (string | null)[] = [...Array(firstWd).fill(null), ...Array.from({ length: lastN }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);

  const q = (patch: Record<string, string | null | undefined>) => {
    const sp = new URLSearchParams();
    // 날짜만 바꾸면 달도 그 날짜의 달로. 전날·다음날이 달을 넘으면 그 달 1일로 튀던 것.
    const all = { m: patch.d && !("m" in patch) ? ym(patch.d) : month, d: day, sido, sigungu, age: age ? String(age) : null, emp, k: kRaw || null, ...patch };
    for (const [k, v] of Object.entries(all)) if (v) sp.set(k, v);
    for (const h of hh) sp.append("hh", h);
    // 조건을 다 비운 채 지역만 바꿀 때도 저장된 조건이 다시 붙지 않게.
    if (!hasCond && !sp.has("age")) sp.set("all", "1");
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
          <Link key={s} href={q({ sido: s, sigungu: null })} rel="nofollow" className={`chip ${sido === s ? "chip-on" : ""}`}>{SIDO_SHORT[s]}</Link>
        ))}
      </div>
      {/* 시·군·구: 시·도를 고르면 그 아래 시·군·구를 작은 칸으로. 상세 시까지 내려가야 내 동네 것만 남는다(2026-10-21). */}
      {sido && sggChoices(sido).length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1" role="group" aria-label={`${SIDO_SHORT[sido] ?? sido} 시·군·구`}>
          <Link href={q({ sigungu: null })} rel="nofollow" className={`chip !py-1 !text-[12.5px] ${!sigungu ? "chip-on" : ""}`}>{SIDO_SHORT[sido] ?? sido} 전체</Link>
          {sggChoices(sido).map((g) => (
            <Link key={g} href={q({ sigungu: g })} rel="nofollow" className={`chip !py-1 !text-[12.5px] ${sigungu === g ? "chip-on" : ""}`}>{g}</Link>
          ))}
        </div>
      )}
      {sigungu && (
        <p className="mt-2 text-[13px] text-muted">
          <b className="font-semibold text-ink2">{where}</b> 기준. 그 시·군·구와 {SIDO_SHORT[sido ?? ""] ?? sido} 전역, 전국 것이 남습니다.
        </p>
      )}
      <CalendarCond applied={sido || hasCond ? { sido, sigungu, age, emp, hh } : null} month={month} day={day} />
      {/* 갈래 켜고 끄기. 조건을 넣은 사람은 기업 지원이 꺼진 채 시작한다. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="갈래">
        {(["w", "b", "j", "x"] as const).map((k) => (
          <Link key={k} href={q({ k: kHref(k) })} rel="nofollow" aria-pressed={kinds.has(k)}
                className={`chip !py-1 !text-[12.5px] ${kinds.has(k) ? "chip-on" : "opacity-60"}`}>
            {kinds.has(k) ? "✓ " : ""}{kLabel[k]}
          </Link>
        ))}
        {hasCond && !kinds.has("b") && <span className="text-[12px] text-faint">기업 지원은 내 조건과 무관해 꺼 두었습니다. 사업자라면 켜세요.</span>}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        {/* 달력 */}
        <section className="card p-3 sm:p-4" aria-label={`${month} 달력`}>
          <div className="flex items-center justify-between">
            {month > minMonth
              ? <Link href={q({ m: shiftMonth(month, -1), d: null })} rel="nofollow" className="btn btn-ghost !px-3 !py-1.5 text-[13px]" aria-label="지난달">‹ 지난달</Link>
              : <span className="w-[4.5rem]" aria-hidden />}
            <h2 className="num text-[1.0625rem] font-extrabold tracking-[-.02em]">
              {Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월
              <span className="ml-2 text-[12.5px] font-semibold text-faint">{where} · {monthTotal.toLocaleString("ko-KR")}건</span>
            </h2>
            {month < maxMonth
              ? <Link href={q({ m: shiftMonth(month, 1), d: null })} rel="nofollow" className="btn btn-ghost !px-3 !py-1.5 text-[13px]" aria-label="다음달">다음달 ›</Link>
              : <span className="w-[4.5rem]" aria-hidden />}
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
                <Link key={c} href={q({ d: c })} scroll={false} rel="nofollow" aria-current={on ? "date" : undefined}
                      className={`flex min-h-[56px] flex-col items-center rounded-[10px] px-0.5 py-1.5 text-[13px] transition-[background-color,transform] hover:-translate-y-0.5 sm:min-h-[64px]
                                  ${on ? "pop bg-brand text-white" : past ? "text-faint hover:bg-ground" : "text-ink2 hover:bg-ground"}`}>
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
              {ym(addDays(day, -1)) >= minMonth && (
                <Link href={q({ d: addDays(day, -1) })} scroll={false} rel="nofollow" className="rounded-ctl px-2 py-1 text-muted hover:bg-ground hover:text-ink">‹ 전날</Link>
              )}
              {ym(addDays(day, 1)) <= maxMonth && (
                <Link href={q({ d: addDays(day, 1) })} scroll={false} rel="nofollow" className="rounded-ctl px-2 py-1 text-muted hover:bg-ground hover:text-ink">다음날 ›</Link>
              )}
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
          {items.length >= 150 && <p className="mt-3 text-[12px] text-faint">갈래마다 150건까지만 보입니다. 지역을 고르면 줄어듭니다.</p>}
        </section>
      </div>

      <p className="mt-6 text-[13px] leading-relaxed text-muted">
        마감일은 기관이 적은 접수 마감일 기준입니다. 당일 접수 시각과 우편 도착 기준은 원문에서 확인하세요.
        시험 일정은 <Link href="/license/schedule" className="underline underline-offset-4 hover:text-brand">자격시험 일정</Link>에서 종목별로 볼 수 있습니다.
      </p>
    </main>
  );
}

const FIRST = 12;

/** 갈래 하나. 12건까지 보이고 나머지는 "더 보기"로 편다(details 라 자바스크립트 없이도 된다). */
function Group({ title, n, tone, children }: { title: string; n: number; tone: string; children: React.ReactNode[] }) {
  const head = children.slice(0, FIRST), rest = children.slice(FIRST);
  return (
    <div className="mt-4">
      <h3 className="flex items-center gap-2 text-[13px] font-bold text-ink2">
        <span className={`rounded-[6px] px-1.5 py-0.5 text-[12px] font-bold ${tone}`}>{title}</span>
        <span className="num text-faint">{n}건</span>
      </h3>
      <ul className="mt-1 divide-y divide-line">{head}</ul>
      {rest.length > 0 && (
        <details className="group mt-1">
          <summary className="cursor-pointer list-none rounded-ctl py-2 text-center text-[13px] font-semibold text-brand hover:bg-ground">
            <span className="group-open:hidden">나머지 {rest.length}건 더 보기</span>
            <span className="hidden group-open:inline">접기</span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">{rest}</ul>
        </details>
      )}
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
