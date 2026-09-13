"use client";

import { useState } from "react";

/** 채용 수집을 손으로 돌리고 결과를 본다. 처음 채울 때와 문제 있을 때 쓴다. */
export default function JobsIngestPanel({ stats }: { stats: { source: string; n: number; newest: string | null; fetched: string | null }[] }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState("");
  const run = async (q: string) => {
    setBusy(true); setOut("수집 중… 최대 1분");
    try {
      const r = await fetch(`/api/cron/jobs?${q}`, { credentials: "include" });
      const j = await r.json();
      setOut(JSON.stringify(j, null, 2));
    } catch (e) { setOut(String(e)); }
    setBusy(false);
  };
  return (
    <section className="card mt-6 p-5">
      <h2 className="text-sm font-bold">채용 공고 수집</h2>
      <p className="mt-1 text-xs text-faint">매일 09:00(KST) Vercel Cron 이 돌립니다. 처음 채울 때는 아래 단추를 몇 번 눌러 8월까지 거슬러 올라갑니다.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {stats.map((s) => (
          <div key={s.source} className="rounded-ctl border border-line p-3 text-sm">
            <b>{s.source === "gojobs" ? "나라일터" : "월드잡"}</b>
            <span className="num ml-2 text-muted">{s.n.toLocaleString()}건</span>
            <span className="mt-1 block text-xs text-muted">최신 {s.newest ?? "—"} · 마지막 수집 {s.fetched ? s.fetched.slice(0, 16).replace("T", " ") : "—"}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => run("pages=8")} disabled={busy} className="btn btn-primary px-4 py-2 text-sm">지금 수집 (8쪽)</button>
        <button onClick={() => run("pages=8&source=gojobs")} disabled={busy} className="btn btn-ghost px-4 py-2 text-sm">나라일터만</button>
        <button onClick={() => run("pages=8&source=worldjob")} disabled={busy} className="btn btn-ghost px-4 py-2 text-sm">월드잡만</button>
        <button onClick={() => run("pages=3&reset=1")} disabled={busy} className="btn btn-ghost px-4 py-2 text-sm">처음부터 다시</button>
      </div>
      {out && <pre className="mt-3 max-h-80 overflow-auto rounded-ctl bg-surface2 p-3 text-[11px] leading-relaxed">{out}</pre>}
    </section>
  );
}
