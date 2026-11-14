"use client";

import { useEffect, useMemo, useState } from "react";
import { DIM_LABEL, FIRST_DAY, PRESETS, type Dim, type Src, type StatRow } from "@/lib/adminStats";
import StatsExplorer from "./StatsExplorer";

/**
 * 관리자 통계 한 판(2026-11-15). 맨 위에서 기간을 한 번 고르면 요약 숫자·순위·그래프가 모두 그 기간으로 맞춰진다.
 *
 * 전에는 숫자 칸은 오늘·7일·30일로 고정, 순위는 최근 30일 표본 1,000건, 그래프만 기간을 고를 수 있어
 * 화면의 숫자들이 서로 다른 기간을 말했다. 검색 수와 방문 수가 따로 놀아 보이던 것도 그 때문이다.
 * 이제 같은 기간의 방문·검색을 나란히 두고 "방문 1명당 검색 몇 번"으로 읽는다.
 * 자료는 전부 /admin/stats(sql/019 admin_stat_series)로 DB 전체를 센다 — 표본이 아니다.
 */

const kst = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(t));
const kstStart = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`).getTime();
type Range = { from: number; to: number };

function presetRange(key: string): Range {
  const to = kstStart(kst(Date.now())) + 86400_000;
  const p = PRESETS.find((x) => x.key === key) ?? PRESETS[2];
  if (p.days === null) return { from: kstStart(FIRST_DAY), to };
  if (p.days === -1) return { from: kstStart(`${kst(Date.now()).slice(0, 4)}-01-01`), to };
  return { from: to - p.days * 86400_000, to };
}

const VISIT_DIMS: Dim[] = ["channel", "category", "landing", "term", "campaign"];
const SEARCH_DIMS: Dim[] = ["kind", "sido", "age_band", "employment", "entry", "zero"];
type Got = Partial<Record<Dim, { k: string; n: number }[]>>;

function pretty(v: string) {
  try { return /%[0-9A-Fa-f]{2}/.test(v) ? decodeURIComponent(v) : v; } catch { return v; }
}

function Rank({ rows, unit }: { rows: { k: string; n: number }[] | undefined; unit: string }) {
  if (!rows) return <p className="text-sm text-faint">불러오는 중…</p>;
  const list = rows.filter((r) => r.k !== "(없음)");
  if (!list.length) return <p className="text-sm text-muted">이 기간에는 기록이 없습니다.</p>;
  const max = Math.max(...list.map((r) => r.n), 1);
  const total = rows.reduce((a, r) => a + r.n, 0);
  return (
    <ol className="space-y-0.5">
      {list.slice(0, 10).map((r, i) => (
        <li key={r.k} className="flex items-center px-1 py-1.5 text-sm">
          <span className="num w-5 shrink-0 text-xs text-faint">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate" title={pretty(r.k)}>{pretty(r.k)}</span>
          <span className="ml-3 hidden h-1.5 w-24 shrink-0 rounded-pill bg-line sm:block" aria-hidden>
            <span className="block h-full rounded-pill bg-brand2/50" style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
          <span className="num ml-3 w-12 shrink-0 text-right text-xs text-muted">{r.n.toLocaleString("ko-KR")}{unit}</span>
          <span className="num ml-2 w-11 shrink-0 text-right text-xs text-faint">{total ? ((r.n / total) * 100).toFixed(0) : 0}%</span>
        </li>
      ))}
    </ol>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-bold">{title}</h3>
        {note && <span className="text-[11px] text-faint">{note}</span>}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export default function StatsBoard() {
  const [preset, setPreset] = useState("30d");
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: kst(Date.now() - 29 * 86400_000), to: kst(Date.now()) });
  const [got, setGot] = useState<Got>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const range: Range = useMemo(() => {
    if (preset !== "custom") return presetRange(preset);
    const from = kstStart(custom.from), to = kstStart(custom.to) + 86400_000;
    return from < to ? { from, to } : { from: to - 86400_000, to };
  }, [preset, custom]);

  useEffect(() => {
    const ctl = new AbortController();
    setBusy(true); setError(null); setGot({});
    const one = async (src: Src, dim: Dim) => {
      const qs = new URLSearchParams({ src, dim, unit: "year", top: "12", from: new Date(range.from).toISOString(), to: new Date(range.to).toISOString() });
      const r = await fetch(`/admin/stats?${qs}`, { signal: ctl.signal, cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? r.statusText);
      // 해가 바뀌는 기간이면 구간이 둘이다. 값별로 더한다.
      const m = new Map<string, number>();
      for (const x of j.rows as StatRow[]) m.set(x.k, (m.get(x.k) ?? 0) + x.n);
      const rows = [...m.entries()].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
      setGot((g) => ({ ...g, [dim]: rows }));
    };
    Promise.all([...VISIT_DIMS.map((d) => one("visit", d)), ...SEARCH_DIMS.map((d) => one("search", d))])
      .catch((e: unknown) => { if ((e as Error).name !== "AbortError") setError((e as Error).message); })
      .finally(() => setBusy(false));
    return () => ctl.abort();
  }, [range]);

  const sum = (rows?: { k: string; n: number }[]) => (rows ? rows.reduce((a, r) => a + r.n, 0) : null);
  const visits = sum(got.channel);
  const searches = sum(got.kind);
  const zero = got.zero ? got.zero.find((r) => r.k === "결과 0건")?.n ?? 0 : null;
  const days = Math.max(1, Math.round((range.to - range.from) / 86400_000));
  const perVisit = visits && searches !== null ? searches / visits : null;
  const fmt = (v: number | null, digits = 0) => (v === null ? "…" : v.toLocaleString("ko-KR", { maximumFractionDigits: digits, minimumFractionDigits: digits }));

  // 두 원의 넓이를 건수에 비례하게. 겹침은 그리지 않는다 — 방문 기록과 검색 기록은 누구인지 이어 두지 않아(개인정보)
  // "방문한 사람 가운데 몇 명이 검색했는지"는 알 수 없다.
  const big = Math.max(visits ?? 0, searches ?? 0, 1);
  const rad = (v: number | null) => Math.max(6, 46 * Math.sqrt((v ?? 0) / big));

  const tiles: { k: string; v: string; sub?: string }[] = [
    { k: "방문", v: `${fmt(visits)}명`, sub: visits !== null ? `하루 평균 ${fmt(visits / days, 1)}명` : undefined },
    { k: "검색(조건 조회)", v: `${fmt(searches)}건`, sub: searches !== null ? `하루 평균 ${fmt(searches / days, 1)}건` : undefined },
    { k: "방문 1명당 검색", v: perVisit === null ? "…" : `${fmt(perVisit, 2)}번`, sub: "검색 ÷ 방문" },
    { k: "결과 0건 검색", v: zero === null ? "…" : `${fmt(zero)}건`, sub: searches ? `검색의 ${fmt(((zero ?? 0) / searches) * 100, 1)}%` : undefined },
  ];

  return (
    <section id="a-visit" className="mt-4 scroll-mt-14" aria-labelledby="stats-h">
      <div className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="stats-h" className="text-sm font-bold">통계</h2>
          <span className="text-xs text-faint">기간을 고르면 아래 숫자·순위·그래프가 모두 그 기간으로 바뀝니다 · DB 전체를 셈</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="기간">
          {[...PRESETS.map((p) => ({ v: p.key, t: p.label })), { v: "custom", t: "직접" }].map((it) => (
            <button key={it.v} type="button" onClick={() => setPreset(it.v)} aria-pressed={preset === it.v}
                    className={`rounded-pill px-3 py-1.5 text-[13px] font-semibold transition-colors ${preset === it.v ? "bg-ink text-white" : "bg-ground text-ink2 hover:bg-brandSoft hover:text-brand"}`}>
              {it.t}
            </button>
          ))}
          {preset === "custom" && (
            <span className="inline-flex items-center gap-1">
              <input type="date" min={FIRST_DAY} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="field w-auto px-2 py-1 text-xs" aria-label="시작일" />
              <span className="text-faint">~</span>
              <input type="date" min={FIRST_DAY} value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="field w-auto px-2 py-1 text-xs" aria-label="끝일" />
            </span>
          )}
          <span className="num ml-auto text-xs text-muted">{kst(range.from)} ~ {kst(range.to - 1)} · {days}일{busy ? " · 불러오는 중…" : ""}</span>
        </div>
        {error && <p className="mt-3 rounded-ctl bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_15rem]">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.k} className="rounded-card border border-line p-4">
                <dt className="text-xs text-muted">{t.k}</dt>
                <dd className="num mt-1 text-2xl font-extrabold">{t.v}</dd>
                {t.sub && <dd className="num mt-0.5 text-[11px] text-faint">{t.sub}</dd>}
              </div>
            ))}
          </dl>
          <figure className="rounded-card border border-line p-3">
            <svg viewBox="0 0 220 110" role="img" aria-label={`방문 ${fmt(visits)}명과 검색 ${fmt(searches)}건의 크기 비교`} className="h-auto w-full">
              <circle cx={62} cy={55} r={rad(visits)} fill="#4A6CF7" fillOpacity={0.28} stroke="#4A6CF7" />
              <circle cx={158} cy={55} r={rad(searches)} fill="#F59E0B" fillOpacity={0.28} stroke="#F59E0B" />
              <text x={62} y={59} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1f2937">방문</text>
              <text x={158} y={59} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1f2937">검색</text>
            </svg>
            <figcaption className="mt-1 text-[11px] leading-relaxed text-faint">
              원의 넓이가 건수입니다. 겹치는 부분(방문자 중 검색한 사람)은 두 기록을 이어 두지 않아 알 수 없습니다.
            </figcaption>
          </figure>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="유입 채널" note="방문"><Rank rows={got.channel} unit="" /></Card>
        <Card title="처음 열린 화면 갈래" note="방문"><Rank rows={got.category} unit="" /></Card>
        <Card title="처음 열린 화면" note="방문"><Rank rows={got.landing} unit="" /></Card>
        <Card title="유입 검색어" note="다음·카카오만 넘겨 줍니다"><Rank rows={got.term} unit="" /></Card>
        <Card title="캠페인" note="utm_campaign"><Rank rows={got.campaign} unit="" /></Card>
        <Card title="검색한 갈래" note="검색"><Rank rows={got.kind} unit="" /></Card>
        <Card title="많이 찾는 지역" note="검색"><Rank rows={got.sido} unit="" /></Card>
        <Card title="많이 찾는 나이대" note="검색"><Rank rows={got.age_band} unit="" /></Card>
        <Card title="많이 찾는 취업상태" note="검색"><Rank rows={got.employment} unit="" /></Card>
        <Card title={DIM_LABEL.entry} note="화면에서 어떻게 찾았는지"><Rank rows={got.entry} unit="" /></Card>
      </div>

      <div className="card mt-4 p-5">
        <h3 className="text-[13px] font-bold">날짜별 흐름</h3>
        <p className="mt-0.5 text-xs text-faint">위에서 고른 기간 그대로입니다. 자료·단위·나누기만 여기서 바꿉니다.</p>
        <div className="mt-3"><StatsExplorer initial={null} range={range} /></div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-faint">
        방문은 한 탭에서 첫 화면을 열 때 한 번(크롤러·자동화 브라우저 제외), 검색은 조건을 넣어 조회한 횟수(크롤러 제외)입니다.
        광고 클릭은 여기서 세지 않습니다 — 애드센스 클릭은 애드센스 보고서에만 남습니다.
      </p>
    </section>
  );
}
