"use client";

import { useState, useTransition } from "react";
import { refreshCache, saveSetting } from "./actions";

function Field({ label, hint, name, initial, wide }: {
  label: string; hint: string; name: string; initial: string; wide?: boolean;
}) {
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-bold text-muted">{label}</label>
      <p className="mt-0.5 text-xs text-faint">{hint}</p>
      <div className="mt-1.5 flex gap-2">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="w-full rounded-ctl border border-line px-3.5 py-2 text-sm
                     outline-none focus:border-brand"
        />
        <button
          onClick={() =>
            start(async () => {
              const r = await saveSetting(name, v);
              setMsg(r.error ?? "저장했습니다");
              setTimeout(() => setMsg(""), 2500);
            })
          }
          disabled={pending}
          className="btn btn-ghost shrink-0 px-4 py-2"
        >
          저장
        </button>
      </div>
      {msg && <p className="mt-1.5 text-xs text-brand">{msg}</p>}
    </div>
  );
}

export default function SettingsPanel({ closingDays, newDays, notice }: {
  closingDays: string; newDays: string; notice: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  return (
    <section className="card mt-6 p-5">
      <h2 className="text-sm font-bold">운영 설정</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <Field label="마감임박 기준" hint="며칠 이내를 마감임박으로 볼지"
               name="closing_days" initial={closingDays} />
        <Field label="신규 기준" hint="며칠 이내 수집분을 새 사업으로 볼지"
               name="new_days" initial={newDays} />
        <Field label="상단 공지" hint="비워두면 표시하지 않습니다" wide
               name="notice" initial={notice} />
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <button
          onClick={() =>
            start(async () => {
              await refreshCache();
              setMsg("캐시를 비웠습니다. 새로고침하면 반영됩니다.");
              setTimeout(() => setMsg(""), 3000);
            })
          }
          disabled={pending}
          className="btn btn-ghost"
        >
          화면 캐시 즉시 갱신
        </button>
        {msg && <p className="mt-2 text-xs text-brand">{msg}</p>}
      </div>
    </section>
  );
}
