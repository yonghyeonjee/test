"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { meLabel, readMe, type Me } from "@/lib/me";

type Mark = "ok" | "no" | "ask";

/**
 * 이 사업이 내 조건(지난번에 넣은 사는 곳·나이·가구)에 맞는지 한 줄로.
 *
 * 조건을 넣은 적이 없으면 아무것도 안 보인다. 판단은 화면에 적힌 조건만으로
 * 하는 것이라 "가능성"까지만 말하고, 최종 판단은 원문이라고 적는다.
 */
export default function MyFit({
  sido, sigungu, ageMin, ageMax, household,
}: { sido: string | null; sigungu: string | null; ageMin: number | null; ageMax: number | null; household: string[] | null }) {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { setMe(readMe()); }, []);
  if (!me) return null;

  const rows: { k: string; mark: Mark; text: string }[] = [];

  if (!sido) rows.push({ k: "지역", mark: "ok", text: "전국 사업" });
  else if (!me.sido) rows.push({ k: "지역", mark: "ask", text: `${sigungu || sido} 거주자 대상` });
  else if (me.sido !== sido) rows.push({ k: "지역", mark: "no", text: `${sigungu || sido} 거주자 대상 (내 지역: ${me.sido})` });
  else if (sigungu && me.sigungu && me.sigungu !== sigungu) rows.push({ k: "지역", mark: "no", text: `${sigungu} 거주자 대상 (내 지역: ${me.sigungu})` });
  else if (sigungu && !me.sigungu) rows.push({ k: "지역", mark: "ask", text: `${sigungu} 거주자 대상 — 시·군·구 확인` });
  else rows.push({ k: "지역", mark: "ok", text: `${sigungu || sido} 거주 조건에 맞음` });

  if (ageMin === null && ageMax === null) rows.push({ k: "나이", mark: "ok", text: "나이 제한 없음" });
  else if (!me.age) rows.push({ k: "나이", mark: "ask", text: "나이 조건 있음 — 나이를 넣으면 확인됩니다" });
  else if ((ageMin !== null && me.age < ageMin) || (ageMax !== null && me.age > ageMax))
    rows.push({ k: "나이", mark: "no", text: `만 ${me.age}세는 나이 조건 밖` });
  else rows.push({ k: "나이", mark: "ok", text: `만 ${me.age}세, 나이 조건에 맞음` });

  if (household && household.length) {
    const mine = me.hh ?? [];
    const hit = household.filter((h) => mine.includes(h));
    if (hit.length) rows.push({ k: "가구", mark: "ok", text: `${hit.join("·")} 조건에 맞음` });
    else rows.push({ k: "가구", mark: "ask", text: `${household.join("·")} 가구 대상 — 해당되는지 확인` });
  }

  const no = rows.filter((r) => r.mark === "no").length;
  const ask = rows.filter((r) => r.mark === "ask").length;
  const verdict = no ? "내 조건과 다른 항목이 있습니다" : ask ? "확인할 항목이 남아 있습니다" : "내 조건에 맞을 가능성이 높습니다";
  const icon = (m: Mark) => m === "ok" ? "✓" : m === "no" ? "✕" : "?";
  const color = (m: Mark) => m === "ok" ? "text-brand" : m === "no" ? "text-alert" : "text-gold";

  return (
    <div className="mt-4 rounded-card border border-line bg-surface p-4">
      <p className="text-[13px] text-muted">
        내 조건 <span className="text-ink2">{meLabel(me)}</span>
        {" · "}
        <Link href="/" className="underline underline-offset-4 hover:text-brand">바꾸기</Link>
      </p>
      <p className={`mt-1 text-[14.5px] font-bold ${no ? "text-alert" : ask ? "text-gold" : "text-brand"}`}>{verdict}</p>
      <ul className="mt-2 space-y-1 text-[13.5px] text-ink2">
        {rows.map((r) => (
          <li key={r.k} className="flex gap-2">
            <span className={`w-4 shrink-0 text-center font-extrabold ${color(r.mark)}`} aria-label={r.mark === "ok" ? "맞음" : r.mark === "no" ? "다름" : "확인 필요"}>{icon(r.mark)}</span>
            <span><b className="font-semibold">{r.k}</b> · {r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
