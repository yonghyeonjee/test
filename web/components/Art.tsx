/**
 * 화면에 쓰는 그림.
 *
 * 사진을 가져다 쓰면 출처와 이용 조건을 매번 따져야 하고, 파일이 무거워
 * 모바일에서 먼저 느려진다. 그래서 전부 직접 그린 SVG 로 둔다. 색은
 * 팔레트의 초록 계열만 쓰고, 선 굵기도 화면 글자와 맞춰 놨다.
 *
 * 장식일 뿐이므로 aria-hidden 으로 읽히지 않게 한다. 뜻은 옆의 글이 진다.
 */

type P = { className?: string };

const base = "h-full w-full";

export function ArtPolicy({ className = "" }: P) {
  return (
    <svg viewBox="0 0 160 110" className={`${base} ${className}`} aria-hidden>
      <rect x="18" y="16" width="72" height="82" rx="8" fill="#E4EEF9" />
      <rect x="30" y="8" width="72" height="82" rx="8" fill="#fff"
            stroke="#0B5FA5" strokeWidth="2.4" />
      <g stroke="#2F7FD0" strokeWidth="3" strokeLinecap="round">
        <path d="M42 28h48M42 40h48M42 52h30" />
      </g>
      <g stroke="#C5D0DE" strokeWidth="3" strokeLinecap="round">
        <path d="M42 64h48M42 76h34" />
      </g>
      <circle cx="108" cy="66" r="24" fill="#fff" stroke="#0B5FA5" strokeWidth="2.4" />
      <circle cx="108" cy="66" r="14" fill="#E4EEF9" />
      <path d="M126 84l14 14" stroke="#0B5FA5" strokeWidth="6" strokeLinecap="round" />
      <path d="M101 66l5 5 9-10" fill="none" stroke="#0B5FA5"
            strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArtJeonse({ className = "" }: P) {
  return (
    <svg viewBox="0 0 160 110" className={`${base} ${className}`} aria-hidden>
      <path d="M20 52L56 22l36 30v44a6 6 0 01-6 6H26a6 6 0 01-6-6z"
            fill="#fff" stroke="#0B5FA5" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M12 54L56 17l44 37" fill="none" stroke="#0B5FA5"
            strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="44" y="66" width="24" height="36" rx="3" fill="#E4EEF9" />
      <rect x="30" y="62" width="12" height="12" rx="2" fill="#E4EEF9" />
      <g>
        <rect x="104" y="74" width="12" height="24" rx="3" fill="#C5D0DE" />
        <rect x="121" y="60" width="12" height="38" rx="3" fill="#2F7FD0" />
        <rect x="138" y="44" width="12" height="54" rx="3" fill="#0B5FA5" />
      </g>
      <path d="M104 36h48" stroke="#E1E7F0" strokeWidth="2" strokeLinecap="round" />
      <text x="128" y="32" textAnchor="middle" fontSize="17" fontWeight="700"
            fill="#0B5FA5" fontFamily="inherit">%</text>
    </svg>
  );
}

export function ArtStudy({ className = "" }: P) {
  return (
    <svg viewBox="0 0 160 110" className={`${base} ${className}`} aria-hidden>
      <path d="M58 20L16 38l42 18 42-18z" fill="#0B5FA5" />
      <path d="M30 46v20c0 7 12 13 28 13s28-6 28-13V46" fill="none"
            stroke="#0B5FA5" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M100 38v22" stroke="#0B5FA5" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="100" cy="64" r="4" fill="#0B5FA5" />
      <g stroke="#0B5FA5" strokeWidth="2.4">
        <ellipse cx="124" cy="54" rx="24" ry="8" fill="#E4EEF9" />
        <path d="M100 54v14c0 4.4 10.7 8 24 8s24-3.6 24-8V54" fill="#fff" />
        <ellipse cx="124" cy="68" rx="24" ry="8" fill="#E4EEF9" />
        <path d="M100 68v14c0 4.4 10.7 8 24 8s24-3.6 24-8V68" fill="#fff" />
        <ellipse cx="124" cy="82" rx="24" ry="8" fill="#E4EEF9" />
      </g>
      <text x="124" y="87" textAnchor="middle" fontSize="12" fontWeight="700"
            fill="#0B5FA5" fontFamily="inherit">₩</text>
    </svg>
  );
}

export function ArtMoney({ className = "" }: P) {
  return (
    <svg viewBox="0 0 160 110" className={`${base} ${className}`} aria-hidden>
      <rect x="14" y="30" width="86" height="56" rx="8" fill="#E4EEF9" />
      <rect x="26" y="20" width="86" height="56" rx="8" fill="#fff"
            stroke="#0B5FA5" strokeWidth="2.4" />
      <circle cx="69" cy="48" r="15" fill="#E4EEF9" stroke="#0B5FA5" strokeWidth="2.4" />
      <text x="69" y="54" textAnchor="middle" fontSize="16" fontWeight="700"
            fill="#0B5FA5" fontFamily="inherit">₩</text>
      <path d="M120 86V40a6 6 0 016-6h20a6 6 0 016 6v46"
            fill="#fff" stroke="#0B5FA5" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M112 40l24-16 24 16" fill="none" stroke="#0B5FA5"
            strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M130 86V64h12v22" fill="#E4EEF9" />
    </svg>
  );
}

export function ArtLicense({ className = "" }: P) {
  return (
    <svg viewBox="0 0 160 110" className={`${base} ${className}`} aria-hidden>
      <rect x="22" y="18" width="96" height="70" rx="8" fill="#fff"
            stroke="#0B5FA5" strokeWidth="2.4" />
      <rect x="22" y="18" width="96" height="14" rx="8" fill="#0B5FA5" />
      <rect x="22" y="26" width="96" height="6" fill="#0B5FA5" />
      <g stroke="#2F7FD0" strokeWidth="3" strokeLinecap="round">
        <path d="M36 46h40M36 58h52M36 70h30" />
      </g>
      <circle cx="122" cy="80" r="18" fill="#E4EEF9" stroke="#0B5FA5" strokeWidth="2.4" />
      <circle cx="122" cy="80" r="11" fill="none" stroke="#0B5FA5" strokeWidth="2.4" />
      <path d="M116 80l4 4 8-9" fill="none" stroke="#0B5FA5"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M112 96l-4 12 6-3 6 3-4-12" fill="#0B5FA5" />
      <path d="M132 96l4 12-6-3-6 3 4-12" fill="#2F7FD0" />
    </svg>
  );
}

export function ArtJobs({ className = "" }: P) {
  return (
    <svg viewBox="0 0 160 110" className={`${base} ${className}`} aria-hidden>
      <rect x="22" y="38" width="88" height="56" rx="8" fill="#fff"
            stroke="#0B5FA5" strokeWidth="2.4" />
      <path d="M48 38v-8a6 6 0 016-6h24a6 6 0 016 6v8" fill="none"
            stroke="#0B5FA5" strokeWidth="2.4" />
      <rect x="22" y="56" width="88" height="6" fill="#E4EEF9" />
      <rect x="58" y="52" width="16" height="14" rx="3" fill="#0B5FA5" />
      <circle cx="124" cy="40" r="20" fill="#E4EEF9" stroke="#0B5FA5" strokeWidth="2.4" />
      <path d="M116 40l5 5 11-11" fill="none" stroke="#0B5FA5"
            strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <g stroke="#C5D0DE" strokeWidth="3" strokeLinecap="round">
        <path d="M34 74h30M34 84h20" />
      </g>
    </svg>
  );
}

export function ArtAgency({ className = "" }: P) {
  return (
    <svg viewBox="0 0 160 110" className={`${base} ${className}`} aria-hidden>
      <path d="M22 44L80 18l58 26" fill="none" stroke="#0B5FA5" strokeWidth="3.4"
            strokeLinecap="round" strokeLinejoin="round" />
      <rect x="30" y="44" width="100" height="8" fill="#E4EEF9" />
      <g fill="#fff" stroke="#0B5FA5" strokeWidth="2.4">
        <rect x="40" y="52" width="12" height="36" rx="2" />
        <rect x="62" y="52" width="12" height="36" rx="2" />
        <rect x="86" y="52" width="12" height="36" rx="2" />
        <rect x="108" y="52" width="12" height="36" rx="2" />
      </g>
      <rect x="26" y="88" width="108" height="8" rx="2" fill="#0B5FA5" />
      <circle cx="80" cy="34" r="5" fill="#0B5FA5" />
    </svg>
  );
}

/** 글머리 그림 고르기. 이름만 적어 두고 여기서 부품으로 바꾼다. */
export function PostArt({ name, className = "" }: { name?: string; className?: string }) {
  const M = { policy: ArtPolicy, money: ArtMoney, study: ArtStudy, jobs: ArtJobs, agency: ArtAgency, license: ArtLicense, jeonse: ArtJeonse } as const;
  const C = M[(name ?? "policy") as keyof typeof M] ?? ArtPolicy;
  return <C className={className} />;
}
