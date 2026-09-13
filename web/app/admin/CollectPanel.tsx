"use client";

import { useState } from "react";
import { COLLECT_LABEL, type CollectKey, type CollectResult } from "@/lib/collectors";
import type { LastRun } from "@/lib/jobsIngest";
import { probeJobsApi, runCollectAll, runCollectOne, stopCollect } from "./actions";

export type SourceStat = { key: CollectKey; n: number; newest: string | null; fetched: string | null };

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "방금" : m < 60 ? `${m}분 전` : `${Math.round(m / 60)}시간 전`;
};

/** 마지막 채용 수집 기록. 함수가 죽어도 DB 에 남아 새로고침으로 보인다. */
function LastRunLine({ run }: { run: LastRun | null }) {
  if (!run) return null;
  const label = run.source === "gojobs" ? "나라일터" : "월드잡";
  const who = run.by === "cron" ? "자동" : "수동";
  if (run.state === "running") {
    const stale = Date.now() - new Date(run.startedAt).getTime() > 90_000;
    return (
      <p className={`mt-3 rounded-ctl px-3 py-2 text-xs ${stale ? "bg-alertSoft text-alert" : "bg-brandSoft text-brand"}`}>
        {stale
          ? `${label} ${who} 수집이 ${ago(run.startedAt)} 시작한 뒤 끝나지 않았습니다. 시간 초과로 죽었을 가능성이 큽니다.`
          : `${label} ${who} 수집이 도는 중입니다 (${ago(run.startedAt)} 시작).`}
      </p>
    );
  }
  const ok = run.state === "done" && run.report?.ok;
  return (
    <p className={`mt-3 rounded-ctl px-3 py-2 text-xs ${ok ? "bg-brandSoft text-brand" : "bg-alertSoft text-alert"}`}>
      {label} {who} · {ago(run.startedAt)} ·{" "}
      {ok ? `${run.report?.saved ?? 0}건 저장${run.report?.timeUp ? " (중간에 멈춤 — 다시 누르면 이어집니다)" : ""}`
          : `실패 — ${run.report?.reason ?? "이유 미기록"}`}
    </p>
  );
}

/**
 * 공공 API 수집 전체를 여기서 돌린다.
 *
 * 채용·자격증·공공기관·금리 모두 매일 09:00 크론이 같은 일을 한다.
 * 이 화면은 처음 채울 때와 문제가 있을 때 쓴다.
 */
export default function CollectPanel({ stats, lastRun }: { stats: SourceStat[]; lastRun: LastRun | null }) {
  const [busy, setBusy] = useState("");
  const [out, setOut] = useState("");

  const call = async (label: string, fn: () => Promise<{ error: string | null; results?: CollectResult[]; reports?: unknown[] }>) => {
    setBusy(label);
    setOut(`${label} 중… 최대 1분. 창을 닫아도 서버에서는 계속됩니다.`);
    const t0 = Date.now();
    try {
      const r = await fn();
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      const body = r.results
        ? r.results.map((x) =>
            `${x.ok ? "○" : "✕"} ${COLLECT_LABEL[x.key]} — ${x.ok ? `${x.saved}건${x.more ? " (더 남음)" : ""}` : x.reason}` +
            ` · ${(x.elapsedMs / 1000).toFixed(1)}초`).join("\n")
        : JSON.stringify(r.reports, null, 2);
      setOut(r.error ? `${r.error}\n(${secs}초)` : `${secs}초 걸림\n\n${body}`);
    } catch (e) {
      setOut(`실패: ${e instanceof Error ? e.message : String(e)}\n시간 초과라면 다시 누르면 이어집니다.`);
    }
    setBusy("");
  };

  const btn = "px-4 py-2 text-sm disabled:opacity-50";
  return (
    <section className="card mt-6 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">공공 API 수집</h2>
        <span className="text-xs text-faint">매일 09:00(KST) 자동 · 아래는 수동</span>
      </div>
      <p className="mt-1 text-xs text-faint">
        한 번에 45초까지만 돌고 멈춥니다. 끊겨도 다시 누르면 이어집니다. 채용은 쪽수가 많아
        여러 번 눌러야 8월까지 채워집니다.
      </p>

      <LastRunLine run={lastRun} />

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <button key={s.key} onClick={() => call(COLLECT_LABEL[s.key], () => runCollectOne(s.key))}
                  disabled={!!busy}
                  className="rounded-ctl border border-line p-3 text-left text-sm transition-colors
                             hover:border-brand disabled:opacity-50">
            <b>{COLLECT_LABEL[s.key]}</b>
            <span className="num ml-2 text-muted">{s.n.toLocaleString()}건</span>
            <span className="mt-1 block text-xs text-muted">
              {s.newest ? `최신 ${s.newest} · ` : ""}
              {s.fetched ? `${ago(s.fetched)} 수집` : "수집 기록 없음"}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => call("전체 수집", () => runCollectAll())} disabled={!!busy}
                className={`btn btn-primary ${btn}`}>전체 수집 시작</button>
        <button onClick={() => call("중지", async () => { const r = await stopCollect(); return { ...r, results: [] }; })}
                className={`btn btn-ghost ${btn} !border-alert !text-alert`}>중지</button>
        <button onClick={() => call("연결 확인", () => probeJobsApi())} disabled={!!busy}
                className={`btn btn-ghost ${btn}`}>연결 확인 (빠름)</button>
      </div>
      <p className="mt-2 text-xs text-faint">
        중지는 지금 돌고 있는 항목을 끝내고 그다음부터 멈춥니다. 이미 나간 요청은 되돌릴 수 없습니다.
      </p>

      {out && (
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-ctl bg-surface2 p-3 text-[11.5px] leading-relaxed">
          {out}
        </pre>
      )}
    </section>
  );
}
