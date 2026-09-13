"use client";

import { useState } from "react";
import { probeJobsApi, runJobsIngest } from "./actions";

type Stat = { source: string; n: number; newest: string | null; fetched: string | null };

/**
 * 채용 수집을 손으로 돌리고 결과를 본다.
 *
 * 서버 액션으로 부른다 — 관리자 쿠키가 /admin 경로에만 실려서 fetch 로는 401 이 난다.
 * useTransition 을 쓰지 않는 이유는 실패를 잡아 화면에 적기 위해서다. 오류를
 * 삼키면 "눌렀는데 멈췄다"로 보인다.
 */
export default function JobsIngestPanel({ stats }: { stats: Stat[] }) {
  const [busy, setBusy] = useState("");
  const [out, setOut] = useState("");

  const call = async (label: string, fn: () => Promise<{ error: string | null; reports: unknown[] }>) => {
    setBusy(label);
    setOut(`${label} 중… 최대 1분. 이 창을 닫지 마세요.`);
    const t0 = Date.now();
    try {
      const r = await fn();
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      setOut(r.error ? `${r.error}\n(${secs}초)` : `${secs}초\n${JSON.stringify(r.reports, null, 2)}`);
    } catch (e) {
      // 함수 시간 초과(504)나 네트워크 끊김이 여기로 온다
      setOut(`실패: ${e instanceof Error ? e.message : String(e)}\n시간 초과라면 한 번 더 누르면 이어서 읽습니다.`);
    }
    setBusy("");
  };

  const btn = "px-4 py-2 text-sm disabled:opacity-50";
  return (
    <section className="card mt-6 p-5">
      <h2 className="text-sm font-bold">채용 공고 수집</h2>
      <p className="mt-1 text-xs text-faint">
        매일 09:00(KST) Vercel Cron 이 돌립니다. 처음 채울 때는 아래 단추를 몇 번 눌러 8월까지
        거슬러 올라갑니다. 한 번에 40초까지만 읽고 멈추므로, 끊겨도 다시 누르면 이어집니다.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {stats.map((s) => (
          <div key={s.source} className="rounded-ctl border border-line p-3 text-sm">
            <b>{s.source === "gojobs" ? "나라일터" : "월드잡"}</b>
            <span className="num ml-2 text-muted">{s.n.toLocaleString()}건</span>
            <span className="mt-1 block text-xs text-muted">
              최신 {s.newest ?? "—"} · 마지막 수집{" "}
              {s.fetched ? s.fetched.slice(0, 16).replace("T", " ") : "—"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => call("연결 확인", () => probeJobsApi())} disabled={!!busy}
                className={`btn btn-ghost ${btn}`}>연결 확인 (빠름)</button>
        <button onClick={() => call("수집", () => runJobsIngest("gojobs", 4, false))} disabled={!!busy}
                className={`btn btn-primary ${btn}`}>나라일터 수집</button>
        <button onClick={() => call("수집", () => runJobsIngest("worldjob", 4, false))} disabled={!!busy}
                className={`btn btn-primary ${btn}`}>월드잡 수집</button>
        <button onClick={() => call("초기화", () => runJobsIngest("gojobs", 2, true))} disabled={!!busy}
                className={`btn btn-ghost ${btn}`}>처음부터 다시 (나라일터)</button>
      </div>

      {out && (
        <pre className="mt-3 max-h-96 overflow-auto rounded-ctl bg-surface2 p-3 text-[11px] leading-relaxed">
          {out}
        </pre>
      )}
    </section>
  );
}
