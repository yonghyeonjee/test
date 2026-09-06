"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EMPLOYMENT, HOUSEHOLD } from "@/lib/db";

type Region = { sido: string; sigungu: { name: string; n: number }[] };

/** 문장 안의 빈칸 하나. 누르면 아래로 목록이 열린다. */
function Blank({
  value,
  placeholder,
  options,
  onPick,
  wide,
}: {
  value: string | null;
  placeholder: string;
  options: { label: string; value: string }[];
  onPick: (v: string | null) => void;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <span ref={box} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`blank ${value ? "" : "blank-empty"}`}
      >
        {value ?? placeholder}
      </button>

      {open && (
        <span
          className={`absolute left-0 top-[calc(100%+6px)] z-20 block
                      max-h-72 overflow-y-auto rounded-card border border-line
                      bg-white py-1 shadow-lift ${wide ? "w-72" : "w-44"}`}
          role="listbox"
        >
          {value && (
            <button
              type="button"
              onClick={() => {
                onPick(null);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-muted hover:bg-ground"
            >
              선택 지우기
            </button>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onPick(o.value);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-ground
                          ${o.value === value ? "font-bold" : ""}`}
            >
              {o.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

export default function ConditionSentence({ regions }: { regions: Region[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  const sido = sp.get("sido");
  const sigungu = sp.get("sigungu");
  const age = sp.get("age");
  const emp = sp.get("emp");
  const hh = sp.getAll("hh");

  const set = (patch: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      next.delete(k);
      if (Array.isArray(v)) v.forEach((x) => next.append(k, x));
      else if (v) next.set(k, v);
    }
    router.replace(next.toString() ? `/?${next}` : "/", { scroll: false });
  };

  const sgg = regions.find((r) => r.sido === sido)?.sigungu ?? [];
  const ages = Array.from({ length: 91 }, (_, i) => i + 5);

  // 순서대로 하나씩 묻는다. 한 번에 다 보여주면 어디부터 눌러야 할지 모른다.
  const step = !sido ? 1 : !age ? 2 : !emp ? 3 : 4;

  return (
    <section>
      <p className="mb-3 text-sm font-bold text-brand">
        {step === 1 && "1. 어디에 사시나요?"}
        {step === 2 && "2. 나이가 어떻게 되시나요?"}
        {step === 3 && "3. 지금 어떤 상태이신가요?"}
        {step === 4 && "조건에 맞는 사업을 찾았습니다"}
      </p>

      <h1 className="text-display font-extrabold leading-snug">
        <span className="whitespace-nowrap">
          <Blank
            value={sido}
            placeholder="어느 지역"
            wide
            options={regions.map((r) => ({ label: r.sido, value: r.sido }))}
            onPick={(v) => set({ sido: v, sigungu: null })}
          />
          {sido && sgg.length > 0 && (
            <>
              {" "}
              <Blank
                value={sigungu}
                placeholder="시·군·구"
                wide
                options={sgg.map((s) => ({
                  label: `${s.name} (${s.n})`,
                  value: s.name,
                }))}
                onPick={(v) => set({ sigungu: v })}
              />
            </>
          )}
          에 사는
        </span>{" "}
        {sido && (
        <span className="whitespace-nowrap">
          <Blank
            value={age ? `${age}세` : null}
            placeholder="몇 살"
            options={ages.map((a) => ({ label: `${a}세`, value: String(a) }))}
            onPick={(v) => set({ age: v })}
          />
        </span>
        )}{" "}
        {sido && age && (
        <span className="whitespace-nowrap">
          <Blank
            value={emp}
            placeholder="어떤 상태"
            options={EMPLOYMENT.map((e) => ({ label: e, value: e }))}
            onPick={(v) => set({ emp: v })}
          />
          입니다.
        </span>
        )}
      </h1>

      {step >= 3 && (
      <div className="mt-7">
        <p className="mb-2 text-sm text-muted">
          해당되는 것이 있으면 눌러주세요. 없어도 결과는 나옵니다.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {HOUSEHOLD.map((h) => {
            const on = hh.includes(h);
            return (
              <button
                key={h}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  set({ hh: on ? hh.filter((x) => x !== h) : [...hh, h] })
                }
                className={`chip
                  ${on ? "chip-on" : ""}`}
              >
                {h}
              </button>
            );
          })}
        </div>
      </div>
      )}
    </section>
  );
}
