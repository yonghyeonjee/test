"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * 안에 든 GET 폼(검색·거르기)을 쪽을 새로 열지 않고 보낸다(2026-11-16).
 *
 * 전에는 "찾기"·"적용"을 누르면 쪽이 통째로 새로 열려 화면이 맨 위(또는 #list)로 튀었다 — 조건을 하나 바꿀 때마다
 * 보던 자리를 잃었다. 여기서는 같은 주소(/jobs/search?…)로 라우터가 옮겨 가되 스크롤은 그대로 둔다.
 * 미들웨어가 그 주소를 경로 주소로 308 하는 것은 전과 같다.
 * 자바스크립트가 없으면 폼은 원래대로 동작한다(action 주소로 새로 연다).
 */
export default function KeepScroll({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <div
      id={id}
      className={className}
      onSubmit={(e) => {
        const f = e.target as HTMLFormElement;
        if ((f.method || "get").toLowerCase() !== "get") return;
        const u = new URL(f.action, window.location.href);
        if (u.origin !== window.location.origin) return;
        e.preventDefault();
        const qs = new URLSearchParams();
        new FormData(f).forEach((v, k) => { if (typeof v === "string") qs.append(k, v); });
        // 펼쳐 둔 거르기 창을 닫고, 휴대폰 자판을 내린다.
        document.querySelectorAll<HTMLDetailsElement>("details[data-filter-menu][open]").forEach((d) => { d.open = false; });
        (document.activeElement as HTMLElement | null)?.blur?.();
        router.push(`${u.pathname}?${qs.toString()}`, { scroll: false });
      }}
    >
      {children}
    </div>
  );
}
