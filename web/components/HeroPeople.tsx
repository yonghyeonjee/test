/**
 * 첫 화면 그림. 정책 앱의 삽화처럼 사람 셋이 각자 받은 지원을 들고 있다.
 * 단순한 도형으로만 그려 어느 화면 크기에서도 깨지지 않는다.
 */
export default function HeroPeople({ className = "" }: { className?: string }) {
  const skin = "#F5D0B5", skin2 = "#E0B08F", ink = "#1E1B4B";
  const Person = ({ x, y, shirt, hair, label, tag }: { x: number; y: number; shirt: string; hair: string; label: string; tag: string }) => (
    <g transform={`translate(${x} ${y})`}>
      {/* 말풍선 카드 */}
      <g transform="translate(-58 -78)">
        <rect width="116" height="46" rx="12" fill="#fff" />
        <text x="12" y="19" fontSize="9" fontWeight="700" fill="#5A4BE0" fontFamily="inherit">{tag}</text>
        <text x="12" y="36" fontSize="12.5" fontWeight="800" fill={ink} fontFamily="inherit">{label}</text>
        <path d="M52 46l6 8 6-8z" fill="#fff" />
      </g>
      {/* 몸 */}
      <path d="M-26 40c0-16 12-24 26-24s26 8 26 24v30h-52z" fill={shirt} />
      {/* 머리 */}
      <circle cx="0" cy="0" r="18" fill={skin} />
      <path d={hair} fill={ink} />
      <circle cx="-6" cy="2" r="1.8" fill={ink} /><circle cx="6" cy="2" r="1.8" fill={ink} />
      <path d="M-5 9q5 4 10 0" fill="none" stroke={skin2} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
  return (
    <svg viewBox="0 0 320 250" className={`h-full w-full ${className}`} aria-hidden fontFamily="inherit">
      <ellipse cx="160" cy="232" rx="140" ry="10" fill="rgba(255,255,255,.10)" />
      <Person x={70} y={120} shirt="#7B6CF6" hair="M-18 -2c0-14 8-20 18-20s18 6 18 20c-4-8-10-10-18-10s-14 2-18 10z" label="청년 월세지원" tag="주거" />
      <Person x={160} y={130} shirt="#F59E0B" hair="M-18 0c0-12 6-22 18-22s18 10 18 22c-3-6-9-8-18-8s-15 2-18 8z M-18 0v10h6v-8z M18 0v10h-6v-8z" label="어르신 돌봄" tag="돌봄" />
      <Person x={250} y={120} shirt="#22C55E" hair="M-18 -4c0-12 8-18 18-18s18 6 18 18c-6-6-10-8-18-8s-12 2-18 8z" label="창업 자금" tag="기업" />
      {/* 큰 확인 표시 */}
      <circle cx="292" cy="40" r="20" fill="#C4B5FD" />
      <path d="M283 40l6 6 12-12" fill="none" stroke={ink} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
