"use client";

import { useEffect, useState } from "react";

/**
 * 관리자 탭(2026-11-26). 전에는 여덟 구역이 한 쪽에 길게 늘어서 있고 위 단추는 그 자리로 내려가기만 했다 —
 * 휴대폰에서 통계를 보려면 한참 내려야 했다. 이제 고른 구역 하나만 보인다.
 * 구역은 서버가 그대로 그리고, 여기서는 id 로 찾아 hidden 만 켜고 끈다. 고른 탭은 주소의 #… 에 남는다.
 */
export default function AdminTabs({ tabs, initial }: { tabs: [string, string][]; initial: string }) {
  const [cur, setCur] = useState(initial);
  useEffect(() => {
    const h = window.location.hash;
    if (h && tabs.some(([id]) => id === h)) setCur(h);
  }, [tabs]);
  useEffect(() => {
    for (const [id] of tabs) {
      const el = document.getElementById(id.slice(1));
      if (el) el.hidden = id !== cur;
    }
  }, [cur, tabs]);
  return (
    <nav aria-label="관리자 메뉴" role="tablist"
         className="sticky top-0 z-20 -mx-5 mb-2 flex gap-1 overflow-x-auto border-b border-line bg-surface/95 px-5 py-2 text-[13px] backdrop-blur sm:mx-0 sm:rounded-card sm:border sm:px-3">
      {tabs.map(([id, t]) => (
        <button key={id} type="button" role="tab" aria-selected={cur === id}
                onClick={() => { setCur(id); history.replaceState(null, "", id); window.scrollTo({ top: 0 }); }}
                className={`shrink-0 rounded-pill px-3 py-1.5 font-semibold transition-colors ${cur === id ? "bg-brand text-white" : "text-ink2 hover:bg-brandSoft hover:text-brand"}`}>
          {t}
        </button>
      ))}
    </nav>
  );
}
