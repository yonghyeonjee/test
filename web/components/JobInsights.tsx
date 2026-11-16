import Link from "next/link";
import type { JobHistory, PastRound } from "@/lib/jobHistory";
import { manwon, type PayCompare } from "@/lib/jobPay";
import type { Job } from "@/lib/pubJobs";

/**
 * 공고 하나에만 해당하는 이 사이트의 자료 세 가지(2026-11-16) — 이 자리의 모집 이력, 마감 뒤 발표까지 걸린 날,
 * 접수 중 공고와 견준 보수. 계산은 lib/jobHistory·lib/jobPay, 여기서는 글과 그림(자료로 그린 SVG)만.
 * 자료가 없는 칸은 그리지 않는다. 그림마다 같은 내용을 글로도 적는다(aria-label, 본문).
 */

const dot = (iso: string) => iso.replaceAll("-", ".");
const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

/** 지난 36개월 가운데 같은 자리 공고가 올라온 달. 달마다 한 칸, 올라온 달은 채운다. */
function MonthsChart({ months }: { months: JobHistory["months"] }) {
  const now = new Date(Date.now() + 9 * 3600e3);
  const cells: { ym: string; n: number; self: boolean }[] = [];
  for (let i = 35; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const ym = d.toISOString().slice(0, 7);
    const hit = months.find((m) => m.ym === ym);
    cells.push({ ym, n: hit?.n ?? 0, self: hit?.self ?? false });
  }
  const filled = cells.filter((c) => c.n > 0);
  const label = `지난 3년 가운데 같은 자리 공고가 올라온 달: ${filled.map((c) => `${c.ym.slice(0, 4)}년 ${Number(c.ym.slice(5))}월 ${c.n}건`).join(", ")}`;
  return (
    <svg viewBox="0 0 364 46" className="mt-3 h-auto w-full" role="img" aria-label={label}>
      <title>{label}</title>
      {cells.map((c, i) => (
        <g key={c.ym}>
          <rect x={2 + i * 10} y={c.n ? 4 : 14} width={8} height={c.n ? 22 : 12} rx={2}
                className={c.self ? "fill-brand" : c.n ? "fill-brand2" : "fill-line"} opacity={c.n && !c.self ? 0.55 : 1} />
          {c.ym.endsWith("-01") && (
            <text x={2 + i * 10} y={42} className="fill-muted" fontSize={9}>{c.ym.slice(0, 4)}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** 접수 마감 → 서류·면접 안내 → 최종 발표. 걸린 날에 비례해 점을 놓는다. */
function PaceChart({ interview, final }: { interview: number | null; final: number | null }) {
  const span = Math.max(final ?? 0, interview ?? 0, 1);
  const x = (d: number) => 14 + Math.round((d / span) * 300);
  const nodes = [
    { d: 0, name: "접수 마감", sub: "0일" },
    ...(interview != null ? [{ d: interview, name: "서류·면접 안내", sub: `+${interview}일` }] : []),
    ...(final != null ? [{ d: final, name: "최종 발표", sub: `+${final}일` }] : []),
  ];
  const label = nodes.map((n) => `${n.name} ${n.sub}`).join(" → ");
  return (
    <svg viewBox="0 0 364 58" className="mt-3 h-auto w-full" role="img" aria-label={`접수 마감 뒤 걸린 날: ${label}`}>
      <title>{label}</title>
      <line x1={14} y1={16} x2={x(span)} y2={16} className="stroke-brandSoft" strokeWidth={4} strokeLinecap="round" />
      {nodes.map((n, i) => {
        // 두 점이 붙으면 글자가 겹친다. 가운데 점은 위로, 끝 점은 오른쪽 맞춤.
        const last = i === nodes.length - 1 && i > 0;
        return (
          <g key={n.name}>
            <circle cx={x(n.d)} cy={16} r={6} className={i === 0 ? "fill-muted" : "fill-brand"} />
            <text x={x(n.d)} y={36} textAnchor={last ? "end" : i === 0 ? "start" : "middle"} dx={last ? 6 : i === 0 ? -6 : 0}
                  className="fill-ink2" fontSize={10} fontWeight={700}>{n.name}</text>
            <text x={x(n.d)} y={50} textAnchor={last ? "end" : i === 0 ? "start" : "middle"} dx={last ? 6 : i === 0 ? -6 : 0}
                  className="fill-muted" fontSize={10}>{n.sub}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** 접수 중 공고의 월 보수를 한 줄에 찍고, 이 공고와 중앙값을 표시한다. */
function PayChart({ p }: { p: PayCompare }) {
  const span = Math.max(1, p.max - p.min);
  const x = (w: number) => 10 + Math.round(((w - p.min) / span) * 340);
  const label = `${p.group} ${p.n}건의 월 보수: 가장 낮은 ${manwon(p.min)}, 가운데 ${manwon(p.median)}, 가장 높은 ${manwon(p.max)}. 이 공고 ${manwon(p.mine.won)}.`;
  return (
    <svg viewBox="0 0 364 62" className="mt-3 h-auto w-full" role="img" aria-label={label}>
      <title>{label}</title>
      <line x1={10} y1={24} x2={350} y2={24} className="stroke-line" strokeWidth={2} strokeLinecap="round" />
      {p.others.map((w, i) => <circle key={i} cx={x(w)} cy={24} r={3.5} className="fill-brand2" opacity={0.35} />)}
      <line x1={x(p.median)} y1={12} x2={x(p.median)} y2={36} className="stroke-muted" strokeWidth={1.5} strokeDasharray="3 2" />
      <circle cx={x(p.mine.won)} cy={24} r={7} className="fill-brand stroke-surface" strokeWidth={2} />
      <text x={10} y={52} className="fill-muted" fontSize={10}>{manwon(p.min)}</text>
      <text x={350} y={52} textAnchor="end" className="fill-muted" fontSize={10}>{manwon(p.max)}</text>
      <text x={Math.min(300, Math.max(60, x(p.median)))} y={8} textAnchor="middle" className="fill-muted" fontSize={9}>가운데 {manwon(p.median)}</text>
    </svg>
  );
}

const roundLine = (r: PastRound) =>
  [r.periodDays ? `접수 ${r.periodDays}일` : null, r.again, r.final ? `마감 ${r.final.after}일 뒤 최종 발표` : r.interview ? `마감 ${r.interview.after}일 뒤 서류·면접 안내` : null]
    .filter(Boolean).join(" · ");

export default function JobInsights({ job, history, pay }: { job: Job; history: JobHistory | null; pay: PayCompare | null }) {
  const h = history;
  const open = job.status !== "closed";
  const showPast = Boolean(h && h.past.length > 0);
  const showPace = Boolean(h && (h.pace || h.self.interview || h.self.final));
  if (!showPast && !showPace && !pay) return null;
  const payNote = pay ? [pay.mine.basis === "연봉÷12" ? "연봉을 12로 나눈 값" : null, pay.mine.floor ? "범위의 하한" : null].filter(Boolean).join(", ") : "";
  const avgPeriod =h && h.past.length ? Math.round(h.past.flatMap((r) => (r.periodDays ? [r.periodDays] : [])).reduce((a, b, _, xs) => a + b / xs.length, 0)) : 0;

  return (
    <>
      {showPast && h && (
        <section className="mt-10" aria-labelledby="job-hist-h">
          <h2 id="job-hist-h" className="sec-title text-[1.0625rem] font-extrabold">이 자리, 전에도 뽑았나</h2>
          <p className="mt-3 text-[15px] leading-[1.85] text-ink2">
            {job.org}의 같은 자리 모집 공고가 지난 3년 동안 이 공고 말고 <strong className="num">{h.past.length}번</strong> 더 올라왔습니다.
            {" "}바로 앞 공고는 <strong>{dot(h.past[0].reg)}</strong>에 올라왔습니다
            {h.past[0].end && job.reg && h.past[0].end >= job.reg ? "(아직 접수 중이거나 이 공고와 겹칩니다)" : ""}.
            {h.gapDays ? <> 공고 사이 간격은 보통 <strong className="num">{h.gapDays}일</strong>입니다.</> : null}
            {avgPeriod > 0 ? <> 지난 공고의 접수 기간은 평균 <strong className="num">{avgPeriod}일</strong>이었습니다.</> : null}
          </p>
          <MonthsChart months={h.months} />
          <p className="mt-1 text-[12px] text-faint">한 칸이 한 달입니다. 진한 칸이 이 공고, 옅은 칸이 같은 자리의 지난 공고입니다.</p>
          <ol className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
            {h.past.slice(0, 6).map((r) => (
              <li key={r.id} className="px-4 py-3">
                <Link href={`/jobs/${encodeURIComponent(r.id)}`} className="block text-[14px] font-semibold leading-snug hover:text-brand">{r.title}</Link>
                <span className="mt-1 block text-[12.5px] text-muted">
                  <span className="num">{dot(r.reg)}</span> 등록{r.end ? <> · <span className="num">{dot(r.end)}</span> 마감</> : null}
                  {roundLine(r) ? ` · ${roundLine(r)}` : ""}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[12px] leading-relaxed text-faint">
            제목에서 연도·회차·절차 낱말을 뺀 나머지가 같은 공고를 같은 자리로 셌습니다. 기관이 제목을 다르게 쓴 모집은 빠져 있을 수 있습니다.
          </p>
        </section>
      )}

      {showPace && h && (
        <section className="mt-10" aria-labelledby="job-pace-h">
          <h2 id="job-pace-h" className="sec-title text-[1.0625rem] font-extrabold">마감 뒤 발표까지 얼마나 걸렸나</h2>
          {(h.self.interview || h.self.final) && (
            <p className="mt-3 text-[15px] leading-[1.85] text-ink2">
              이 모집은{" "}
              {h.self.interview && <>마감 <strong className="num">{h.self.interview.after}일</strong> 뒤({dot(h.self.interview.reg)})에 <Link href={`/jobs/${encodeURIComponent(h.self.interview.id)}`} className="underline underline-offset-4 hover:text-brand">서류·면접 안내 공고</Link>가</>}
              {h.self.interview && h.self.final && ", "}
              {h.self.final && <>마감 <strong className="num">{h.self.final.after}일</strong> 뒤({dot(h.self.final.reg)})에 <Link href={`/jobs/${encodeURIComponent(h.self.final.id)}`} className="underline underline-offset-4 hover:text-brand">최종 합격자 공고</Link>가</>}
              {" "}올라왔습니다.
            </p>
          )}
          {h.pace && (
            <>
              <p className="mt-3 text-[15px] leading-[1.85] text-ink2">
                {h.pace.scope === "same" ? "같은 자리의 지난 모집" : `${job.org}의 지난 모집`} <strong className="num">{h.pace.rounds}건</strong>에서는 접수 마감 뒤
                {h.pace.interview != null && <> 서류·면접 안내 공고까지 보통 <strong className="num">{h.pace.interview}일</strong></>}
                {h.pace.interview != null && h.pace.final != null && ","}
                {h.pace.final != null && <> 최종 합격자 공고까지 보통 <strong className="num">{h.pace.final}일</strong></>}
                {" "}걸렸습니다.
                {open && job.end && (h.pace.interview != null || h.pace.final != null) && (
                  <> 이번 마감({md(job.end)})에 그대로 대어 보면
                    {h.pace.interview != null && <> 서류·면접 안내는 <strong>{md(addDays(job.end, h.pace.interview))} 무렵</strong></>}
                    {h.pace.interview != null && h.pace.final != null && ","}
                    {h.pace.final != null && <> 최종 발표는 <strong>{md(addDays(job.end, h.pace.final))} 무렵</strong></>}
                    입니다.
                  </>
                )}
              </p>
              <PaceChart interview={h.pace.interview} final={h.pace.final} />
            </>
          )}
          <p className="mt-2 text-[12px] leading-relaxed text-faint">
            나라일터에 올라온 발표 공고의 등록일로 센 실적입니다. 발표를 누리집에만 올리는 기관은 잡히지 않고, 이번 일정은 공고문에 적힌 날짜가 기준입니다.
          </p>
        </section>
      )}

      {pay && (
        <section className="mt-10" aria-labelledby="job-pay-h">
          <h2 id="job-pay-h" className="sec-title text-[1.0625rem] font-extrabold">보수는 어느 정도인가</h2>
          <p className="mt-3 text-[15px] leading-[1.85] text-ink2">
            공고문에 적힌 보수를 월로 치면 <strong className="num">{manwon(pay.mine.won)}</strong>{payNote ? `(${payNote})` : ""}입니다.
            {" "}지금 접수 중인 {pay.group} 가운데 보수가 월 금액으로 읽히는 <strong className="num">{pay.n}건</strong>에서 <strong className="num">{pay.rank}번째</strong>로 높고,
            가운데 값은 {manwon(pay.median)}입니다.
          </p>
          <PayChart p={pay} />
          <p className="mt-1 text-[12px] leading-relaxed text-faint">
            큰 점이 이 공고, 점선이 가운데 값입니다. 전일제(주 35시간 이상)·모집 분야가 하나인 공고만 견줬고, 수당·상여는 공고마다 달라 뺐습니다.
          </p>
        </section>
      )}
    </>
  );
}
