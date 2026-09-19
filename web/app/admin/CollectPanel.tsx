"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { COLLECT_LABEL, type CollectKey, type CollectResult, type LastRunView } from "@/lib/collectorMeta";
import { probeGojobsSite, probeJobsApi, probeOpenQuestions, probePagingLimits, runCollectAll, runCollectOne, runInBackground, stopCollect } from "./actions";

export type SourceStat = {
  key: CollectKey; n: number; newest: string | null; fetched: string | null;
  /** 과거로 어디까지 팠나. 나라일터 과거 타일만 채운다. */
  depth?: { at: string | null; page: number } | null;
};

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? "방금" : m < 60 ? `${m}분 전` : `${Math.round(m / 60)}시간 전`;
};

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}초`;

/** 마지막 채용 수집 기록. 함수가 죽어도 DB 에 남아 새로고침으로 보인다. */
const RUN_LABEL: Record<string, string> = {
  gojobs: "나라일터 최신",
  gojobs_archive: "나라일터 과거",
  worldjob: "해외취업",
};

function LastRunLine({ run }: { run: LastRunView }) {
  const label = RUN_LABEL[run.source] ?? run.source;
  const who = run.by === "cron" ? "자동" : "수동";
  if (run.state === "running") {
    // 한 번 도는 데 길어야 1분이다. 그보다 오래 "도는 중"이면 죽은 것이다.
    // 다만 다음에 화면을 열 때 스스로 정리되니 겁줄 필요는 없다.
    const stale = Date.now() - new Date(run.startedAt).getTime() > 90_000;
    return (
      <p className={`mt-3 rounded-ctl px-3 py-2 text-xs ${stale ? "bg-goldSoft text-gold" : "bg-brandSoft text-brand"}`}>
        {stale
          ? `${label} ${who} 수집이 ${ago(run.startedAt)} 시작해 아직 끝 표시가 없습니다. 시간 초과로 끊긴 것으로 보이며, 다시 누르면 멈춘 자리부터 이어집니다.`
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
        ? `방금 ${r.saved.toLocaleString()}건 받았습니다` +
          (r.reason ? ` · ${r.reason}` : "") +
          (r.more ? " · 이어서 받는 중" : "")
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
  /** 이어서 돌고 있는 회차. 0 이면 안 돌고 있다. */
  const [round, setRound] = useState(0);
  /** 중지를 눌렀나. 다음 회차로 넘어가기 전에 본다. */
  const stopRef = useRef(false);

  /** 돈 뒤에 건수·수집 시각을 다시 읽어 온다. 새로고침 없이 타일이 갱신된다. */
  const refresh = () => startTransition(() => router.refresh());

  /**
   * 한 항목을 돌린다. "더 남았습니다"가 오면 스스로 다시 부른다.
   *
   * 서버 함수는 60초에서 끊긴다. 그래서 한 번에 다 못 받고 "8.2초에 50건,
   * 더 남음"으로 끝난다. 사람이 그때마다 다시 누르게 두지 않는다 —
   * 남은 것이 없다고 할 때까지, 또는 중지를 누를 때까지 이어서 돌린다.
   *
   * 도는 동안 창을 열어 두어야 한다(브라우저가 다음 회차를 부른다).
   * 자동 수집(매일 09:00)은 이것과 별개로 그대로 돈다.
   */
  const MAX_ROUNDS = 40;

  /**
   * 먼저 GitHub Actions 에 넘겨 본다. 넘어가면 창을 닫아도 된다 — 거기서
   * 남은 것이 없을 때까지 돈다. 여기서는 숫자만 가끔 다시 읽는다.
   * 토큰이 없어 못 넘기면 false 를 돌려주고, 부르는 쪽이 창 안에서 돈다.
   */
  const handOff = async (what: CollectKey | "all", label: string) => {
    const r = await runInBackground(what);
    if (!r.configured) return false;
    if (!r.ok) { setOut(`GitHub 에 넘기지 못했습니다 — ${r.reason}\n창 안에서 이어 돌립니다.`); return false; }
    setOut(`${label} 을(를) GitHub Actions 에 넘겼습니다. 이 창은 닫아도 됩니다.\n` +
           `진행: ${r.url}\n아래 숫자는 20초마다 다시 읽습니다.`);
    // 5분 동안 20초마다 건수를 새로 읽는다. 그 뒤로는 새로고침으로.
    let n = 0;
    const id = setInterval(() => { refresh(); if (++n >= 15) clearInterval(id); }, 20_000);
    return true;
  };

  const runOne = async (key: CollectKey) => {
    if (await handOff(key, COLLECT_LABEL[key])) return;
    setBusy(key);
    setTile((t) => ({ ...t, [key]: undefined }));
    stopRef.current = false;
    let total = 0;

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      setRound(round);
      let got: CollectResult | undefined;
      try {
        const r = await runCollectOne(key);
        // 서버 함수가 시간 초과로 죽으면 아무것도 안 돌아온다.
        if (!r) throw new Error("서버가 응답하기 전에 끊겼습니다 (시간 초과). 다시 누르면 이어집니다.");
        got = r.results?.[0];
        if (!got) { setOut(r.error ?? "결과가 비어 있습니다."); break; }
      } catch (e) {
        got = { key, ok: false, saved: 0, elapsedMs: 0,
                reason: e instanceof Error ? e.message : String(e) };
      }

      total += got.saved;
      setTile((t) => ({ ...t, [key]: { ...got!, saved: total } }));
      refresh();

      if (!got.ok || !got.more || stopRef.current) break;
    }

    setRound(0);
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
      if (!r) throw new Error("서버가 응답하기 전에 끊겼습니다 (시간 초과). 다시 누르면 이어집니다.");
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

  /** 전체를 돌리고, 아직 남았다는 항목만 골라 다시 돌린다. */
  const runAll = async () => {
    if (await handOff("all", "전체 수집")) return;
    stopRef.current = false;
    setBusy("*");
    setTile({});
    setOut("");
    const total: Partial<Record<CollectKey, number>> = {};
    let keys: CollectKey[] | undefined = undefined;

    for (let r = 1; r <= MAX_ROUNDS; r++) {
      setRound(r);
      let res: CollectResult[] = [];
      try {
        const out = await runCollectAll(keys);
        if (!out) throw new Error("서버가 응답하기 전에 끊겼습니다 (시간 초과).");
        if (out.error) { setOut(out.error); break; }
        res = out.results ?? [];
      } catch (e) {
        setOut(e instanceof Error ? e.message : String(e));
        break;
      }

      setTile((t) => {
        const next = { ...t };
        for (const x of res) {
          total[x.key] = (total[x.key] ?? 0) + x.saved;
          next[x.key] = { ...x, saved: total[x.key]! };
        }
        return next;
      });
      refresh();

      // 다음 회차는 아직 남았다는 것만 돌린다.
      keys = res.filter((x) => x.ok && x.more).map((x) => x.key);
      if (!keys.length || stopRef.current) break;
    }

    setRound(0);
    setBusy("");
    refresh();
  };

  const btn = "px-4 py-2 text-sm disabled:opacity-50";
  return (
    <section className="card mt-6 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">공공 API 수집 <span className="ml-1 font-normal text-faint">v3</span></h2>
        <span className="text-xs text-faint">최신 100건 매일 09:00 · 과거는 하루 5번 이어서</span>
      </div>
      <p className="mt-1 text-xs text-faint">
        자동으로도 돌지만, 여기서 전체 또는 항목 하나만 지금 받아올 수 있습니다.
        서버는 한 번에 45초까지만 도는데, <b>남은 것이 없을 때까지 알아서 이어
        돌립니다.</b> GitHub 토큰이 있으면 Actions 에 넘겨 창을 닫아도 되고, 없으면
        이 창이 돌리니 열어 두세요. 멈추려면 중지를 누릅니다.
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
                  {s.depth && (
                    <span className="num mt-0.5 block text-xs text-muted">
                      과거 {s.depth.at ?? "—"}까지 · {s.depth.page.toLocaleString()}쪽
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => runOne(s.key)}
                  disabled={!!busy}
                  aria-label={`${COLLECT_LABEL[s.key]} 지금 수집`}
                  className="shrink-0 rounded-pill border border-brand px-3 py-1.5 text-xs font-bold
                             text-brand transition-colors hover:bg-brandSoft disabled:opacity-40"
                >
                  {busy === s.key ? (round > 1 ? `${round}회차…` : "받는 중…") : "지금 수집"}
                </button>
              </div>
              {tile[s.key] && !running && <TileResult r={tile[s.key]!} />}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => runAll()} disabled={!!busy}
                className={`btn btn-primary ${btn}`}>
          {busy === "*" ? (round > 1 ? `전체 ${round}회차…` : "전체 받는 중…") : "전체 수집 시작"}
        </button>
        <button onClick={() => {
                  stopRef.current = true;
                  void runMany("중지", async () => { const r = await stopCollect(); return { ...r, results: [] }; });
                }}
                className={`btn btn-ghost ${btn} !border-alert !text-alert`}>중지</button>
        <button onClick={() => runMany("연결 확인", () => probeJobsApi())} disabled={!!busy}
                className={`btn btn-ghost ${btn}`}>연결 확인 (빠름)</button>
        <button
          onClick={() => runMany("쪽 넘김 점검", async () => {
            const r = await probePagingLimits();
            const body = r.probes
              .map((x) =>
                `${x.ok ? "○" : "✕"} ${x.label}${x.page ? ` (${x.page}쪽)` : ""}` +
                (x.page ? " — " : " ") +
                (x.ok ? `${x.got}건 · idx ${x.firstIdx}~${x.lastIdx}` : x.reason) +
                ` · ${(x.ms / 1000).toFixed(1)}초`)
              .join("\n");
            return { error: r.error ?? (body || "결과 없음") };
          })}
          disabled={!!busy}
          className={`btn btn-ghost ${btn}`}
        >
          쪽 넘김 점검
        </button>
        <button
          onClick={() => runMany("사이트 점검", async () => {
            const r = await probeGojobsSite();
            const body = r.steps
              .map((x) => `${x.ok ? "○" : "✕"} ${x.step}${x.ms ? ` · ${(x.ms / 1000).toFixed(1)}초` : ""}\n${x.detail}`)
              .join("\n\n");
            return { error: r.error ?? (body || "결과 없음") };
          })}
          disabled={!!busy}
          className={`btn btn-ghost ${btn}`}
        >
          나라일터 사이트 점검
        </button>
        <button
          onClick={() => runMany("공개문제 API 점검", async () => {
            const r = await probeOpenQuestions();
            const body = r.steps
              .map((x) => `${x.ok ? "○" : "✕"} ${x.step}${x.ms ? ` · ${(x.ms / 1000).toFixed(1)}초` : ""}\n${x.detail}`)
              .join("\n\n");
            return { error: r.error ?? (body || "결과 없음") };
          })}
          disabled={!!busy}
          className={`btn btn-ghost ${btn}`}
        >
          공개문제 API 점검
        </button>
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
