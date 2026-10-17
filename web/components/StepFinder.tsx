"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EMPLOYMENT, HOUSEHOLD } from "@/lib/consts";
import { SIDO_SHORT } from "@/lib/geo";
import { useLocate } from "@/lib/useLocate";
import Glyph from "./Glyph";

type Region = { sido: string; sigungu: { name: string; n: number }[] };

/**
 * 첫 화면의 큰 단계 찾기. 숨고의 요청서처럼 한 번에 한 가지만 묻고, 손가락으로 누를 만큼
 * 큰 칸을 깐다.
 *
 * 2026-10-16 까지는 "어느 지역에 사는 몇 살 어떤 상태입니다" 문장의 빈칸을 눌러 작은 목록에서
 * 고르게 했다. 기록을 보니 열에 여덟은 지역만 고르고 끝났다 — 첫 칸을 고르는 순간 결과가 떠서
 * 다음 칸이 있는 줄 몰랐고, 목록은 작아서 어르신이 누르기 어려웠다. 그래서 고르는 동안은 주소를
 * 바꾸지 않고, 마지막에 "맞는 사업 찾기"를 눌러야 결과로 간다. 결과 쪽은 예전 문장이 그대로
 * 있어 거기서 고쳐 볼 수 있다.
 */

const STEPS = ["사는 곳", "나이", "상태", "가구"] as const;
// 가나다순(강원·경기·경남…)은 서울 사람이 두 번째 줄에서 찾아야 한다. 익숙한 순으로.
const ORDER = ["서울특별시", "경기도", "인천광역시", "부산광역시", "대구광역시", "대전광역시", "전남광주통합특별시",
  "울산광역시", "세종특별자치시", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "경상북도", "경상남도", "제주특별자치도"];
const rank = (s: string) => { const i = ORDER.indexOf(s); return i < 0 ? 99 : i; };
const DECADES = [10, 20, 30, 40, 50, 60, 70] as const;

function short(sido: string) {
  return SIDO_SHORT[sido] ?? sido.replace(/(특별자치도|특별자치시|광역시|특별시|통합특별시|도)$/, "");
}

export default function StepFinder({ regions }: { regions: Region[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [sido, setSido] = useState<string | null>(null);
  const [sigungu, setSigungu] = useState<string | null>(null);
  const [decade, setDecade] = useState<number | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [emp, setEmp] = useState<string | null>(null);
  const [hh, setHh] = useState<string[]>([]);
  const [going, setGoing] = useState(false);
  const { locate, busy: locating, err: locErr } = useLocate();

  // 위치를 허용하면 시·도·시·군·구를 바로 채우고 나이 단계로 넘어간다. 목록에 없는 시·군·구면 시·도까지만.
  const byLocation = async () => {
    const p = await locate();
    if (!p) return;
    const r = regions.find((x) => x.sido === p.sido);
    if (!r) return;
    setSido(r.sido);
    setSigungu(p.sigungu && r.sigungu.some((g) => g.name === p.sigungu) ? p.sigungu : null);
    setStep(1);
  };

  const sorted = [...regions].sort((a, b) => rank(a.sido) - rank(b.sido));
  // "-" 처럼 이름이 아닌 것이 섞여 있다(원자료). 뺀다.
  const sgg = (regions.find((r) => r.sido === sido)?.sigungu ?? []).filter((g) => /[가-힣]/.test(g.name));

  const go = () => {
    const q = new URLSearchParams();
    if (sido) q.set("sido", sido);
    if (sigungu) q.set("sigungu", sigungu);
    if (age) q.set("age", String(age));
    if (emp) q.set("emp", emp);
    hh.forEach((h) => q.append("hh", h));
    q.set("via", "form");
    setGoing(true);
    router.push(`/?${q}`);
  };

  // 지금까지 고른 것. 누르면 그 단계로 돌아간다.
  const picked: { at: number; text: string }[] = [];
  if (sido) picked.push({ at: 0, text: [short(sido), sigungu].filter(Boolean).join(" ") });
  if (step > 1) picked.push({ at: 1, text: age ? `${age}세` : "나이 안 넣음" });
  if (step > 2) picked.push({ at: 2, text: emp ?? "상태 안 넣음" });

  const tile = (on: boolean) =>
    `flex min-h-[52px] items-center justify-center rounded-[12px] border px-1.5 text-center text-[14.5px] font-bold leading-tight break-keep
     transition-[color,background-color,border-color,transform] active:scale-[.97] hover:-translate-y-0.5
     ${on ? "pop border-brand bg-brand text-white" : "border-line bg-surface text-ink2 hover:border-brand hover:text-brand"}`;

  return (
    <section aria-label="조건으로 찾기">
      {/* 진행 막대와 물음. */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-bold text-brand">
          <span className="num">{step + 1}</span>
          <span className="text-faint"> / {STEPS.length}</span>
          <span className="ml-2 text-ink2">{STEPS[step]}</span>
        </p>
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)}
                  className="text-[13px] font-semibold text-muted underline underline-offset-4 hover:text-ink">
            이전
          </button>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-ground" aria-hidden>
        <div className="h-full rounded-pill bg-brand transition-[width] duration-300"
             style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {picked.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {picked.map((p) => (
            <button key={p.at} type="button" onClick={() => setStep(p.at)}
                    className="chip chip-on px-3 py-1.5 text-[13px]" aria-label={`${p.text} 바꾸기`}>
              {p.text} ✎
            </button>
          ))}
        </div>
      )}

      <div key={`${step}-${sido ?? ""}-${decade ?? ""}`} className="step-in">
      <h2 className="mt-4 text-[1.25rem] font-extrabold leading-snug tracking-[-.02em] sm:text-[1.375rem]">
        {step === 0 && (sido ? `${short(sido)} 어디에 사시나요?` : "어디에 사시나요?")}
        {step === 1 && (decade ? "정확한 나이를 골라 주세요" : "나이가 어떻게 되시나요?")}
        {step === 2 && "지금 어떤 상태이신가요?"}
        {step === 3 && "해당되는 것이 있으면 눌러 주세요"}
      </h2>
      <p className="mt-1 text-[13.5px] text-muted">
        {step === 0 && !sido && "시·도를 누르면 시·군·구까지 고를 수 있습니다."}
        {step === 0 && sido && "시·군·구 사업까지 보려면 하나를 고르세요. 시·도 전체로 봐도 됩니다."}
        {step === 1 && "나이 제한이 있는 사업을 걸러냅니다. 안 넣어도 찾을 수 있습니다."}
        {step === 2 && "취업·창업·학생 등 상태별 사업을 추려냅니다."}
        {step === 3 && "없으면 바로 찾기를 누르세요. 고른 것은 이 브라우저에만 남습니다."}
      </p>

      {/* 1단계: 시·도 → 시·군·구 */}
      {step === 0 && !sido && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={byLocation} disabled={locating}
                  className="inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-brand/40 bg-brandSoft/60 px-3.5 py-2 text-[13.5px] font-bold text-brand transition-colors hover:bg-brandSoft disabled:opacity-60">
            <Glyph name="pin" className="h-4 w-4" strokeWidth={2.2} />
            {locating ? "위치 읽는 중…" : "내 위치로 고르기"}
          </button>
          {locErr && <span role="status" className="text-[12.5px] text-muted">{locErr}</span>}
        </div>
      )}
      {step === 0 && !sido && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {sorted.map((r) => (
            <button key={r.sido} type="button" className={tile(false)}
                    onClick={() => { setSido(r.sido); setSigungu(null); }}>
              {short(r.sido)}
            </button>
          ))}
        </div>
      )}
      {step === 0 && sido && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => { setSigungu(null); setStep(1); }}
                    className="chip chip-on px-4 py-2.5 text-[14px]">
              {short(sido)} 전체
            </button>
            {sgg.map((s) => (
              <button key={s.name} type="button" onClick={() => { setSigungu(s.name); setStep(1); }}
                      className="chip px-3.5 py-2.5 text-[14px]">
                {s.name}<span className="num ml-1 text-[12px] text-faint">{s.n}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => { setSido(null); setSigungu(null); }}
                  className="mt-3 text-[13px] font-semibold text-muted underline underline-offset-4 hover:text-ink">
            다른 시·도 고르기
          </button>
        </div>
      )}

      {/* 2단계: 나이대 → 정확한 나이 */}
      {step === 1 && (
        <div className="mt-4">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {DECADES.map((d) => (
              <button key={d} type="button" className={tile(decade === d)}
                      onClick={() => { setDecade(d); setAge(null); }}>
                {d === 70 ? "70대 이상" : `${d}대`}
              </button>
            ))}
            <button type="button" className={`${tile(false)} border-dashed text-muted`}
                    onClick={() => { setDecade(null); setAge(null); setStep(2); }}>
              안 넣기
            </button>
          </div>
          {decade !== null && (
            <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {Array.from({ length: decade === 70 ? 26 : 10 }, (_, i) => decade + i)
                .filter((a) => decade !== 10 || a >= 15)
                .map((a) => (
                  <button key={a} type="button"
                          className={`num min-h-[44px] rounded-[10px] border text-[15px] font-bold transition-colors active:scale-[.97]
                                      ${age === a ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink2 hover:border-brand hover:text-brand"}`}
                          onClick={() => { setAge(a); setStep(2); }}>
                    {a}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* 3단계: 상태 */}
      {step === 2 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-7">
          {EMPLOYMENT.map((e) => (
            <button key={e} type="button" className={tile(emp === e)}
                    onClick={() => { setEmp(e); setStep(3); }}>
              {e}
            </button>
          ))}
          <button type="button" className={`${tile(false)} border-dashed text-muted`}
                  onClick={() => { setEmp(null); setStep(3); }}>
            안 넣기
          </button>
        </div>
      )}

      {/* 4단계: 가구 특성(여럿) → 찾기 */}
      {step === 3 && (
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {HOUSEHOLD.map((h) => {
              const on = hh.includes(h);
              return (
                <button key={h} type="button" aria-pressed={on} className={tile(on)}
                        onClick={() => setHh(on ? hh.filter((x) => x !== h) : [...hh, h])}>
                  {h}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={go} disabled={going}
                  className="btn btn-primary mt-5 w-full py-4 text-[16.5px]">
            {going ? "찾는 중…" : "맞는 사업 찾기"}
            {!going && <span className="ml-2 opacity-80" aria-hidden>→</span>}
          </button>
        </div>
      )}

      </div>

      {/* 중간에 결과부터 보고 싶은 사람. 2·3단계에서만 — 1단계는 고르면 바로 넘어간다. */}
      {sido && step > 0 && step < 3 && (
        <button type="button" onClick={go} disabled={going}
                className="mt-4 text-[13.5px] font-semibold text-brand underline underline-offset-4">
          여기까지 조건으로 바로 찾기
        </button>
      )}
    </section>
  );
}
