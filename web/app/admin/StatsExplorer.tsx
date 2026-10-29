"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DIM_LABEL, DIMS, FIRST_DAY, PRESETS, SRC_LABEL, UNIT_LABEL, UNITS, defaultUnit,
  type Dim, type Src, type StatRow, type Unit,
} from "@/lib/adminStats";

/**
 * 관리자 통계 탐색기(2026-10-29). 자료(유입·검색) × 기간(오늘~전체, 직접 지정) × 단위(시간·일·주·월·년) × 차원(채널·사이트·
 * 갈래·도착 화면·…)을 골라 본다. 그래프는 차원별로 쌓은 막대, 아래 표는 차원별 건수와 비율.
 * 자료는 /admin/stats(sql/019) 가 DB 전체를 세어 준다 — 표본이 아니다. 전에는 채널 하나·30일 표본 1,000건으로 고정이었다.
 */

const PALETTE = ["#4A6CF7", "#03C75A", "#EA4335", "#F59E0B", "#0C8484", "#10A37F", "#8B5CF6", "#EC4899", "#64748B", "#A16207", "#0EA5E9", "#84CC16", "#9AA3AF"];
const FIXED: Record<string, string> = {
  "직접 유입": "#9AA3AF", "(직접)": "#9AA3AF", "네이버": "#03C75A", "다음·카카오": "#4A6CF7", "구글": "#EA4335", "빙": "#0C8484",
  "chatgpt.com": "#10A37F", "(기타)": "#CBD5E1", "(없음)": "#CBD5E1",
};

/** 한국 날짜 "YYYY-MM-DD". */
const kst = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(t));
/** 한국 자정(그 날짜의 00:00 KST)을 UTC ms 로. */
const kstStart = (ymd: string) => new Date(`${ymd}T00:00:00+09:00`).getTime();

type Range = { from: number; to: number };

function presetRange(key: string): Range {
  const todayStart = kstStart(kst(Date.now()));
  const to = todayStart + 86400_000;
  const p = PRESETS.find((x) => x.key === key) ?? PRESETS[2];
  if (p.days === null) return { from: kstStart(FIRST_DAY), to };
  if (p.days === -1) return { from: kstStart(`${kst(Date.now()).slice(0, 4)}-01-01`), to };
  return { from: to - p.days * 86400_000, to };
}

/** 구간 열쇠를 처음부터 끝까지 빠짐없이 만든다(빈 구간도 0 으로 보이게). */
function bucketKeys(unit: Unit, r: Range): string[] {
  const out: string[] = [];
  const fmtHour = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
  const hourKey = (t: number) => { const p = Object.fromEntries(fmtHour.formatToParts(new Date(t)).map((x) => [x.type, x.value])); return `${p.year}-${p.month}-${p.day} ${p.hour}`; };
  if (unit === "hour") { for (let t = r.from; t < r.to && out.length < 24 * 32; t += 3600_000) out.push(hourKey(t)); return out; }
  if (unit === "day") { for (let t = r.from; t < r.to && out.length < 800; t += 86400_000) out.push(kst(t)); return out; }
  if (unit === "week") {
    const d0 = new Date(`${kst(r.from)}T00:00:00+09:00`); const dow = (d0.getUTCDay() + 6) % 7;
    for (let t = d0.getTime() - dow * 86400_000; t < r.to && out.length < 400; t += 7 * 86400_000) out.push(kst(t));
    return out;
  }
  const a = kst(r.from), z = kst(r.to - 1);
  if (unit === "year") { for (let y = Number(a.slice(0, 4)); y <= Number(z.slice(0, 4)); y++) out.push(String(y)); return out; }
  let y = Number(a.slice(0, 4)), m = Number(a.slice(5, 7));
  const yz = Number(z.slice(0, 4)), mz = Number(z.slice(5, 7));
  while (y < yz || (y === yz && m <= mz)) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

function labelOf(unit: Unit, k: string) {
  if (unit === "hour") return `${Number(k.slice(11))}시`;
  if (unit === "month") return `${Number(k.slice(5, 7))}월`;
  if (unit === "year") return k;
  return k.slice(5).replace("-", ".");
}

type Props = { initial: StatRow[] | null; initialError?: string | null };

export default function StatsExplorer({ initial, initialError }: Props) {
  const [src, setSrc] = useState<Src>("visit");
  const [preset, setPreset] = useState("30d");
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: kst(Date.now() - 29 * 86400_000), to: kst(Date.now()) });
  const [unit, setUnit] = useState<Unit>("day");
  const [dim, setDim] = useState<Dim>("channel");
  const [rows, setRows] = useState<StatRow[] | null>(initial);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);
  const [first, setFirst] = useState(true);

  const range: Range = useMemo(() => {
    if (preset !== "custom") return presetRange(preset);
    const from = kstStart(custom.from), to = kstStart(custom.to) + 86400_000;
    return from < to ? { from, to } : { from: to - 86400_000, to };
  }, [preset, custom]);

  // 기간을 바꾸면 단위를 거기 맞는 것으로. 사람이 단위를 따로 고르면 그 뒤로는 손대지 않는다(unitTouched).
  const [unitTouched, setUnitTouched] = useState(false);
  useEffect(() => { if (!unitTouched) setUnit(defaultUnit(range.from, range.to)); }, [range, unitTouched]);
  // 자료를 바꾸면 그 자료의 첫 차원으로.
  const dims = DIMS[src] as readonly Dim[];
  useEffect(() => { if (!dims.includes(dim)) setDim(dims[0]); }, [src, dims, dim]);

  useEffect(() => {
    // 처음 한 번은 서버가 준 자료(30일·일·채널)를 그대로 쓴다.
    if (first && initial && src === "visit" && preset === "30d" && unit === "day" && dim === "channel") { setFirst(false); return; }
    setFirst(false);
    const ctl = new AbortController();
    const qs = new URLSearchParams({ src, from: new Date(range.from).toISOString(), to: new Date(range.to).toISOString(), unit, dim });
    setBusy(true); setError(null);
    fetch(`/admin/stats?${qs}`, { signal: ctl.signal, cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? r.statusText); setRows(j.rows as StatRow[]); })
      .catch((e: unknown) => { if ((e as Error).name !== "AbortError") setError((e as Error).message); })
      .finally(() => setBusy(false));
    return () => ctl.abort();
  }, [src, range, unit, dim]); // eslint-disable-line react-hooks/exhaustive-deps

  // 그래프 자료: 구간 × 값.
  const keys = useMemo(() => bucketKeys(unit, range), [unit, range]);
  const { buckets, totals, total, series } = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows ?? []) totals.set(r.k, (totals.get(r.k) ?? 0) + r.n);
    const series = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const idx = new Map(keys.map((k, i) => [k, i]));
    const buckets = keys.map((k) => ({ key: k, total: 0, by: new Map<string, number>() }));
    for (const r of rows ?? []) { const i = idx.get(r.b); if (i === undefined) continue; buckets[i].total += r.n; buckets[i].by.set(r.k, (buckets[i].by.get(r.k) ?? 0) + r.n); }
    const total = [...totals.values()].reduce((a, b) => a + b, 0);
    return { buckets, totals, total, series };
  }, [rows, keys]);
  const color = (k: string) => FIXED[k] ?? PALETTE[series.indexOf(k) % PALETTE.length];
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const days = Math.max(1, Math.round((range.to - range.from) / 86400_000));
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 12));
  const unitDisabled = (u: Unit) => u === "hour" && range.to - range.from > 31 * 86400_000;

  const Seg = <T extends string>({ value, items, onPick }: { value: T; items: { v: T; t: string; off?: boolean }[]; onPick: (v: T) => void }) => (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => (
        <button key={it.v} type="button" disabled={it.off} onClick={() => onPick(it.v)}
          className={`rounded-pill px-2.5 py-1 text-[12.5px] font-semibold transition-colors disabled:opacity-40 ${it.v === value ? "bg-ink text-white" : "bg-ground text-ink2 hover:bg-brandSoft hover:text-brand"}`}>
          {it.t}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div className="grid gap-3 text-xs sm:grid-cols-[auto_1fr] sm:items-center">
        <span className="font-bold text-muted">자료</span>
        <Seg value={src} items={(Object.keys(SRC_LABEL) as Src[]).map((s) => ({ v: s, t: SRC_LABEL[s] }))} onPick={setSrc} />
        <span className="font-bold text-muted">기간</span>
        <div className="flex flex-wrap items-center gap-2">
          <Seg value={preset} items={[...PRESETS.map((p) => ({ v: p.key, t: p.label })), { v: "custom", t: "직접" }]} onPick={setPreset} />
          {preset === "custom" && (
            <span className="inline-flex items-center gap-1">
              <input id="stat-from" type="date" min={FIRST_DAY} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="field w-auto px-2 py-1 text-xs" aria-label="시작일" />
              <span className="text-faint">~</span>
              <input id="stat-to" type="date" min={FIRST_DAY} value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="field w-auto px-2 py-1 text-xs" aria-label="끝일" />
            </span>
          )}
        </div>
        <span className="font-bold text-muted">단위</span>
        <Seg value={unit} items={UNITS.map((u) => ({ v: u, t: UNIT_LABEL[u], off: unitDisabled(u) }))} onPick={(u) => { setUnitTouched(true); setUnit(u); }} />
        <span className="font-bold text-muted">나누기</span>
        <Seg value={dim} items={dims.map((d) => ({ v: d, t: DIM_LABEL[d] }))} onPick={setDim} />
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="num text-2xl font-extrabold">{total.toLocaleString("ko-KR")}<span className="ml-1 text-xs font-normal text-muted">{src === "visit" ? "명" : "건"}</span></span>
        <span className="num text-xs text-muted">하루 평균 {(total / days).toFixed(1)} · {kst(range.from)} ~ {kst(range.to - 1)} · {UNIT_LABEL[unit]} 단위 · {DIM_LABEL[dim]}별</span>
        {busy && <span className="text-xs text-faint">불러오는 중…</span>}
      </div>
      {error && (
        <p className="mt-2 rounded-ctl bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}{/admin_stat_series/.test(error) && " — sql/019_admin_stat_series.sql 을 Supabase 에 적용하세요."}
        </p>
      )}

      {/* 쌓은 막대. 구간마다 값별로 쌓고, 올리면 숫자를 보인다. */}
      <div className="mt-3">
        <div className="flex h-40 items-end gap-[2px]">
          {buckets.map((b) => (
            <div key={b.key} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
              {series.filter((k) => b.by.has(k)).map((k) => (
                <div key={k} style={{ height: `${((b.by.get(k) ?? 0) / max) * 100}%`, background: color(k) }} className="w-full first:rounded-t-[2px]" />
              ))}
              {b.total === 0 && <div className="h-[2px] w-full bg-line" />}
              <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden max-w-[70vw] -translate-x-1/2 truncate whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                {labelOf(unit, b.key)} · {b.total.toLocaleString("ko-KR")}
                {b.by.size ? " (" + series.filter((k) => b.by.has(k)).map((k) => `${k} ${b.by.get(k)}`).join(", ") + ")" : ""}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-[2px] text-[10px] text-faint">
          {buckets.map((b, i) => (
            <span key={b.key} className="min-w-0 flex-1 truncate text-center">{i % labelEvery === 0 || i === buckets.length - 1 ? labelOf(unit, b.key) : ""}</span>
          ))}
        </div>
      </div>

      {/* 값별 건수와 비율. */}
      <ul className="mt-4 space-y-0.5">
        {series.map((k) => {
          const n = totals.get(k) ?? 0;
          return (
            <li key={k} className="flex items-center px-1 py-1 text-[13px]">
              <i className="mr-2 inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color(k) }} />
              <span className="min-w-0 flex-1 truncate" title={k}>{pretty(k)}</span>
              <span className="ml-3 hidden h-1.5 w-40 rounded-pill bg-line sm:block">
                <span className="block h-full rounded-pill" style={{ width: `${(n / Math.max(total, 1)) * 100}%`, background: color(k) }} />
              </span>
              <span className="num ml-3 w-14 shrink-0 text-right text-xs text-muted">{n.toLocaleString("ko-KR")}</span>
              <span className="num ml-2 w-12 shrink-0 text-right text-xs text-faint">{total ? ((n / total) * 100).toFixed(1) : "0.0"}%</span>
            </li>
          );
        })}
        {!series.length && !busy && !error && <li className="text-sm text-muted">이 기간에는 기록이 없습니다.</li>}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-faint">
        유입은 한 탭에서 첫 화면을 열 때 한 번(크롤러·자동화 브라우저 제외), 검색은 조건을 넣어 조회한 횟수(크롤러 제외)입니다.
        값이 많은 차원은 상위 12개만 두고 나머지를 (기타)로 묶습니다. 시각은 한국 기준입니다.
      </p>
    </div>
  );
}

/** 기록에 남은 주소는 %EC%84%9C 꼴이라 읽을 수 없다. 한글로 풀고, 못 풀면 그대로. */
function pretty(v: string) {
  try { return /%[0-9A-Fa-f]{2}/.test(v) ? decodeURIComponent(v) : v; } catch { return v; }
}
