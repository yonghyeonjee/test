/**
 * 화면 삽화 묶음.
 *
 * 사진은 출처·용량 문제가 있어 전부 SVG 로 그린다(public/img 에 사진을 넣으면
 * Photo 가 그쪽을 먼저 쓴다). 그림마다 같은 규칙으로 그려 한 사이트처럼 보이게:
 *  - 뒤에 옅은 보라 덩어리(#ECEAFF) 하나, 그 위에 흰 면 + 2.2px 보라 선
 *  - 보조 면은 #7B6CF6 / #C4B5FD, 강조 점은 금색(#F0C98A) 하나만
 *  - viewBox 200×140, 장식이라 aria-hidden
 */

type P = { className?: string };
const B = "#5A4BE0", B2 = "#7B6CF6", SOFT = "#ECEAFF", PALE = "#C4B5FD", GOLD = "#F0C98A", INK = "#1E1B4B";
const S = { fill: "none", stroke: B, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Frame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 200 140" className={`h-full w-full ${className}`} aria-hidden fontFamily="inherit">
      {children}
    </svg>
  );
}
const Blob = ({ d = "M36 22c26-18 80-20 118 6 30 20 30 70 2 90-34 24-96 22-124-6-24-24-22-72 4-90z" }: { d?: string }) => (
  <path d={d} fill={SOFT} />
);

/** 생활금융: 동전 더미 + 이자 꼬리표 + 은행 */
export function IllusMoney({ className = "" }: P) {
  return (
    <Frame className={className}>
      <Blob />
      <g {...S}>
        <path d="M118 42l22-12 22 12v6h-44z" fill="#fff" />
        <path d="M122 48v28M133 48v28M147 48v28M158 48v28M116 76h48" />
      </g>
      <g {...S}>
        <ellipse cx="66" cy="104" rx="30" ry="10" fill="#fff" />
        <path d="M36 104v-12c0 5.5 13.4 10 30 10s30-4.5 30-10v12" fill="#fff" />
        <ellipse cx="66" cy="92" rx="30" ry="10" fill={SOFT} />
        <path d="M36 92v-12c0 5.5 13.4 10 30 10s30-4.5 30-10v12" fill="#fff" />
        <ellipse cx="66" cy="80" rx="30" ry="10" fill={B2} />
      </g>
      <text x="66" y="85" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">₩</text>
      <g transform="translate(118 90)">
        <path d="M0 10l12-12h30a4 4 0 014 4v16a4 4 0 01-4 4H12z" {...S} fill="#fff" />
        <circle cx="14" cy="10" r="2.4" fill={B} />
        <text x="22" y="14.5" fontSize="13" fontWeight="800" fill={B}>%↓</text>
      </g>
      <circle cx="152" cy="24" r="4" fill={GOLD} />
    </Frame>
  );
}

/** 자격증: 증서 + 리본 도장 */
export function IllusLicense({ className = "" }: P) {
  return (
    <Frame className={className}>
      <Blob d="M40 18c30-14 88-14 118 10 24 20 20 72-6 90-34 22-92 18-120-10-22-22-20-74 8-90z" />
      <rect x="44" y="30" width="112" height="80" rx="10" {...S} fill="#fff" />
      <rect x="52" y="38" width="96" height="64" rx="6" fill="none" stroke={PALE} strokeWidth="1.6" strokeDasharray="3 4" />
      <g stroke={B2} strokeWidth="3" strokeLinecap="round">
        <path d="M66 54h68M66 66h50" />
      </g>
      <path d="M66 80h30" stroke={PALE} strokeWidth="3" strokeLinecap="round" />
      <g transform="translate(128 88)">
        <path d="M-8 6l-6 22 14-8 14 8-6-22z" fill={B2} />
        <circle r="16" fill={GOLD} stroke={B} strokeWidth="2.2" />
        <circle r="9" fill="none" stroke={B} strokeWidth="2" />
        <path d="M-4 0l3 3 6-6" {...S} />
      </g>
    </Frame>
  );
}

/** 채용: 건물 스카이라인 + 서류가방 + 위치 핀 */
export function IllusJobs({ className = "" }: P) {
  return (
    <Frame className={className}>
      <Blob />
      <g {...S}>
        <rect x="40" y="48" width="34" height="62" rx="4" fill="#fff" />
        <rect x="80" y="30" width="44" height="80" rx="4" fill="#fff" />
        <rect x="130" y="56" width="32" height="54" rx="4" fill="#fff" />
      </g>
      <g fill={PALE}>
        {[0, 1, 2].map((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={48 + c * 12} y={56 + r * 14} width="6" height="8" rx="1" />))}
        {[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => <rect key={`b${r}${c}`} x={88 + c * 12} y={38 + r * 14} width="6" height="8" rx="1" />))}
        {[0, 1, 2].map((r) => [0, 1].map((c) => <rect key={`c${r}${c}`} x={138 + c * 12} y={64 + r * 14} width="6" height="8" rx="1" />))}
      </g>
      <path d="M30 110h140" {...S} />
      <g transform="translate(74 70)">
        <rect x="0" y="12" width="52" height="36" rx="8" fill={B2} stroke={B} strokeWidth="2.2" />
        <path d="M16 12V6a4 4 0 014-4h12a4 4 0 014 4v6" {...S} />
        <path d="M0 28h52" stroke={INK} strokeWidth="2" strokeOpacity=".35" />
        <rect x="21" y="24" width="10" height="8" rx="2" fill="#fff" />
      </g>
      <g transform="translate(152 22)">
        <path d="M0 24c0 10 12 20 12 20s12-10 12-20a12 12 0 00-24 0z" fill={GOLD} stroke={B} strokeWidth="2.2" />
        <circle cx="12" cy="23" r="4" fill="#fff" />
      </g>
    </Frame>
  );
}

/** 공공기관: 기둥 건물 + 사람들 */
export function IllusAgency({ className = "" }: P) {
  return (
    <Frame className={className}>
      <Blob />
      <g {...S}>
        <path d="M44 56l56-26 56 26z" fill="#fff" />
        <path d="M50 56h100v8H50z" fill={PALE} />
        {[58, 78, 98, 118, 138].map((x) => <rect key={x} x={x - 4} y="64" width="8" height="36" rx="2" fill="#fff" />)}
        <path d="M44 100h112M38 110h124" />
      </g>
      <circle cx="100" cy="44" r="4" fill={GOLD} />
      <g fill={B2}>
        <circle cx="70" cy="118" r="5" /><rect x="64" y="124" width="12" height="10" rx="4" />
        <circle cx="130" cy="118" r="5" /><rect x="124" y="124" width="12" height="10" rx="4" />
      </g>
    </Frame>
  );
}

/** 주거: 집 + 열쇠 */
export function IllusHousing({ className = "" }: P) {
  return (
    <Frame className={className}>
      <Blob />
      <g {...S}>
        <path d="M46 68l44-34 44 34v40a6 6 0 01-6 6H52a6 6 0 01-6-6z" fill="#fff" />
        <path d="M36 72l54-42 54 42" strokeWidth="3.2" />
        <rect x="80" y="86" width="20" height="28" rx="3" fill={B2} />
        <rect x="56" y="80" width="14" height="14" rx="2" fill={SOFT} />
        <rect x="110" y="80" width="14" height="14" rx="2" fill={SOFT} />
      </g>
      <g transform="translate(140 92) rotate(-35)">
        <circle r="10" fill={GOLD} stroke={B} strokeWidth="2.2" />
        <circle r="3.5" fill="#fff" />
        <path d="M10 0h26M28 0v7M22 0v5" {...S} />
      </g>
    </Frame>
  );
}

/** 블로그·안내 글: 펼친 책 + 펜 */
export function IllusStory({ className = "" }: P) {
  return (
    <Frame className={className}>
      <Blob />
      <g {...S}>
        <path d="M100 48c-14-10-34-10-50-4v62c16-6 36-6 50 4z" fill="#fff" />
        <path d="M100 48c14-10 34-10 50-4v62c-16-6-36-6-50 4z" fill="#fff" />
        <path d="M100 48v62" />
      </g>
      <g stroke={PALE} strokeWidth="2.6" strokeLinecap="round">
        <path d="M62 60c10-3 20-3 30 0M62 72c10-3 20-3 30 0M62 84c8-2 14-2 22 0M108 60c10-3 20-3 30 0M108 72c10-3 20-3 30 0" />
      </g>
      <g transform="translate(132 100) rotate(45)">
        <rect x="-5" y="-30" width="10" height="40" rx="2" fill={B2} stroke={B} strokeWidth="2.2" />
        <path d="M-5 10l5 10 5-10z" fill={GOLD} stroke={B} strokeWidth="2.2" strokeLinejoin="round" />
      </g>
      <path d="M44 34l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill={GOLD} />
    </Frame>
  );
}

/** 무료 서비스: 선물 상자 */
export function IllusFree({ className = "" }: P) {
  return (
    <Frame className={className}>
      <Blob />
      <g {...S}>
        <rect x="58" y="62" width="84" height="52" rx="8" fill="#fff" />
        <rect x="50" y="46" width="100" height="20" rx="6" fill={B2} />
        <path d="M100 46v68M94 46c-14-2-22-8-20-16s14-4 20 10c6-14 18-18 20-10s-6 14-20 16" fill="#fff" />
      </g>
      <path d="M156 30l2.5 5 5 2.5-5 2.5-2.5 5-2.5-5-5-2.5 5-2.5zM40 92l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill={GOLD} />
    </Frame>
  );
}

/** 비어 있음·없는 쪽: 열린 상자 */
export function IllusEmpty({ className = "" }: P) {
  return (
    <Frame className={className}>
      <Blob />
      <g {...S}>
        <path d="M54 70l46-14 46 14v40l-46 14-46-14z" fill="#fff" />
        <path d="M54 70l46 14 46-14M100 84v40" />
        <path d="M54 70l-10-18 46-12 10 16M146 70l10-18-46-12-10 16" fill={SOFT} />
      </g>
      <g stroke={PALE} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 5">
        <circle cx="100" cy="30" r="12" fill="none" />
      </g>
      <text x="100" y="34" textAnchor="middle" fontSize="12" fontWeight="800" fill={B}>?</text>
    </Frame>
  );
}

/** 소개·신뢰: 방패 + 확인 */
export function IllusAbout({ className = "" }: P) {
  return (
    <Frame className={className}>
      <Blob />
      <path d="M100 26l42 14v30c0 24-18 40-42 48-24-8-42-24-42-48V40z" {...S} fill="#fff" />
      <path d="M100 38l30 10v22c0 18-13 29-30 36-17-7-30-18-30-36V48z" fill={SOFT} />
      <path d="M84 74l11 11 22-24" fill="none" stroke={B} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="152" cy="36" r="4" fill={GOLD} />
      <circle cx="46" cy="104" r="3" fill={B2} />
    </Frame>
  );
}

/** 내 조건: 신분증 모양 카드 */
export function IllusMe({ className = "" }: P) {
  return (
    <Frame className={className}>
      <Blob />
      <rect x="40" y="40" width="120" height="68" rx="10" {...S} fill="#fff" />
      <circle cx="68" cy="68" r="12" fill={SOFT} stroke={B} strokeWidth="2.2" />
      <circle cx="68" cy="64" r="4.5" fill={B} />
      <path d="M58 78c2-6 6-8 10-8s8 2 10 8" fill="none" stroke={B} strokeWidth="2.2" strokeLinecap="round" />
      <g stroke={B2} strokeWidth="3" strokeLinecap="round">
        <path d="M92 60h44M92 72h30" />
      </g>
      <path d="M92 84h20" stroke={PALE} strokeWidth="3" strokeLinecap="round" />
      <g transform="translate(144 32)">
        <circle r="12" fill={GOLD} stroke={B} strokeWidth="2.2" />
        <path d="M-5 0l4 4 7-8" {...S} />
      </g>
    </Frame>
  );
}

/** 첨부: 서류 더미 + 클립 */
export function IllusFiles({ className = "" }: P) {
  return (
    <Frame className={className}>
      <Blob />
      <g {...S}>
        <rect x="70" y="26" width="64" height="80" rx="6" fill={SOFT} transform="rotate(8 102 66)" />
        <rect x="62" y="30" width="64" height="80" rx="6" fill="#fff" transform="rotate(-4 94 70)" />
        <rect x="68" y="34" width="64" height="80" rx="6" fill="#fff" />
      </g>
      <g stroke={B2} strokeWidth="3" strokeLinecap="round">
        <path d="M80 56h40M80 68h40M80 80h26" />
      </g>
      <rect x="104" y="92" width="24" height="14" rx="4" fill={B} />
      <text x="116" y="102.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#fff">PDF</text>
      <path d="M66 30c-6 0-10 4-10 10v40" fill="none" stroke={GOLD} strokeWidth="3.5" strokeLinecap="round" />
    </Frame>
  );
}

/** 찾기: 돋보기 + 목록 */
export function IllusSearch({ className = "" }: P) {
  return (
    <Frame className={className}>
      <Blob />
      <rect x="40" y="34" width="90" height="76" rx="10" {...S} fill="#fff" />
      <g stroke={B2} strokeWidth="3" strokeLinecap="round">
        <path d="M56 52h44M56 66h58M56 80h36" />
      </g>
      <path d="M56 94h26" stroke={PALE} strokeWidth="3" strokeLinecap="round" />
      <g transform="translate(132 76)">
        <circle r="22" fill="#fff" stroke={B} strokeWidth="2.6" />
        <circle r="13" fill={SOFT} />
        <path d="M-7 0l5 5 10-11" {...S} />
        <path d="M16 16l16 16" stroke={B} strokeWidth="6" strokeLinecap="round" />
      </g>
      <circle cx="46" cy="24" r="4" fill={GOLD} />
    </Frame>
  );
}

/** 사이트 표식. 둥근 네모 안에 "받는다"의 확인 표시. 머리말·꼬리말에 쓴다. */
export function BrandMark({ className = "h-7 w-7" }: P) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5A4BE0" /><stop offset="1" stopColor="#7B6CF6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#bm)" />
      <path d="M8 17.5l5.5 5.5L24 11" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24.5" cy="8" r="2.4" fill="#F0C98A" />
    </svg>
  );
}
