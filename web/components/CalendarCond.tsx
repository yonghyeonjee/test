"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { meLabel, meQuery, readMe, type Me } from "@/lib/me";
import Glyph from "./Glyph";

/**
 * 마감 달력에 내 조건(첫 화면에서 넣어 둔 사는 곳·나이·고용·가구)을 건다(2026-10-21).
 *
 * 주소에 조건이 하나도 없고 ?all 도 없으면, 이 브라우저에 적어 둔 조건으로 같은 쪽을 다시 연다 — 서버는 그
 * 조건을 모르므로 그린 뒤에 읽는다. 조건이 걸려 있으면 한 줄로 보여 주고 "조건 바꾸기"(첫 화면)와 "전체 보기"를 둔다.
 */
export default function CalendarCond({ applied, month, day }: {
  /** 주소에 실린 조건. 없으면 null. */
  applied: { sido?: string | null; sigungu?: string | null; age?: number | null; emp?: string | null; hh?: string[] } | null;
  month: string;
  day: string;
}) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    const m = readMe();
    setMe(m);
    if (applied || !m) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("all") || sp.has("sido") || sp.has("age") || sp.has("emp") || sp.has("hh")) return;
    // 보던 달·날짜는 그대로 두고 조건만 붙인다.
    if (m.sido) sp.set("sido", m.sido);
    if (m.sigungu) sp.set("sigungu", m.sigungu);
    if (m.age) sp.set("age", String(m.age));
    if (m.emp) sp.set("emp", m.emp);
    for (const h of m.hh ?? []) sp.append("hh", h);
    router.replace(`/calendar?${sp}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasCond = Boolean(applied && (applied.age || applied.emp || applied.hh?.length));
  if (!hasCond) {
    if (!me || !(me.age || me.emp || me.hh?.length)) return null;
    return (
      <p className="mt-3 text-[13px] text-muted">
        지난번 조건 <b className="text-ink2">{meLabel(me)}</b>으로{" "}
        <Link href={`/calendar?${new URLSearchParams(Object.fromEntries(Object.entries({ m: month, d: day, sido: me.sido, sigungu: me.sigungu, age: me.age ? String(me.age) : undefined, emp: me.emp }).filter(([, v]) => v) as [string, string][])).toString()}${(me.hh ?? []).map((h) => `&hh=${encodeURIComponent(h)}`).join("")}`}
              className="font-semibold text-brand underline underline-offset-4">맞는 것만 보기</Link>
      </p>
    );
  }
  const label = [applied!.age ? `만 ${applied!.age}세` : "", applied!.emp ?? "", ...(applied!.hh ?? [])].filter(Boolean).join(" · ");
  const all = new URLSearchParams({ m: month, d: day, all: "1" });
  if (applied!.sido) all.set("sido", applied!.sido);
  if (applied!.sigungu) all.set("sigungu", applied!.sigungu);
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-brandSoft px-3 py-1 font-semibold text-brand">
        <Glyph name="pin" className="h-3.5 w-3.5" strokeWidth={2.2} />내 조건 · {label}
      </span>
      <span className="text-faint">지원사업은 이 조건에 맞는 것만 세고, 채용·시험은 그대로입니다.</span>
      <Link href={meQuery({ sido: applied!.sido ?? undefined, sigungu: applied!.sigungu ?? undefined, age: applied!.age ?? undefined, emp: applied!.emp ?? undefined, hh: applied!.hh, at: 0 }, { via: "last" })}
            className="text-muted underline underline-offset-4 hover:text-brand">조건 바꾸기</Link>
      <Link href={`/calendar?${all}`} className="text-muted underline underline-offset-4 hover:text-brand">조건 없이 전체 보기</Link>
    </p>
  );
}
