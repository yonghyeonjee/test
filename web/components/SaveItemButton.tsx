"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addItem, listItems, removeItem, type SavedItem } from "@/lib/savedItems";
import { track } from "./Gtm";

/**
 * 공고·사업 저장(즐겨찾기) 단추. 상세 쪽 제목 아래, 공유하기 옆.
 * 서버에 남으니 브라우저를 정리해도, 계정으로 다른 기기에서도 이어진다.
 * 로그인 없이도 된다 — 이 브라우저의 무작위 열쇠로만 구분한다.
 */
export default function SaveItemButton({ kind, id, title, sub, endDate, className = "" }: {
  kind: SavedItem["kind"]; id: string; title: string; sub?: string | null; endDate?: string | null; className?: string;
}) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<"saved" | "removed" | "fail" | null>(null);

  useEffect(() => {
    let on = true;
    void listItems().then((l) => on && setSaved(l.some((s) => s.kind === kind && s.item_id === id)));
    return () => { on = false; };
  }, [kind, id]);

  const flash = (m: typeof msg) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

  const toggle = async () => {
    setBusy(true);
    try {
      if (saved) {
        const ok = await removeItem(kind, id);
        if (ok) { setSaved(false); flash("removed"); } else flash("fail");
      } else {
        const ok = await addItem({ kind, id, title, sub, endDate });
        if (ok) { setSaved(true); flash("saved"); track("save_item", { kind }); } else flash("fail");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <button type="button" onClick={toggle} disabled={busy || saved === null} aria-pressed={!!saved}
              className={`inline-flex items-center gap-1.5 rounded-pill border-[1.5px] px-3.5 py-2 text-[13.5px] font-semibold transition-colors
                          ${saved ? "border-brand bg-brand/5 text-brand" : "border-line2 bg-surface text-ink2 hover:border-brand hover:text-brand"}
                          disabled:opacity-60`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill={saved ? "currentColor" : "none"} stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 4h12v17l-6-4.5L6 21z" />
        </svg>
        {saved === null ? "저장" : saved ? "저장됨" : "저장"}
      </button>
      {msg && (
        <span role="status" className="text-[12.5px] text-brand">
          {msg === "saved" && <>저장했습니다. <Link href="/saved" className="underline underline-offset-4">저장한 공고 보기</Link></>}
          {msg === "removed" && "저장을 해제했습니다."}
          {msg === "fail" && "저장하지 못했습니다. 잠시 뒤 다시 눌러주세요."}
        </span>
      )}
    </span>
  );
}
