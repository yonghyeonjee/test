"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listSaved, removeSaved, type Saved } from "@/lib/saved";
import Recovery from "./Recovery";

/** 첫 화면 맨 위. 저장해둔 조건을 바로 열 수 있게. */
export default function SavedList() {
  const [items, setItems] = useState<Saved[] | null>(null);

  useEffect(() => {
    void listSaved().then(setItems);
  }, []);

  // 불러오기 전에는 아무것도 그리지 않는다 (레이아웃이 튀지 않게)
  if (!items) return null;

  // 저장한 게 없어도 되찾기 입구는 남긴다 — 기기를 바꾼 사람이 여기로 온다
  if (items.length === 0)
    return (
      <section className="mb-5">
        <Recovery compact />
      </section>
    );

  return (
    <section className="mb-5">
      <h2 className="mb-2 text-xs font-bold text-muted">저장해둔 조건</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((s) => (
          <span key={s.cond_key} className="relative">
            <Link href={`/?${s.query}`} className="chip pr-8">
              {s.label.join(" · ")}
            </Link>
            <button
              type="button"
              aria-label="저장 해제"
              onClick={async () => {
                await removeSaved(s.cond_key);
                setItems(await listSaved());
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint
                         transition-colors hover:text-alert"
            >
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 3l8 8M11 3l-8 8" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2">
        <Recovery compact />
      </div>
    </section>
  );
}
