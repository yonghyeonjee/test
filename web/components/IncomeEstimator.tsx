"use client";

import { useMemo, useState } from "react";
import {
  MAX_SIZE, MIN_SIZE, manwon, medianIncome, percentOf, standardFor, TIERS, won,
} from "@/lib/medianIncome";

/**
 * 연소득을 넣으면 기준 중위소득의 몇 %인지 어림잡아 준다.
 *
 * 어림이라고 못 박아 두는 이유가 있다. 실제 심사는 연봉이 아니라
 * 소득인정액(소득평가액 + 재산의 소득환산액)으로 한다. 집·차·예금이
 * 있으면 소득이 없어도 소득으로 환산되어 붙는다. 건강보험료로 가리는
 * 사업도 따로 있다. 그래서 여기 숫자로 "된다/안 된다"를 말하지 않는다.
 * 어느 언저리인지만 보여 주고, 확정은 복지로·주민센터로 넘긴다.
 */
export default function IncomeEstimator({ year }: { year: number }) {
  const [size, setSize] = useState(1);
  const [mode, setMode] = useState<"year" | "month">("year");
  /** 만원 단위로 받는다. 원 단위로 받으면 0을 세다 틀린다. */
  const [amount, setAmount] = useState("");

  const monthly = useMemo(() => {
    const n = Number(amount.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return null;
    const asWon = n * 10_000;
    return Math.round(mode === "year" ? asWon / 12 : asWon);
  }, [amount, mode]);

  const base = medianIncome(size, year);
  const pct = monthly === null ? null : percentOf(monthly, size, year);

  return (
    <div className="card mt-6 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-muted">가구원 수</span>
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="field w-full"
          >
            {Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => i + MIN_SIZE).map((n) => (
              <option key={n} value={n}>
                {n}인 가구{n === MAX_SIZE ? " 이상" : ""}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs text-muted">
            주민등록등본에 함께 올라 있고 생계를 같이하는 사람을 셉니다.
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-muted">
            세전 소득 (만원)
          </span>
          <div className="flex gap-2">
            <div className="flex shrink-0 rounded-ctl border border-line p-0.5" role="group"
                 aria-label="소득 기간">
              {(["year", "month"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`rounded-[8px] px-2.5 py-1 text-[13px] font-semibold transition-colors ${
                    mode === m ? "bg-brand text-white" : "text-muted hover:text-brand"
                  }`}
                >
                  {m === "year" ? "연" : "월"}
                </button>
              ))}
            </div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder={mode === "year" ? "예) 3600" : "예) 300"}
              aria-label={`${mode === "year" ? "연" : "월"} 세전 소득, 만원 단위`}
              className="field num min-w-0 flex-1"
            />
          </div>
          <span className="mt-1.5 block text-xs text-muted">
            세금·보험료를 빼기 전 금액을, 가구원 전체 합계로 넣으세요.
          </span>
        </label>
      </div>

      {monthly !== null && base !== null && pct !== null && (
        <div className="mt-5 rounded-card bg-brandSoft p-4">
          <p className="text-[15px] leading-relaxed">
            월 소득 <b className="num">{won(monthly)}</b>은{" "}
            {size}인 가구 기준 중위소득의{" "}
            <b className="num text-brand">{pct}%</b> 언저리입니다.
          </p>
          <p className="num mt-1 text-[13px] text-muted">
            {size}인 가구 기준 중위소득 100% = 월 {won(base)}
          </p>
        </div>
      )}

      <h3 className="mt-6 text-[15px] font-bold">
        {size}인 가구 기준선 {monthly !== null && <span className="text-muted">· 내 위치 표시</span>}
      </h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[19rem] border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-line text-left text-[12.5px] text-muted">
              <th scope="col" className="py-2 pr-2 font-semibold">기준</th>
              <th scope="col" className="py-2 pr-2 text-right font-semibold">월 소득</th>
              <th scope="col" className="py-2 text-right font-semibold">연 환산</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map(({ pct: p, label }) => {
              const m = standardFor(size, p, year);
              if (m === null) return null;
              const inRange = monthly !== null && monthly <= m;
              return (
                <tr key={p}
                    className={`border-b border-line/70 last:border-b-0 ${
                      inRange ? "bg-brandSoft/60 font-semibold" : ""}`}>
                  <td className="py-2 pr-2">
                    <span className="num">{p}%</span>
                    {label && <span className="ml-1.5 text-[12px] text-muted">{label}</span>}
                    {inRange && <span className="ml-1.5 text-[12px] text-brand">해당</span>}
                  </td>
                  <td className="num py-2 pr-2 text-right">{won(m)}</td>
                  <td className="num py-2 text-right text-muted">{manwon(m * 12)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {monthly !== null && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          칠해진 줄이 넣으신 소득으로 들어갈 수 있는 기준선입니다. 공고에 적힌
          기준이 그중 하나라면 소득 요건은 볼 만합니다 — 다만 아래 이유로
          그대로 통과한다는 뜻은 아닙니다.
        </p>
      )}
    </div>
  );
}
