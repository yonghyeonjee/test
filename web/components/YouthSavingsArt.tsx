import { MAX_MONTHLY, PLANS, estimate, manwon, won } from "@/lib/youthSavings";

/**
 * 청년미래적금 그림들.
 *
 * 사진 대신 구조를 그린다. 이 상품이 유리한 이유는 금리가 아니라 "내 돈에
 * 정부 돈이 얹히고 이자에서 세금을 안 뗀다"는 구조에 있어서, 그 구조가
 * 보이면 설명이 절반은 끝난다.
 */

/** 머리 그림: 내 돈 + 정부기여금 + 비과세 이자. */
export function SavingsHero({ className = "" }: { className?: string }) {
  const ink = "#EAF3EE", dim = "rgba(234,243,238,.5)", hi = "#C4B5FD", gold = "#F5D98B";
  return (
    <svg viewBox="0 0 340 150" className={`w-full ${className}`} role="img"
         aria-label="내가 넣는 돈에 정부기여금과 세금을 떼지 않은 이자가 얹혀 만기 금액이 된다는 그림"
         fontFamily="inherit">
      <rect width="340" height="150" rx="14" fill="#2A2266" />
      {/* 쌓이는 세 층 */}
      <g transform="translate(24 28)">
        <text x="0" y="0" fontSize="10" fill={hi} fontWeight="700">3년 동안</text>
        <rect x="0" y="10" width="120" height="26" rx="6" fill="rgba(255,255,255,.12)" stroke={dim} />
        <text x="10" y="27" fontSize="11.5" fill={ink} fontWeight="700">내가 넣는 돈</text>

        <rect x="0" y="44" width="78" height="26" rx="6" fill={hi} />
        <text x="10" y="61" fontSize="11.5" fill="#1E1B4B" fontWeight="800">정부기여금</text>

        <rect x="0" y="78" width="64" height="26" rx="6" fill="rgba(245,217,139,.9)" />
        <text x="10" y="95" fontSize="11.5" fill="#3A2B00" fontWeight="800">이자</text>
        <text x="72" y="95" fontSize="9.5" fill={gold} fontWeight="700">세금 0원</text>
      </g>
      {/* 화살표 */}
      <path d="M168 75h26" stroke={dim} strokeWidth="1.5" />
      <path d="M190 70l6 5-6 5" fill="none" stroke={dim} strokeWidth="1.5" />
      {/* 만기 */}
      <g transform="translate(206 38)">
        <rect width="112" height="74" rx="10" fill="rgba(255,255,255,.1)" stroke={hi} />
        <text x="14" y="26" fontSize="10" fill={hi} fontWeight="700">3년 뒤</text>
        <text x="14" y="48" fontSize="17" fill={ink} fontWeight="800">더 큰 돈</text>
        <text x="14" y="63" fontSize="9.5" fill={dim}>만기에 한 번에</text>
      </g>
    </svg>
  );
}

const PREF = PLANS[0], STD = PLANS[1], NONE = PLANS[2];

/**
 * 월 50만원씩 3년, 연 5% 일 때 얼마나 차이가 나는지.
 *
 * 막대는 HTML 로 그린다. 좁은 화면에서 글자가 찌그러지지 않고, 금액을
 * 읽어 주는 기계에도 그대로 전달된다.
 */
export function CompareBars() {
  const rate = 5;
  const rows = [
    { label: "보통 적금 (같은 금리)", e: estimate(MAX_MONTHLY, NONE, rate), plain: true },
    { label: "청년미래적금 일반형", e: estimate(MAX_MONTHLY, STD, rate), plain: false },
    { label: "청년미래적금 우대형", e: estimate(MAX_MONTHLY, PREF, rate), plain: false },
  ];
  const value = (r: (typeof rows)[number]) => (r.plain ? r.e.plain : r.e.total);
  const max = Math.max(...rows.map(value));
  const base = value(rows[0]);

  return (
    <figure className="card mt-6 p-5">
      <figcaption className="text-[15px] font-bold">
        매달 50만원씩 3년, 금리가 연 5%라면
      </figcaption>
      <ul className="mt-4 space-y-4">
        {rows.map((r) => {
          const v = value(r);
          const seg = r.plain
            ? [
                { w: r.e.principal, cls: "bg-line2" },
                { w: r.e.interest - r.e.tax, cls: "bg-gold" },
              ]
            : [
                { w: r.e.principal, cls: "bg-line2" },
                { w: r.e.match, cls: "bg-brand" },
                { w: r.e.interest, cls: "bg-gold" },
              ];
          return (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13.5px] font-semibold text-ink2">{r.label}</span>
                <b className="num text-[14px] font-extrabold">{manwon(v)}</b>
              </div>
              <div className="mt-1.5 flex h-5 overflow-hidden rounded-pill bg-ground" aria-hidden>
                {seg.map((s, i) => (
                  <div key={i} className={s.cls} style={{ width: `${(s.w / max) * 100}%` }} />
                ))}
              </div>
              {!r.plain && (
                <p className="num mt-1 text-xs text-muted">
                  보통 적금보다 {won(v - base)} 많음
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        {[
          { c: "bg-line2", t: "낸 돈 1,800만원" },
          { c: "bg-brand", t: "정부기여금" },
          { c: "bg-gold", t: "이자" },
        ].map((l) => (
          <span key={l.t} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${l.c}`} />
            {l.t}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-faint">
        단리로 어림잡았고 정부기여금에 붙는 이자는 넣지 않았습니다. 보통 적금 쪽은 이자에서
        세금 15.4%를 뺐습니다.
      </p>
    </figure>
  );
}

export type Step = { when: string; what: string; detail: string };

/** 신청부터 계좌 개설까지. 날짜가 앞뒤로 맞물려 있어 한눈에 보여야 한다. */
export function Timeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-6 space-y-0">
      {steps.map((s, i) => (
        <li key={s.what} className="relative flex gap-4 pb-6 last:pb-0">
          {/* 세로 줄. 마지막 칸에는 긋지 않는다. */}
          {i < steps.length - 1 && (
            <span className="absolute left-[11px] top-6 h-full w-px bg-line2" aria-hidden />
          )}
          <span className="relative z-10 mt-1 h-[22px] w-[22px] shrink-0 rounded-full border-[3px]
                           border-brand bg-surface" aria-hidden />
          <div className="min-w-0">
            <p className="num text-[13px] font-bold text-brand">{s.when}</p>
            <b className="mt-0.5 block text-[15px] font-bold">{s.what}</b>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{s.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
