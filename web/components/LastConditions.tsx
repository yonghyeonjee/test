"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearMe, meLabel, meQuery, readMe, type Me } from "@/lib/me";
import Glyph from "./Glyph";

/**
 * 지난번에 넣은 조건으로 바로 보기.
 *
 * 다시 온 사람은 사는 곳과 나이를 또 고르지 않아도 된다. 처음 온 사람에게는
 * 아무것도 안 보인다. 서버는 이 조건을 모르므로 그린 뒤에 읽는다.
 */
export default function LastConditions() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { setMe(readMe()); }, []);
  if (!me) return null;
  return (
    <div className="mb-5 rounded-card border border-brand/30 bg-brandSoft/60 px-4 py-3 text-[14px]">
      <p className="flex items-start gap-2 leading-snug">
        <span className="mt-0.5 text-brand" aria-hidden><Glyph name="history" className="h-4 w-4" strokeWidth={2.2} /></span>
        <span><span className="font-bold text-brand">지난번 조건</span>{" "}
        <span className="text-ink2">{meLabel(me)}</span></span>
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Link href={meQuery(me, { via: "last" })} className="btn btn-primary px-3.5 py-1.5 text-[13px]">
          이 조건으로 보기
        </Link>
        <button type="button" onClick={() => { clearMe(); setMe(null); }}
                className="btn btn-ghost px-3 py-1.5 text-[13px]" aria-label="지난번 조건 지우기">
          지우기
        </button>
      </div>
    </div>
  );
}
