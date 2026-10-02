"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readMe } from "@/lib/me";

/** 지난번에 넣은 사는 곳이 있으면 그 지역 채용으로 가는 칩 하나. 그 지역 쪽에서는 안 보인다. */
export default function MyRegionJobs({ current }: { current?: string | null }) {
  const [sido, setSido] = useState<string | null>(null);
  useEffect(() => { setSido(readMe()?.sido ?? null); }, []);
  if (!sido || sido === current) return null;
  return (
    <Link href={`/jobs/region/${encodeURIComponent(sido)}`}
          className="chip chip-on inline-flex items-center gap-1.5">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z M12 10h.01" /></svg>
      내 지역 {sido} 공고
    </Link>
  );
}
