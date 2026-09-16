"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { dueLabel, type HotKind, type Slide } from "@/lib/hotBanner";

/**
 * 첫 화면 롤링 띠.
 *
 * 마감이 걸린 것만 돌린다. 6초마다 넘어가고, 손이나 눈이 머무르면 멈춘다 —
 * 읽는 중에 넘어가 버리면 도로 찾아야 해서 없느니만 못하다. 화면을 다른
 * 탭으로 돌려놓았을 때도 멈춘다. 움직임을 줄이도록 설정한 기기에서는
 * 저절로 넘어가지 않고 점을 눌러서만 넘긴다.
 */

const EVERY = 6000;

/**
 * 갈래마다 배경 그림.
 *
 * 사진을 쓰고 싶으면 web/public/banner/ 에 pin.jpg · exam.jpg · job.jpg ·
 * biz.jpg 를 넣고 아래 PHOTO 에 경로를 적으면 그 사진이 대신 깔린다.
 * 지금은 파일이 없으니 비워 둔다 — 없는 주소를 적어 두면 깨진 그림이 뜬다.
 * 직접 그린 그림이라 저작권을 따질 일도, 내려받느라 느려질 일도 없다.
 */
const PHOTO: Partial<Record<HotKind, string>> = {};

const TONE: Record<HotKind, { from: string; to: string; tint: string }> = {
  pin: { from: "#2A2266", to: "#5A4BE0", tint: "#C4B5FD" },
  exam: { from: "#0C3B32", to: "#1E7A63", tint: "#9AE6C8" },
  job: { from: "#17255A", to: "#3E5BB8", tint: "#AFC4FF" },
  biz: { from: "#4A3410", to: "#9A7526", tint: "#F5D98B" },
};

/** 갈래마다 다른 무늬. 사진 없이도 화면이 비어 보이지 않게. */
function Art({ kind }: { kind: HotKind }) {
  const t = TONE[kind];
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice"
         className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={`g-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.from} />
          <stop offset="1" stopColor={t.to} />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#g-${kind})`} />
      <g fill="none" stroke={t.tint} strokeOpacity=".28" strokeWidth="1.4">
        {kind === "pin" && (
          <>
            <circle cx="330" cy="62" r="30" />
            <circle cx="330" cy="62" r="18" />
            <path d="M296 150c22-8 36-26 44-52s24-40 46-44" strokeOpacity=".4" />
            <path d="M250 168l26-22 22 14 30-40" strokeOpacity=".5" strokeWidth="2" />
          </>
        )}
        {kind === "exam" && (
          <>
            {[0, 1, 2, 3].map((i) => (
              <g key={i} transform={`translate(262 ${38 + i * 34})`}>
                <rect width="18" height="18" rx="4" />
                <path d="M4 9l4 4 7-8" strokeOpacity={i === 1 ? ".85" : ".3"} strokeWidth="2" />
                <path d="M30 6h74M30 13h50" strokeOpacity=".3" />
              </g>
            ))}
          </>
        )}
        {kind === "job" && (
          <>
            <rect x="262" y="56" width="52" height="96" rx="5" />
            <rect x="326" y="84" width="46" height="68" rx="5" />
            {[0, 1, 2, 3].map((i) => (
              <path key={i} d={`M272 ${74 + i * 20}h32M336 ${102 + i * 16}h26`} strokeOpacity=".32" />
            ))}
          </>
        )}
        {kind === "biz" && (
          <>
            <path d="M258 150V86l44-22 44 22v64z" />
            <path d="M258 86l44 22 44-22M302 108v42" strokeOpacity=".35" />
            <path d="M226 168l24-26 20 12 28-34" strokeWidth="2" strokeOpacity=".5" />
          </>
        )}
      </g>
    </svg>
  );
}

export default function HotBanner({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const n = slides.length;
  const touch = useRef<number | null>(null);

  const go = useCallback((next: number) => setI(((next % n) + n) % n), [n]);

  useEffect(() => {
    if (n < 2 || hold) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      // 다른 탭을 보고 있으면 넘기지 않는다. 돌아왔을 때 엉뚱한 장이 떠 있다.
      if (!document.hidden) setI((p) => (p + 1) % n);
    }, EVERY);
    return () => clearInterval(t);
  }, [n, hold]);

  if (!n) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="마감이 가까운 안내"
      className="relative mt-6"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocusCapture={() => setHold(true)}
      onBlurCapture={() => setHold(false)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; setHold(true); }}
      onTouchEnd={(e) => {
        const from = touch.current;
        touch.current = null;
        setHold(false);
        if (from === null) return;
        const dx = e.changedTouches[0].clientX - from;
        if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="overflow-hidden rounded-card">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {slides.map((s, idx) => (
            <div key={s.key} className="w-full shrink-0" aria-hidden={idx !== i}>
              <Link
                href={s.href}
                tabIndex={idx === i ? 0 : -1}
                className="relative block h-[184px] overflow-hidden sm:h-[210px]"
              >
                {PHOTO[s.kind] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={PHOTO[s.kind]} alt="" aria-hidden
                       className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <Art kind={s.kind} />
                )}
                {/* 글씨가 그림에 묻히지 않게 아래를 어둡게 깐다. */}
                <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={`badge ${s.days <= 1 ? "badge-closed bg-white text-alert" : "bg-white/20 text-white"}`}>
                      {dueLabel(s.days)}
                    </span>
                    <span className="badge bg-white/15 text-white/90">
                      {s.kind === "pin" ? "정부지원" : s.kind === "exam" ? "자격시험"
                        : s.kind === "job" ? "공공기관 채용" : "기업지원"}
                    </span>
                  </span>
                  <b className="mt-2 block text-[17px] font-extrabold leading-snug text-white">
                    {s.title}
                  </b>
                  <span className="mt-1 block truncate text-[13px] text-white/80">{s.sub}</span>
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {n > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {slides.map((s, idx) => (
            <button
              key={s.key}
              type="button"
              onClick={() => go(idx)}
              aria-label={`${idx + 1}번째 안내 보기`}
              aria-current={idx === i}
              className={`h-2 rounded-pill transition-all ${
                idx === i ? "w-6 bg-brand" : "w-2 bg-line2 hover:bg-muted"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
