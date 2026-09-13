"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { COLLECT_LABEL, type CollectKey, type CollectResult, type LastRunView } from "@/lib/collectorMeta";
import { probeJobsApi, runCollectAll, runCollectOne, stopCollect } from "./actions";

export type SourceStat = { key: CollectKey; n: number; newest: string | null; fetched: string | null };

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "방금" : m < 60 ? `${m}분 전` : `${Math.round(m / 60)}시간 전`;
};

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}초`;

/** 마지막 채용 수집 기록. 함수가 죽어도 DB 에 남아 새로고침으로 보인다. */
function LastRunLine({ run }: { run: LastRunView }) {
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
  const failedPages = (run.report?.pages ?? []).filter((pg) => pg.err);
  return (
    <p className={`mt-3 rounded-ctl px-3 py-2 text-xs ${ok ? "bg-brandSoft text-brand" : "bg-alertSoft text-alert"}`}>
      {label} {who} · {ago(run.startedAt)} ·{" "}
      {ok ? `${run.report?.saved ?? 0}건 저장${run.report?.timeUp ? " (중간에 멈춤 — 다시 누르면 이어집니다)" : ""}`
          : `실패 — ${run.report?.reason ?? "이유 미기록"}`}
      {failedPages.length > 0 && (
        <span className="mt-1 block opacity-80">
          못 받은 쪽 {failedPages.length}개 — {failedPages[0].page}쪽: {failedPages[0].err}
        </span>
      )}
    </p>
  );
}

/** 방금 이 항목을 돌린 결과. 성공이면 몇 건, 실패면 왜. */
function TileResult({ r }: { r: CollectResult }) {
  return (
    <p className={`mt-1.5 rounded-ctl px-2 py-1.5 text-xs leading-relaxed
                   ${r.ok ? "bg-brandSoft text-brand" : "bg-alertSoft text-alert"}`}>
      {r.ok
        ? `방금 ${r.saved.toLocaleString()}건 받았습니다${r.more ? " · 더 남았습니다" : ""}`
        : `실패 — ${r.reason}`}
      <span className="ml-1 opacity-70">({secs(r.elapsedMs)})</span>
    </p>
  );
}

/**
 * 공공 API 수집. 전체를 한 번에 돌리는 단추와 항목마다 따로 돌리는 단추.
 *
 * 매일 09:00 크론이 전체를 나란히 돌린다. 이 화면은 처음 채울 때, 한 항목만
 * 다시 받고 싶을 때, 그리고 무엇이 왜 실패했는지 볼 때 쓴다.
 */
export default function CollectPanel({ stats, lastRuns }: { stats: SourceStat[]; lastRuns: LastRunView[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  /** 지금 돌고 있는 것. 항목 하나면 그 key, 전체면 "*", 아무것도 아니면 "". */
  const [busy, setBusy] = useState("");
  const [tile, setTile] = useState<Partial<Record<CollectKey, CollectResult>>>({});
  const [out, setOut] = useState("");

  /** 돈 뒤에 건수·수집 시각을 다시 읽어 온다. 새로고침 없이 타일이 갱신된다. */
  const refresh = () => startTransition(() => router.refresh());

  const runOne = async (key: CollectKey) => {
    setBusy(key);
    setTile((t) => ({ ...t, [key]: undefined }));
    try {
      const r = await runCollectOne(key);
      const got = r.results?.[0];
      if (got) setTile((t) => ({ ...t, [key]: got }));
      else setOut(r.error ?? "결과가 비어 있습니다.");
    } catch (e) {
      setTile((t) => ({ ...t, [key]: {
        key, ok: false, saved: 0, elapsedMs: 0,
        reason: e instanceof Error ? e.message : String(e),
      } }));
    }
    setBusy("");
    refresh();
  };

  const runMany = async (
    label: string,
    fn: () => Promise<{ error: string | null; results?: CollectResult[]; reports?: unknown[] }>,
  ) => {
    setBusy("*");
    setTile({});
    setOut(`${label} 중… 최대 1분. 창을 닫아도 서버에서는 계속됩니다.`);
    const t0 = Date.now();
    try {
      const r = await fn();
      if (r.results?.length) {
        setTile(Object.fromEntries(r.results.map((x) => [x.key, x])));
        setOut(r.error ?? "");
      } else {
        setOut(r.error ? `${r.error}\n(${secs(Date.now() - t0)})` : JSON.stringify(r.reports, null, 2));
      }
    } catch (e) {
      setOut(`실패: ${e instanceof Error ? e.message : String(e)}\n시간 초과라면 다시 누르면 이어집니다.`);
    }
    setBusy("");
    refresh();
  };

  const btn = "px-4 py-2 text-sm disabled:opacity-50";
  return (
    <section className="card mt-6 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">공공 API 수집 <span className="ml-1 font-normal text-faint">v3</span></h2>
        <span className="text-xs text-faint">매일 09:00(KST) 자동</span>
      </div>
      <p className="mt-1 text-xs text-faint">
        자동으로도 돌지만, 여기서 전체 또는 항목 하나만 지금 받아올 수 있습니다.
        한 번에 45초까지만 돌고 멈추며, 끊겨도 다시 누르면 이어집니다.
        채용은 쪽수가 많아 여러 번 눌러야 8월까지 채워집니다.
      </p>

      {lastRuns.map((r) => <LastRunLine key={r.source} run={r} />)}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {stats.map((s) => {
          const running = busy === s.key || busy === "*";
          return (
            <div key={s.key} className="rounded-ctl border border-line p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <b className="block text-sm">{COLLECT_LABEL[s.key]}</b>
                  <span className="num mt-0.5 block text-sm text-muted">{s.n.toLocaleString()}건</span>
                  <span className="mt-0.5 block text-xs text-faint">
                    {s.newest ? `최신 ${s.newest} · ` : ""}
                    {s.fetched ? `${ago(s.fetched)} 수집` : "수집 기록 없음"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => runOne(s.key)}
                  disabled={!!busy}
                  aria-label={`${COLLECT_LABEL[s.key]} 지금 수집`}
                  className="shrink-0 rounded-pill border border-brand px-3 py-1.5 text-xs font-bold
                             text-brand transition-colors hover:bg-brandSoft disabled:opacity-40"
                >
                  {busy === s.key ? "받는 중…" : "지금 수집"}
                </button>
              </div>
              {tile[s.key] && !running && <TileResult r={tile[s.key]!} />}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => runMany("전체 수집", () => runCollectAll())} disabled={!!busy}
                className={`btn btn-primary ${btn}`}>
          {busy === "*" ? "전체 받는 중…" : "전체 수집 시작"}
        </button>
        <button onClick={() => runMany("중지", async () => { const r = await stopCollect(); return { ...r, results: [] }; })}
                className={`btn btn-ghost ${btn} !border-alert !text-alert`}>중지</button>
        <button onClick={() => runMany("연결 확인", () => probeJobsApi())} disabled={!!busy}
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
