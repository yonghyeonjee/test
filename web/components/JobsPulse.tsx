import Link from "next/link";

import { normSido } from "@/lib/geo";
import { regionTokens, type Job } from "@/lib/pubJobs";

/**
 * 채용 허브의 "이번 주 흐름"(2026-10-24). 같은 틀의 목록만 있는 쪽은 구글이 "크롤링됨 - 색인 안 됨"으로 미뤄 둔다.
 * 이미 읽어 온 공고 목록에서 이번 주 숫자와 많이 뽑는 기관·지역, 곧 마감하는 공고를 세어 글로 적는다 — 긁어 갈 때마다
 * 내용이 달라지는, 이 사이트에만 있는 문단이다. DB 를 더 읽지 않는다.
 */

const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const shift = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const dot = (ymd: string) => `${ymd.slice(5, 7)}.${ymd.slice(8, 10)}`;

function top(counts: Map<string, number>, n: number) {
  return [...counts].filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}

export function jobsPulse(jobs: Job[], today = kst()) {
  const weekAgo = shift(today, -7);
  const soonEnd = shift(today, 3);
  const open = jobs.filter((j) => j.status !== "closed");
  const fresh = open.filter((j) => j.reg && j.reg >= weekAgo);
  const closing = open
    .filter((j) => j.end && j.end >= today && j.end <= soonEnd)
    .sort((a, b) => (a.end! < b.end! ? -1 : a.end! > b.end! ? 1 : 0));
  const orgs = new Map<string, number>();
  const sidos = new Map<string, number>();
  const hires = new Map<string, number>();
  for (const j of open) {
    if (j.org) orgs.set(j.org, (orgs.get(j.org) ?? 0) + 1);
    if (j.hire) hires.set(j.hire, (hires.get(j.hire) ?? 0) + 1);
    const seen = new Set<string>();
    for (const t of regionTokens(j.region)) {
      const s = normSido(t);
      if (s && !seen.has(s)) { seen.add(s); sidos.set(s, (sidos.get(s) ?? 0) + 1); }
    }
  }
  return {
    today, open: open.length, fresh: fresh.length, closing,
    orgs: top(orgs, 5), sidos: top(sidos, 5), hires: top(hires, 4),
  };
}

export default function JobsPulse({ jobs, scope }: { jobs: Job[]; scope?: string }) {
  const p = jobsPulse(jobs);
  if (p.open === 0) return null;
  const where = scope ? `${scope}에서 ` : "";
  return (
    <section className="mt-12" aria-labelledby="jobs-pulse">
      <h2 id="jobs-pulse" className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
        {dot(p.today)} 기준, {scope ?? "공공기관"} 채용 흐름
      </h2>
      <p className="mt-4 text-[15px] leading-[1.85] text-ink2">
        지금 {where}접수 중인 공고는 <b className="num">{p.open.toLocaleString()}건</b>이고, 그중{" "}
        <b className="num">{p.fresh.toLocaleString()}건</b>은 지난 이레 안에 새로 올라왔습니다.
        {p.closing.length > 0 && (
          <> 사흘 안에 마감하는 공고가 <b className="num">{p.closing.length}건</b> 있어, 준비된 서류가 있으면 이번 주 안에 내셔야 합니다.</>
        )}
        {p.hires.length > 0 && (
          <> 고용형태는 {p.hires.map(([h, n], i) => (
            <span key={h}>{i > 0 && ", "}{h} <span className="num">{n}건</span></span>
          ))} 순입니다.</>
        )}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {p.orgs.length > 0 && (
          <div className="card p-4">
            <h3 className="text-[14px] font-bold">지금 많이 뽑는 기관</h3>
            <ul className="mt-2 space-y-1 text-[14px]">
              {p.orgs.map(([o, n]) => (
                <li key={o} className="flex justify-between gap-3">
                  <Link href={`/jobs/org/${encodeURIComponent(o)}`} className="truncate hover:text-brand">{o}</Link>
                  <span className="num shrink-0 text-muted">{n}건</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!scope && p.sidos.length > 0 && (
          <div className="card p-4">
            <h3 className="text-[14px] font-bold">공고가 많은 지역</h3>
            <ul className="mt-2 space-y-1 text-[14px]">
              {p.sidos.map(([s, n]) => (
                <li key={s} className="flex justify-between gap-3">
                  <Link href={`/jobs/region/${encodeURIComponent(s)}`} className="hover:text-brand">{s}</Link>
                  <span className="num shrink-0 text-muted">{n}건</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {p.closing.length > 0 && (
          <div className={`card p-4 ${scope ? "" : "sm:col-span-2"}`}>
            <h3 className="text-[14px] font-bold">사흘 안에 마감</h3>
            <ul className="mt-2 space-y-1 text-[14px]">
              {p.closing.slice(0, 6).map((j) => (
                <li key={j.id} className="flex justify-between gap-3">
                  <Link href={`/jobs/${encodeURIComponent(j.id)}`} className="truncate hover:text-brand">
                    {j.org ? `${j.org} · ` : ""}{j.title}
                  </Link>
                  <span className="num shrink-0 text-muted">~{dot(j.end!)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
