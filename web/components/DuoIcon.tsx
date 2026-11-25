/**
 * 색이 들어간 두 톤 아이콘(48×48, 2026-11-25). 선 아이콘(PortalIcon)이 차갑다는 말에 첫 화면 갈래·띠에서 쓴다.
 * 복지·보조금 포털처럼 면을 채운 둥근 그림 — 옅은 면 + 진한 면 + 흰 점 하나. 뜻은 옆 글이 지므로 aria-hidden.
 */
const ICON: Record<string, JSX.Element> = {
  // 지원금: 동전 두 닢과 받치는 손
  find: (
    <>
      <ellipse cx="24" cy="38" rx="15" ry="3" fill="#2563EB" opacity=".12" />
      <circle cx="20" cy="20" r="12" fill="#FFD166" />
      <circle cx="20" cy="20" r="8.2" fill="#FFB020" />
      <path d="M15.6 16.5l2 7 2.4-6 2.4 6 2-7M15 19.6h10" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="34" cy="29" r="8" fill="#5B8DF7" />
      <path d="M30.6 29.2l2.4 2.4 4.4-4.8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // 채용: 서류 가방
  jobs: (
    <>
      <ellipse cx="24" cy="39" rx="15" ry="3" fill="#1C7ED6" opacity=".12" />
      <path d="M18 14v-2.5A2.5 2.5 0 0120.5 9h7a2.5 2.5 0 012.5 2.5V14" fill="none" stroke="#1C7ED6" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="7" y="14" width="34" height="23" rx="5" fill="#74B5F5" />
      <path d="M7 19a5 5 0 015-5h24a5 5 0 015 5v5.5a4 4 0 01-3 3.9L26 31h-4L10 28.4a4 4 0 01-3-3.9z" fill="#1C7ED6" />
      <rect x="20.5" y="26" width="7" height="6" rx="1.8" fill="#fff" />
    </>
  ),
  // 자격증: 메달
  license: (
    <>
      <ellipse cx="24" cy="40" rx="13" ry="2.6" fill="#E8590C" opacity=".12" />
      <path d="M16 6h7l3 11h-7z" fill="#FF8A5B" />
      <path d="M32 6h-7l-3 11h7z" fill="#E8590C" />
      <circle cx="24" cy="26.5" r="11.5" fill="#FFC53D" />
      <circle cx="24" cy="26.5" r="8" fill="#FFD980" />
      <path d="M24 21l1.7 3.5 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z" fill="#fff" />
    </>
  ),
  // 기업·창업: 가게
  biz: (
    <>
      <ellipse cx="24" cy="40" rx="15" ry="2.6" fill="#7048E8" opacity=".12" />
      <rect x="9" y="19" width="30" height="19" rx="3" fill="#C9BBFB" />
      <path d="M6.5 17.5L10 9h28l3.500 8.5a4.4 4.4 0 01-8.700 0 4.400 4.400 0 01-8.800 0 4.400 4.400 0 01-8.800 0 4.400 4.400 0 01-8.700 0z" fill="#7048E8" />
      <rect x="13.5" y="26" width="9" height="12" rx="1.8" fill="#7048E8" />
      <rect x="26.5" y="26" width="8.5" height="7" rx="1.8" fill="#fff" />
    </>
  ),
  // 정책지도: 접힌 지도와 핀
  map: (
    <>
      <ellipse cx="24" cy="41" rx="14" ry="2.4" fill="#0C9F6E" opacity=".12" />
      <path d="M6 16l11-4 14 4 11-4v22l-11 4-14-4-11 4z" fill="#A8E6CF" />
      <path d="M17 12l14 4v22l-14-4z" fill="#63D2A8" />
      <path d="M26 5.500a8 8 0 018 8c0 5.800-8 13-8 13s-8-7.200-8-13a8 8 0 018-8z" fill="#0C9F6E" />
      <circle cx="26" cy="13.500" r="3.200" fill="#fff" />
    </>
  ),
};

export const DUO_NAMES = Object.keys(ICON);

export default function DuoIcon({ name, className = "h-11 w-11" }: { name: string; className?: string }) {
  const g = ICON[name];
  if (!g) return null;
  return <svg viewBox="0 0 48 48" className={className} aria-hidden>{g}</svg>;
}
