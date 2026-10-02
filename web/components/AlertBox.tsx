"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listSaved, type Saved } from "@/lib/saved";
import PortalIcon from "./PortalIcon";

/**
 * 오른쪽 기둥 맨 위, 네이버 로그인 상자 자리. 내 조건과 알림.
 *
 * 지금은 조건 저장(이 브라우저 열쇠로 서버 보관)까지만 된다. 새 공고 알림
 * (문자·메일)은 준비 중이라고 그대로 적는다 — 보내지도 않는 것을 약속하지 않는다.
 * 보내는 기능은 docs/migration/notifications.md 의 수신 동의 규칙을 따라 붙인다.
 */
export default function AlertBox({ findHref = "/#find" }: { findHref?: string }) {
  const [saved, setSaved] = useState<Saved[] | null>(null);
  useEffect(() => { void listSaved().then(setSaved).catch(() => setSaved([])); }, []);
  const n = saved?.length ?? 0;
  return (
    <section className="card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-brandSoft text-brand">
          <PortalIcon name="bell" className="h-5 w-5" strokeWidth={2} />
        </span>
        <h2 className="text-[15px] font-extrabold tracking-[-.02em]">내 조건 · 알림</h2>
        <span className="ml-auto rounded-pill bg-ground px-2 py-0.5 text-[11px] font-bold text-muted">알림 준비 중</span>
      </div>
      {n > 0 ? (
        <>
          <p className="mt-3 text-[13px] text-muted">저장해 둔 조건 <b className="text-ink">{n}</b>개</p>
          <ul className="mt-1.5 space-y-1">
            {saved!.slice(0, 3).map((s) => (
              <li key={s.cond_key}>
                <Link href={`/?${s.query}`} className="block truncate rounded-[10px] bg-surface2 px-3 py-2 text-[13.5px] font-semibold text-ink2 hover:text-brand">
                  {s.label.join(" · ")}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink2">
          조건을 고르고 <b>저장</b>을 누르면 다음에 오셨을 때 첫 화면에서 바로 열립니다.
        </p>
      )}
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
        저장한 조건에 새 공고가 올라오면 문자·메일로 알려 드리는 기능을 준비하고 있습니다.
      </p>
      <Link href={findHref} className="btn btn-primary mt-3 w-full !py-2.5 text-[14px]">
        {n > 0 ? "조건 하나 더 고르기" : "내 조건 고르기"}
      </Link>
    </section>
  );
}
