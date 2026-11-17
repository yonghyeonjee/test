import Link from "next/link";

import { ageLabel, type Detail } from "@/lib/db";
import type { ProgramCompare as Data } from "@/lib/programCompare";

/**
 * 같은 사업, 다른 지역의 조건(2026-11-17, lib/programCompare). 원문에는 없고 우리 자료를 나란히 놓아야 보이는 것.
 * 다른 지역이 하나도 없으면 그리지 않는다.
 */
export default function ProgramCompare({ p, data }: { p: Detail; data: Data | null }) {
  if (!data) return null;
  const { peers, areas, income } = data;
  const here = p.sigungu || p.sido || "전국";
  const incomeLine = !income ? null
    : income.min === income.max
      ? `소득 기준을 적은 ${income.n}곳은 모두 기준 중위소득 ${income.min}% 이하입니다.`
      : `소득 기준은 지역에 따라 기준 중위소득 ${income.min}% 이하부터 ${income.max}% 이하까지 다릅니다.`;
  const cond = (x: { age_min: number | null; age_max: number | null; income_pct: number | null }) =>
    [ageLabel(x), x.income_pct ? `중위소득 ${x.income_pct}% 이하` : null].filter(Boolean).join(" · ");

  return (
    <section className="mt-8 rounded-card border border-line bg-surface p-5" aria-labelledby="program-compare-h">
      <h2 id="program-compare-h" className="text-sm font-bold">같은 사업, 다른 지역은 어떻게 하나</h2>
      <p className="mt-2 text-[14px] leading-[1.8] text-ink2">
        이 사업과 같은 사업을 지금 {areas}개 지역이 따로 접수하고 있습니다. {incomeLine} 사는 곳의 사업에만 신청할 수
        있으니, 아래는 조건이 지역마다 어떻게 다른지 견주어 보는 용도입니다.
      </p>
      <ul className="mt-3 divide-y divide-line">
        <li className="py-2.5 text-[13.5px] leading-snug">
          <b className="text-ink">{here}</b> <span className="text-[12px] font-semibold text-brand">이 사업</span>
          {cond(p) && <span className="block text-ink2">{cond(p)}</span>}
        </li>
        {peers.map((x) => (
          <li key={x.id} className="py-2.5 text-[13.5px] leading-snug">
            <Link href={`/p/${encodeURIComponent(x.id)}`} prefetch={false} className="font-bold text-ink hover:text-brand hover:underline">
              {[x.sido, x.sigungu].filter(Boolean).join(" ") || "전국"}
            </Link>
            <span className="ml-1.5 text-[12px] text-muted">
              {x.is_always_on || !x.apply_end ? "상시 접수" : `${x.apply_end.slice(0, 10).replaceAll("-", ".")} 마감`}
            </span>
            {cond(x) && <span className="block text-ink2">{cond(x)}</span>}
            {x.benefit && <span className="block text-muted">{x.benefit}</span>}
          </li>
        ))}
      </ul>
      {areas - 1 > peers.length && (
        <p className="mt-2 text-[12px] text-muted">이 밖에 {areas - 1 - peers.length}개 지역이 더 있습니다. 같은 시·도를 먼저 실었습니다.</p>
      )}
      <p className="mt-2 text-[11px] text-faint">복지로·소상공인24에서 접수 중인 사업을 이름으로 묶은 것입니다. 지원내용은 각 지역 원문의 앞부분입니다.</p>
    </section>
  );
}
