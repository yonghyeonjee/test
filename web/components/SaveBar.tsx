"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { addSaved, keyOf, listSaved, removeSaved } from "@/lib/saved";
import { track } from "./Gtm";
import Recovery from "./Recovery";

/**
 * 조건 저장·공유. 결과를 본 그 자리에 있어야 쓰인다.
 * 저장은 서버에 남으므로 브라우저를 정리해도, 기기를 바꿔도 이어진다.
 */
export default function SaveBar({
  label,
  kind = "welfare",
}: {
  label: string[];
  kind?: string;
}) {
  const sp = useSearchParams();
  const query = sp.toString();

  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [canShare, setCanShare] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listSaved();
    setSaved(list.some((s) => s.cond_key === keyOf(query)));
  }, [query]);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
    void refresh();
  }, [refresh]);

  const flash = (t: string) => {
    setMsg(t);
    setTimeout(() => setMsg(""), 2600);
  };

  const onSave = async () => {
    setBusy(true);
    try {
      if (saved) {
        await removeSaved(keyOf(query));
        setSaved(false);
        flash("저장을 해제했습니다.");
      } else {
        const ok = await addSaved(query, label, kind);
        setSaved(ok);
        if (ok) track("save_condition", { kind, condition: label.join(" · ") });
        flash(
          ok
            ? "저장했습니다. 다음에 오시면 첫 화면에 있습니다."
            : "저장하지 못했습니다. 잠시 뒤 다시 눌러주세요."
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      track("copy_link", { kind });
      flash("링크를 복사했습니다.");
    } catch {
      window.prompt("아래 주소를 복사하세요", window.location.href);
    }
  };

  const onShare = async () => {
    try {
      await navigator.share({
        title: "내가 받을 수 있는 지원금",
        text: `${label.join(" · ")} 조건으로 찾은 지원사업`,
        url: window.location.href,
      });
      track("share", { kind });
    } catch {
      /* 취소 */
    }
  };

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold">
            {saved ? "저장해둔 조건입니다" : "이 조건 저장해두기"}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            다음에 들어오시면 첫 화면에서 바로 열립니다. 새 사업은 매일
            추가되니 가끔 다시 눌러보세요.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={busy || saved === null}
            aria-pressed={!!saved}
            className={`btn px-4 py-2.5 text-[13px] ${
              saved ? "btn-ghost border-brand text-brand" : "btn-primary"
            }`}
          >
            {saved === null ? "..." : saved ? "저장됨" : "저장"}
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="btn btn-ghost px-4 py-2.5 text-[13px]"
          >
            링크 복사
          </button>
          {canShare && (
            <button
              type="button"
              onClick={onShare}
              className="btn btn-ghost px-4 py-2.5 text-[13px]"
            >
              공유
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 min-h-[1rem] text-xs text-brand">{msg}</p>

      <p className="mt-1 text-[11px] leading-relaxed text-faint">
        저장에는 이름이나 연락처가 필요 없습니다. 이 브라우저가 만든 무작위
        번호로만 구분하며, 그 번호로는 누구인지 알 수 없습니다.
      </p>

      {saved && <Recovery />}
    </div>
  );
}
