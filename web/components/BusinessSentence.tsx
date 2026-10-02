"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BIZ_FIELD, BIZ_TARGET, INDUSTRY } from "@/lib/consts";

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

export default function BusinessSentence({ sidos }: { sidos: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  const sido = sp.get("sido");
  const target = sp.get("target");
  const years = sp.get("years");
  const fields = sp.getAll("field");
  const inds = sp.getAll("ind");

  const set = (patch: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(sp.toString());
    next.delete("tab");
    for (const [k, v] of Object.entries(patch)) {
      next.delete(k);
      if (Array.isArray(v)) v.forEach((x) => next.append(k, x));
      else if (v) next.set(k, v);
    }
    router.replace(next.toString() ? `/business?${next}` : "/business", { scroll: false });
  };

  const yearOpts = [
    { label: "창업 준비 중인", value: "0" },
    ...Array.from({ length: 20 }, (_, i) => ({
      label: `${i + 1}년차`,
      value: String(i + 1),
    })),
    { label: "21년 넘은", value: "25" },
  ];

  return (
    <section>
      {/* "경기도에서 3년차 소상공인입니다" 로 읽히게. 예전에는 업력과 대상을
          나란히 두고 "를 하고 있습니다" 를 붙여 "예비창업 예비창업자를 하고
          있습니다" 가 나왔다. */}
      <p className="mb-2 text-sm font-bold text-brand">어디서 어떤 사업을 하시나요?</p>
      <p className="text-display font-extrabold leading-snug">
        <span className="whitespace-nowrap">
          <Blank
            value={sido}
            placeholder="어느 지역"
            wide
            options={sidos.map((s) => ({ label: s, value: s }))}
            onPick={(v) => set({ sido: v })}
          />
          에서
        </span>{" "}
        <span className="whitespace-nowrap">
          <Blank
            value={years ? yearOpts.find((y) => y.value === years)?.label ?? null : null}
            placeholder="몇 년차"
            options={yearOpts}
            onPick={(v) => set({ years: v })}
          />
        </span>{" "}
        <span className="whitespace-nowrap">
          <Blank
            value={target}
            placeholder="어떤 사업자"
            wide
            options={BIZ_TARGET.map((t) => ({ label: t, value: t }))}
            onPick={(v) => set({ target: v })}
          />
          입니다.
        </span>
      </p>
      <p className="mt-2 text-sm text-muted">빈칸을 눌러 고르세요. 지역만 골라도 결과가 나옵니다.</p>

      <div className="mt-7">
        <p className="mb-2 text-sm text-muted">
          필요한 지원이 있으면 눌러주세요.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {BIZ_FIELD.map((f) => {
            const on = fields.includes(f);
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  set({ field: on ? fields.filter((x) => x !== f) : [...fields, f] })
                }
                className={`chip
                  ${on ? "chip-on" : ""}`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* 업종은 붙어 있는 공고가 370건뿐이라, 골라도 업종 없는 공고는
          그대로 남는다. 좁히는 용도로만 쓴다. */}
      <div className="mt-6">
        <p className="mb-2 text-sm text-muted">
          업종을 고르면 그 업종 공고가 앞에 옵니다.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {INDUSTRY.map((i) => {
            const on = inds.includes(i);
            return (
              <button
                key={i}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  set({ ind: on ? inds.filter((x) => x !== i) : [...inds, i] })
                }
                className={`chip ${on ? "chip-on" : ""}`}
              >
                {i}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
