"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useId } from "react";
import { useAfterInteraction } from "@/lib/useAfterInteraction";
import { dueLabel, type HotKind, type Slide } from "@/lib/hotShared";

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

// 2026-10-16 채도 높은 보라·초록·파랑·주황이 촌스럽다는 말에, 갈래마다 깊고 가라앉은 색으로.
// 흰 글씨가 어디서나 읽히고, 무늬는 흰색을 옅게 깐다.
const TONE: Record<HotKind, { from: string; to: string; tint: string }> = {
  pin: { from: "#262559", to: "#4A42A8", tint: "#FFFFFF" },
  exam: { from: "#113B3A", to: "#1F6F66", tint: "#FFFFFF" },
  job: { from: "#17304A", to: "#2C5C8C", tint: "#FFFFFF" },
  biz: { from: "#3E2A17", to: "#7A5230", tint: "#FFFFFF" },
  brief: { from: "#0F2638", to: "#1C4E6E", tint: "#FFFFFF" },
};

/**
 * 갈래마다 다른 무늬. 사진 없이도 화면이 비어 보이지 않게.
 *
 * 그라데이션 id 는 띠마다 달라야 한다. 같은 쪽에 휴대폰용·PC용 띠가 둘 있고 한쪽은 display:none 인데,
 * id 가 같으면 크롬은 문서에서 먼저 나온(숨겨진) 정의를 가리켜 그리지 못하고 검정으로 칠한다.
 * 2026-10-06 PC 첫 화면의 띠가 회색으로 보인 원인.
 */
function Art({ kind }: { kind: HotKind }) {
  const t = TONE[kind];
  const gid = `g-${kind}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice"
         className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.from} />
          <stop offset="1" stopColor={t.to} />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${gid})`} />
      <g fill="none" stroke={t.tint} strokeOpacity=".18" strokeWidth="1.4">
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
        {kind === "brief" && (
          <>
            <rect x="256" y="40" width="118" height="124" rx="8" />
            <path d="M272 64h86M272 82h60M272 100h86M272 118h48M272 136h74" strokeOpacity=".4" strokeWidth="2" />
            <circle cx="352" cy="118" r="12" strokeOpacity=".7" strokeWidth="2" />
            <path d="M346 118l4 4 8-8" strokeOpacity=".9" strokeWidth="2.2" />
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

const KIND_LABEL: Record<HotKind, string> = { pin: "정부지원", exam: "자격시험", job: "공공기관 채용", biz: "기업지원", brief: "오늘의 채용 브리핑" };

/**
 * 첫 화면의 큰 띠(휴대폰 92px, 넓은 화면 108px). 2026-10-16 "첫 화면이 눈에 안 띈다"는 말에
 * 64px 얇은 띠를 키우고 글자를 굵게, 부제를 휴대폰에도 보이게 했다. 156px 짜리 옛 띠처럼 첫 화면을
 * 반 넘게 덮지는 않는다. 남은 날·갈래·제목·부제, 넓은 화면은 오른쪽에 넘김 단추.
 */
export default function HotBanner({ slides, className = "mt-6" }: { slides: Slide[]; className?: string }) {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const n = slides.length;
  const touch = useRef<number | null>(null);

  const go = useCallback((next: number) => setI(((next % n) + n) % n), [n]);

  // 움직임을 줄이도록 설정한 기기는 미끄러지는 효과만 끈다(넘어가기는 한다).
  const [still, setStill] = useState(false);
  useEffect(() => { setStill(!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches); }, []);

  // 자동 넘김은 첫 터치·스크롤 뒤에(lib/useAfterInteraction). 넘어간 장의 큰 글자가 LCP 를 늦췄다(2026-10-21).
  const autoGo = useAfterInteraction();
  // 손으로 넘기면 그때부터 다시 6초. i 가 바뀔 때마다 시계를 새로 건다.
  useEffect(() => {
    if (!autoGo || n < 2 || hold) return;
    const t = setTimeout(() => {
      // 다른 탭을 보고 있으면 넘기지 않는다. 돌아왔을 때 엉뚱한 장이 떠 있다.
      if (!document.hidden) setI((p) => (p + 1) % n);
    }, EVERY);
    return () => clearTimeout(t);
  }, [n, hold, i, autoGo]);

  if (!n) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="마감이 가까운 안내"
      className={`relative ${className}`}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      // 자판으로 들어온 초점만 멈춘다. 손가락으로 넘김 단추를 누르면 초점이 남아 영영 멈췄다.
      onFocusCapture={(e) => { if ((e.target as HTMLElement).matches?.(":focus-visible")) setHold(true); }}
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
          className={`flex ${still ? "" : "transition-transform duration-500 ease-out"}`}
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {slides.map((s, idx) => (
            <div key={s.key} className="w-full shrink-0" aria-hidden={idx !== i}>
              <Link
                href={s.href}
                tabIndex={idx === i ? 0 : -1}
                className={`relative flex h-[92px] items-center gap-4 overflow-hidden sm:h-[108px] ${n > 1 ? "pl-12 pr-[92px] sm:pl-14 sm:pr-[104px]" : "px-4 sm:px-5"}`}
              >
                {PHOTO[s.kind] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={PHOTO[s.kind]} alt="" aria-hidden
                       className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <Art kind={s.kind} />
                )}
                {/* 글씨 쪽(왼쪽)을 살짝 어둡게 — 밝은 색 띠에서도 흰 글씨가 읽힌다. */}
                <span className="absolute inset-0 bg-gradient-to-r from-black/25 via-black/10 to-transparent" />
                <span className="relative min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-white/85 sm:text-[12.5px]">
                    <span className={`num rounded-pill px-2 py-px text-[12px] font-extrabold ${
                      s.kind === "brief" ? "bg-white text-ink" : s.days <= 1 ? "bg-white text-alert" : "bg-white/20 text-white"}`}>
                      {s.kind === "brief" ? "오늘" : dueLabel(s.days)}
                    </span>
                    {KIND_LABEL[s.kind]}
                  </span>
                  <b className="mt-0.5 block truncate text-[16.5px] font-extrabold leading-snug tracking-[-.02em] text-white sm:mt-1 sm:text-[19px]">
                    {s.title}
                  </b>
                  <span className="mt-0.5 block truncate text-[12px] text-white/80 sm:text-[13px]">{s.sub}</span>
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {n > 1 && (
        <>
          {/* 좌우 넘김 단추. 휴대폰에서도 보이게 둥근 단추로. */}
          <button type="button" onClick={() => go(i - 1)} aria-label="이전 안내"
                  className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white transition-colors hover:bg-black/40 sm:left-3">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M12 5l-5 5 5 5" /></svg>
          </button>
          <div className="absolute inset-y-0 right-2 flex items-center gap-1.5 text-white sm:right-3">
            {/* 저절로 넘어갈 때는 읽어 주지 않는다(6초마다 끼어든다). 손이 머물러 멈췄을 때만. */}
            <span className="num rounded-pill bg-black/25 px-2 py-0.5 text-[11.5px] font-semibold" aria-live={hold ? "polite" : "off"}>
              {i + 1}<span className="opacity-70"> / {n}</span>
            </span>
            <button type="button" onClick={() => go(i + 1)} aria-label="다음 안내"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/25 transition-colors hover:bg-black/40">
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M8 5l5 5-5 5" /></svg>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
