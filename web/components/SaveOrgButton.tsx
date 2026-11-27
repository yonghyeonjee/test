"use client";

import { useEffect, useState } from "react";
import { addOrg, hasOrg, markOrgSeen, ORGS_EVENT, removeOrg } from "@/lib/savedOrgs";
import { track } from "./Gtm";
import { toast } from "./Toast";

/**
 * 기관 저장 단추(2026-11-27). 기관 채용 화면의 머리와 공고 상세의 저장·공유 옆.
 * 저장해 두면 첫 화면과 저장함이 그 기관에 새 공고가 올라왔는지 알려 준다(components/SavedOrgs).
 * seen: 이 화면이 그 기관의 공고 목록이면 켠다 — 들어온 것으로 "새 공고" 표시를 지운다.
 */
export default function SaveOrgButton({ org, label, seen = false, className = "" }: {
  org: string; label?: string; seen?: boolean; className?: string;
}) {
  const [saved, setSaved] = useState<boolean | null>(null);

  useEffect(() => {
    const sync = () => setSaved(hasOrg(org));
    sync();
    window.addEventListener(ORGS_EVENT, sync);
    return () => window.removeEventListener(ORGS_EVENT, sync);
  }, [org]);
  useEffect(() => { if (seen) markOrgSeen(org); }, [seen, org]);

  const toggle = () => {
    if (saved) {
      if (removeOrg(org)) toast("기관 저장을 해제했습니다");
      return;
    }
    if (addOrg(org)) {
      toast("기관을 저장했습니다. 새 공고가 올라오면 첫 화면에서 알려 드립니다", { href: "/saved", label: "저장한 기관 보기" });
      track("save_org", {});
    } else {
      toast("이 브라우저에서는 저장할 수 없습니다(사생활 보호 창일 수 있습니다).", { tone: "warn" });
    }
  };

  return (
    <button type="button" onClick={toggle} disabled={saved === null} aria-pressed={!!saved}
            className={`inline-flex items-center gap-1.5 rounded-pill border-[1.5px] px-3.5 py-2 text-[13.5px] font-semibold transition-colors
                        ${saved ? "border-brand bg-brand/5 text-brand" : "border-line2 bg-surface text-ink2 hover:border-brand hover:text-brand"}
                        disabled:opacity-60 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={saved ? "currentColor" : "none"} stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M10.3 20a2 2 0 003.4 0" />
      </svg>
      {saved ? "기관 저장됨" : (label ?? "이 기관 새 공고 챙기기")}
    </button>
  );
}
