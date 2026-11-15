"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * 검색 결과 위의 "사는 곳으로 좁히기"(2026-11-15).
 *
 * 지원금은 그 지역에 사는 사람만 받는다. 그런데 지역 없이 "청년 월세"를 찾으면 수원·김제·서산·구미 것이
 * 섞여 나와, 내가 받을 수 있는 것을 다시 골라내야 했다. 검색창은 "경기 청년 월세"처럼 지역을 섞어 적으면
 * 조건으로 알아듣는다(lib/search). 그래서 여기서는 지역 낱말을 앞에 붙인 주소로 보내기만 한다.
 *
 * 정책지도에서 위치를 정해 둔 사람에게는 그 동네를 맨 앞 단추로 준다. 나머지 시·도는 옆으로 미는 줄.
 */
const GEO_KEY = "jw.geo.v1";
const SIDOS = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

export default function RegionNarrow({ q, base }: { q: string; base: string }) {
  const [mine, setMine] = useState<string | null>(null);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(GEO_KEY) ?? "null") as { label?: string } | null;
      const label = s?.label?.trim();
      // "경기 시흥시 대야동" → "경기 시흥시"(시·군·구까지가 지원 대상을 가르는 단위다).
      if (label && label !== "내 위치") setMine(label.split(/\s+/).slice(0, 2).join(" "));
    } catch { /* 없으면 시·도 줄만 */ }
  }, []);
  const to = (region: string) => `${base}?q=${encodeURIComponent(`${region} ${q}`)}`;
  const mineSido = mine?.split(" ")[0];

  return (
    <nav aria-label="사는 곳으로 좁히기" className="mt-4 rounded-card border border-line bg-white px-4 py-3">
      <p className="text-[13.5px] font-bold text-ink2">
        사는 곳으로 좁히기 <span className="ml-1 font-normal text-muted">지원금은 사는 지역에 따라 받을 수 있는 것이 다릅니다</span>
      </p>
      <ul className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {mine && (
          <li className="shrink-0">
            <Link href={to(mine)} className="chip chip-on !py-1.5 !text-[13px]">{mine}만 보기</Link>
          </li>
        )}
        {SIDOS.filter((s) => s !== mineSido).map((s) => (
          <li key={s} className="shrink-0">
            <Link href={to(s)} className="chip !py-1.5 !text-[13px]">{s}</Link>
          </li>
        ))}
        <li className="shrink-0">
          <Link href="/map" className="chip !py-1.5 !text-[13px]">지도에서 내 위치로</Link>
        </li>
      </ul>
    </nav>
  );
}
