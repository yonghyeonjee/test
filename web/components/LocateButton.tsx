"use client";

import { useRouter } from "next/navigation";
import { useLocate } from "@/lib/useLocate";
import Glyph from "./Glyph";
import { track } from "./Gtm";

/** "내 위치로 보기". 위치를 허용하면 시·도·시·군·구를 주소에 넣어 같은 쪽을 다시 연다. */
export default function LocateButton({ base, keep = {}, className = "" }: {
  /** 이동할 쪽. 예: /calendar */
  base: string;
  /** 같이 남길 물음표 값(달·날짜 등). */
  keep?: Record<string, string | undefined>;
  className?: string;
}) {
  const router = useRouter();
  const { locate, busy, err } = useLocate();
  const go = async () => {
    const p = await locate();
    if (!p) return;
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(keep)) if (v) q.set(k, v);
    q.set("sido", p.sido);
    if (p.sigungu) q.set("sigungu", p.sigungu);
    track("locate", { where: base });
    router.push(`${base}?${q}`);
  };
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <button type="button" onClick={go} disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-line2 bg-surface px-3.5 py-2 text-[13.5px] font-semibold text-ink2 transition-colors hover:border-brand hover:text-brand disabled:opacity-60">
        <Glyph name="pin" className="h-4 w-4 text-brand" strokeWidth={2.2} />
        {busy ? "위치 읽는 중…" : "내 위치로 보기"}
      </button>
      {err && <span role="status" className="text-[12.5px] text-muted">{err}</span>}
    </span>
  );
}
