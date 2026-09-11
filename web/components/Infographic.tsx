/**
 * 인포그래픽. 전부 SVG 로 직접 그린다.
 *
 * 사진 대신 "어떻게 돌아가나"를 그림으로 보여 주는 것이 이 사이트에는
 * 더 맞다. 안내 서비스가 믿음직해 보이는 건 예쁜 사진이 아니라 절차가
 * 투명해 보일 때다. 색은 팔레트 안에서만, 글자는 화면 글꼴을 그대로 쓴다.
 */

/** 히어로 오른쪽: 세 단계 흐름. 입력 → 걸러진 목록 → 원문 신청. */
export function HowItWorksArt({ className = "" }: { className?: string }) {
  const ink = "#EAF3EE", dim = "rgba(234,243,238,.55)", hi = "#C4B5FD";
  return (
    <svg viewBox="0 0 300 250" className={`h-full w-full ${className}`} aria-hidden
         fontFamily="inherit">
      {/* 연결선 */}
      <path className="flow" d="M62 60v60M62 150v50" stroke={dim} strokeWidth="1.5" />
      <path className="flow" d="M150 60v60M150 150v50" stroke={dim} strokeWidth="1.5" />
      {/* 1. 입력 */}
      <g transform="translate(20 22)">
        <rect width="84" height="46" rx="8" fill="rgba(255,255,255,.08)" stroke={dim} />
        <text x="10" y="19" fontSize="9.5" fill={hi} fontWeight="700">1 · 넣는 것</text>
        <text x="10" y="36" fontSize="12" fill={ink} fontWeight="700">사는 곳 · 나이</text>
      </g>
      {/* 2. 걸러진 목록 */}
      <g transform="translate(20 112)">
        <rect width="84" height="46" rx="8" fill="rgba(255,255,255,.08)" stroke={dim} />
        <text x="10" y="19" fontSize="9.5" fill={hi} fontWeight="700">2 · 남는 것</text>
        <text x="10" y="36" fontSize="12" fill={ink} fontWeight="700">해당되는 공고만</text>
      </g>
      {/* 3. 신청 */}
      {/* CSS transform 은 SVG transform 속성을 덮어쓴다. 자리는 바깥 g 가, 숨쉬기는 안쪽 g 가 맡는다. */}
      <g transform="translate(20 202)">
        <g className="pulse">
          <rect width="84" height="46" rx="8" fill={hi} />
          <text x="10" y="19" fontSize="9.5" fill="#1E1B4B" fontWeight="700">3 · 하는 것</text>
          <text x="10" y="36" fontSize="12" fill="#1E1B4B" fontWeight="800">원문에서 신청</text>
        </g>
      </g>
      {/* 오른쪽: 공고 더미가 줄어드는 그림 */}
      <g transform="translate(130 22)">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect key={i} x={i * 4} y={i * 3} width="140" height="40" rx="6"
                fill="rgba(255,255,255,.06)" stroke={dim} />
        ))}
        <text x="34" y="36" fontSize="11" fill={dim}>전국 공고 수천 건</text>
      </g>
      <path d="M200 92l0 18" stroke={hi} strokeWidth="2" markerEnd="url(#arr)" />
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="5" refY="8" markerWidth="8" markerHeight="8"
                orient="auto">
          <path d="M1 1l4 6 4-6" fill="none" stroke={hi} strokeWidth="1.6" strokeLinecap="round" />
        </marker>
      </defs>
      <g transform="translate(130 118)">
        {[0, 1].map((i) => (
          <rect key={i} x={i * 4} y={i * 3} width="140" height="40" rx="6"
                fill="rgba(255,255,255,.10)" stroke={hi} />
        ))}
        <text x="34" y="36" fontSize="11" fill={ink} fontWeight="700">내 조건에 맞는 몇 건</text>
        <path d="M14 30l5 5 9-10" fill="none" stroke={hi} strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="translate(130 202)">
        <rect width="150" height="46" rx="8" fill="rgba(255,255,255,.06)" stroke={dim} />
        <text x="14" y="20" fontSize="10" fill={dim}>공고 원문 · 주민센터 · 온라인</text>
        <text x="14" y="37" fontSize="12" fill={ink} fontWeight="700">신청 자격 최종 확인 →</text>
      </g>
    </svg>
  );
}

/** 두 몫의 비율 막대. 개인 복지 대 기업 지원처럼. */
export function ShareBar({ a, b, labelA, labelB }: {
  a: number; b: number; labelA: string; labelB: string;
}) {
  const total = a + b || 1;
  const pa = Math.round((a / total) * 100);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-pill bg-white/10">
        <div className="bg-[#C4B5FD]" style={{ width: `${pa}%` }} />
        <div className="ml-0.5 flex-1 bg-white/35" />
      </div>
      <div className="mt-2 flex justify-between text-[12px] text-white/75">
        <span><b className="num text-white">{pa}%</b> {labelA}</span>
        <span>{labelB} <b className="num text-white">{100 - pa}%</b></span>
      </div>
    </div>
  );
}

/** 믿을 수 있는 이유 네 가지에 붙는 선 아이콘. */
export const TRUST_ICONS: Record<string, string> = {
  source: "M4 5h16v14H4z M8 9h8M8 13h5",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1 M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  lock: "M6 11h12v9H6z M9 11V8a3 3 0 016 0v3",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 7v5l3 2",
};

export function TrustIcon({ name }: { name: keyof typeof TRUST_ICONS }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-brand" fill="none" stroke="currentColor"
         strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={TRUST_ICONS[name]} />
    </svg>
  );
}
