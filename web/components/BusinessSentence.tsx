"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BIZ_FIELD, BIZ_TARGET } from "@/lib/db";

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
                      max-h-72 overflow-y-auto rounded border border-ink
                      bg-white py-1 shadow-lg ${wide ? "w-72" : "w-44"}`}
        >
          {value && (
            <button
              type="button"
              onClick={() => {
                onPick(null);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-muted hover:bg-paper"
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
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-paper
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

  const set = (patch: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(sp.toString());
    next.set("tab", "business");
    for (const [k, v] of Object.entries(patch)) {
      next.delete(k);
      if (Array.isArray(v)) v.forEach((x) => next.append(k, x));
      else if (v) next.set(k, v);
    }
    router.replace(`/?${next}`, { scroll: false });
  };

  const yearOpts = [
    { label: "예비창업", value: "0" },
    ...Array.from({ length: 20 }, (_, i) => ({
      label: `${i + 1}년차`,
      value: String(i + 1),
    })),
    { label: "21년 이상", value: "25" },
  ];

  return (
    <section>
      <h1 className="text-display font-extrabold leading-snug">
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
            placeholder="몇 년째"
            options={yearOpts}
            onPick={(v) => set({ years: v })}
          />
        </span>{" "}
        <span className="whitespace-nowrap">
          <Blank
            value={target}
            placeholder="어떤 사업체"
            wide
            options={BIZ_TARGET.map((t) => ({ label: t, value: t }))}
            onPick={(v) => set({ target: v })}
          />
          를 하고 있습니다.
        </span>
      </h1>

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
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors
                  ${
                    on
                      ? "border-ink bg-ink text-white"
                      : "border-rule bg-white text-muted hover:border-ink hover:text-ink"
                  }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
