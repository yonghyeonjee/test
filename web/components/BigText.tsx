"use client";

import { useEffect, useState } from "react";

/** 예전 저장값(켬/끔). 켜 둔 사람은 2단계로 옮긴다. */
export const BIG_KEY = "jw.big";
export const FS_KEY = "jw.fs";

const LEVELS = [
  { v: 1, label: "보통", size: "text-[13px]" },
  { v: 2, label: "크게", size: "text-[16px]" },
  { v: 3, label: "아주 크게", size: "text-[19px]" },
] as const;

/** 고른 단계를 화면에 적용한다. 2·3단계는 예전 표식(html.big)도 함께 붙인다 — 광고·오른쪽 기둥이 그걸 본다. */
function apply(v: number) {
  const el = document.documentElement;
  el.setAttribute("data-fs", String(v));
  el.classList.toggle("big", v > 1);
  try {
    localStorage.setItem(FS_KEY, String(v));
    localStorage.setItem(BIG_KEY, v > 1 ? "1" : "0");
  } catch {
    // 사생활 보호 모드 등에서 저장이 막혀도 이번 방문에는 적용된다.
  }
  // 화면 폭이 달라진 것과 같다 — 폭을 재서 그리는 것들(지도·기둥 광고)이 다시 재게 한다.
  window.dispatchEvent(new Event("resize"));
}

/**
 * 글자 크기 3단계(2026-11-26). 50대 이상이 많이 와서 기본 크기를 20% 키웠고, 그 위로 두 단계가 더 있다.
 * 글자만 키우지 않고 화면 전체를 같은 비율로 키운다(body zoom) — 여백·아이콘·단추가 함께 커져 화면이 흐트러지지 않는다.
 *
 *  - variant="seg": "가 가 가" 세 칸(PC 머리말·전체 메뉴).
 *  - variant="cycle": 한 칸짜리 단추, 누를 때마다 보통 → 크게 → 아주 크게(휴대폰 머리말).
 * 첫 그리기 전에는 layout 의 인라인 스크립트가 data-fs 를 붙인다. 여기서는 그 결과를 읽어 단추 상태만 맞춘다.
 */
export default function BigText({ variant = "seg" }: { variant?: "seg" | "cycle" }) {
  const [fs, setFs] = useState(1);
  useEffect(() => {
    const read = () => setFs(Number(document.documentElement.getAttribute("data-fs")) || 1);
    read();
    // 다른 자리의 단추(머리말·메뉴)가 바꿔도 따라간다.
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-fs"] });
    return () => mo.disconnect();
  }, []);
  const pick = (v: number) => { setFs(v); apply(v); };

  if (variant === "cycle") {
    const next = fs >= 3 ? 1 : fs + 1;
    return (
      <button type="button" onClick={() => pick(next)}
              aria-label={`글자 크기: ${LEVELS[fs - 1].label}. 누르면 ${LEVELS[next - 1].label}`}
              className={`flex h-10 min-w-10 shrink-0 flex-col items-center justify-center rounded-[12px] px-1.5 transition-colors active:scale-95 ${
                fs > 1 ? "bg-brand text-white" : "bg-ground text-ink2"}`}>
        <span aria-hidden className="flex items-end gap-px font-extrabold leading-none">
          <span className="text-[11px]">가</span><span className="text-[16px]">가</span>
        </span>
        <span aria-hidden className="mt-0.5 flex gap-[3px]">
          {LEVELS.map((l) => <i key={l.v} className={`h-1 w-1 rounded-full ${l.v <= fs ? (fs > 1 ? "bg-white" : "bg-brand") : (fs > 1 ? "bg-white/40" : "bg-line2")}`} />)}
        </span>
      </button>
    );
  }
  return (
    <div role="group" aria-label="글자 크기" className="inline-flex shrink-0 items-center rounded-pill border-[1.5px] border-line2 bg-surface p-0.5">
      {LEVELS.map((l) => (
        <button key={l.v} type="button" onClick={() => pick(l.v)} aria-pressed={fs === l.v} title={`글자 ${l.label}`} aria-label={`글자 ${l.label}`}
                className={`flex h-8 w-9 items-center justify-center rounded-pill font-extrabold leading-none transition-colors ${l.size} ${
                  fs === l.v ? "bg-brand text-white" : "text-ink2 hover:text-brand"}`}>
          가
        </button>
      ))}
    </div>
  );
}
