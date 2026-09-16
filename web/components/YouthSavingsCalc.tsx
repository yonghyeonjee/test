"use client";

import { useMemo, useState } from "react";
import { BASE_RATE, MAX_MONTHLY, PLANS, estimate, won, type Plan } from "@/lib/youthSavings";

const RATES = [5, 6, 7, 8];

/**
 * 3년 뒤 얼마를 받는지 어림잡는다.
 *
 * 기사에 적힌 "연 14%" 같은 숫자는 실제로 통장에 찍히는 금액이 아니다.
 * 넣는 돈을 정하면 원금·정부기여금·이자가 각각 얼마인지 나눠 보여 준다.
 * 나뉘어 보여야 무엇 때문에 유리한 상품인지 납득이 된다.
 */
export default function YouthSavingsCalc() {
  const [monthly, setMonthly] = useState(MAX_MONTHLY);
  const [kind, setKind] = useState<Plan>(PLANS[0]);
  const [rate, setRate] = useState(BASE_RATE);

  const r = useMemo(() => estimate(monthly, kind, rate), [monthly, kind, rate]);

  const gain = r.total - r.principal;
  const bars = [
    { label: "낸 돈", v: r.principal, cls: "bg-line2" },
    { label: "정부기여금", v: r.match, cls: "bg-brand" },
    { label: "이자", v: r.interest, cls: "bg-gold" },
  ].filter((b) => b.v > 0);

  return (
    <div className="card mt-6 p-5">
      <h3 className="text-[15px] font-bold">3년 뒤 얼마를 받나</h3>

      <label htmlFor="ys-monthly" className="mt-4 block text-[13.5px] font-semibold">
        매달 넣는 돈
        <b className="num ml-2 text-[15px] font-extrabold text-brand">{won(monthly)}</b>
      </label>
      <input
        id="ys-monthly"
        type="range"
        min={10_000}
        max={MAX_MONTHLY}
        step={10_000}
        value={monthly}
        onChange={(e) => setMonthly(Number(e.target.value))}
        className="mt-2 w-full accent-brand"
      />
      <div className="num flex justify-between text-[11px] text-faint">
        <span>1만원</span><span>50만원</span>
      </div>

      <p className="mt-4 text-[13.5px] font-semibold">내 유형</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PLANS.map((k) => (
          <button
            key={k.key}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={k.key === kind.key}
            className={`chip ${k.key === kind.key ? "chip-on" : ""}`}
          >
            {k.label}
            {k.pct > 0 && <span className="num text-[11.5px] font-bold opacity-70">{k.pct}%</span>}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">{kind.who}</p>

      <p className="mt-4 text-[13.5px] font-semibold">은행 금리</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {RATES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setRate(v)}
            aria-pressed={v === rate}
            className={`chip ${v === rate ? "chip-on" : ""}`}
          >
            <span className="num">연 {v}%</span>
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">
        기본금리 연 5%에 은행별 우대금리가 붙습니다. 조건을 다 채우면 7~8%까지 갑니다.
      </p>

      {/* 무엇이 얼마인지 눈으로. 막대 길이가 곧 금액이다. */}
      <div className="mt-6 flex h-7 overflow-hidden rounded-pill" aria-hidden>
        {bars.map((b) => (
          <div key={b.label} className={b.cls} style={{ width: `${(b.v / r.total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {bars.map((b) => (
          <li key={b.label} className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="flex items-center gap-2 text-ink2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${b.cls}`} />
              {b.label}
            </span>
            <b className="num font-semibold">{won(b.v)}</b>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-card bg-brandSoft px-4 py-3.5">
        <p className="text-[13px] text-ink2">3년 뒤 받는 돈</p>
        <b className="num mt-0.5 block text-[1.5rem] font-extrabold text-brand">{won(r.total)}</b>
        <p className="mt-1 text-[13px] text-ink2">
          낸 돈보다 <b className="num font-bold">{won(gain)}</b> 많습니다.
        </p>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        같은 금리의 보통 적금이라면 기여금이 없고 이자에서 세금 15.4%를 떼어{" "}
        <b className="num font-semibold text-ink2">{won(r.plain)}</b>입니다. 차이는{" "}
        <b className="num font-semibold text-ink2">{won(r.total - r.plain)}</b>입니다.
      </p>

      <p className="mt-4 text-xs leading-relaxed text-faint">
        어림값입니다. 매달 같은 금액을 빠짐없이 넣고 단리로 계산했고, 정부기여금에 붙는
        이자는 넣지 않았습니다. 실제 금액은 은행과 우대금리 조건, 납입 실적에 따라
        달라집니다.
      </p>
    </div>
  );
}
