/**
 * 분야 아이콘. 색 있는 둥근 네모 위에 선 아이콘 하나. 정책 앱들의 카테고리
 * 격자를 본떴다. 분야마다 색이 달라 한눈에 갈린다.
 */
const PATHS: Record<string, string> = {
  housing: "M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6",
  jobs: "M3 8h18v12H3z M8 8V5h8v3 M3 13h18",
  education: "M2 9l10-5 10 5-10 5z M6 11v5c0 2 3 3 6 3s6-1 6-3v-5",
  health: "M12 21s-8-5-8-11a4 4 0 018-2 4 4 0 018 2c0 6-8 11-8 11z M9 11h6 M12 8v6",
  pregnancy: "M12 3a4 4 0 100 8 4 4 0 000-8z M6 21c0-4 3-7 6-7s6 3 6 7",
  living: "M4 6h16v4H4z M6 10v10h12V10 M10 14h4",
  care: "M8 21v-5a4 4 0 018 0v5 M12 12a4 4 0 100-8 4 4 0 000 8z M3 21h18",
  finance: "M3 7h18v10H3z M12 9a3 3 0 100 6 3 3 0 000-6z M6 12h.01M18 12h.01",
  safety: "M12 3l9 4v5c0 5-4 8-9 9-5-1-9-4-9-9V7z M12 8v5 M12 16h.01",
  mental: "M12 4a6 6 0 016 6c0 3-2 4-2 6H8c0-2-2-3-2-6a6 6 0 016-6z M10 20h4",
  childcare: "M12 8a3 3 0 100-6 3 3 0 000 6z M7 21v-6a5 5 0 0110 0v6",
  adoption: "M12 20s-7-4-7-9a4 4 0 017-2 4 4 0 017 2c0 5-7 9-7 9z",
  culture: "M4 8h16v10H4z M4 12h16 M9 8V5h6v3",
  energy: "M13 2L4 14h7l-1 8 9-12h-7z",
  legal: "M12 3v18 M5 8h14 M7 8l-3 6h6z M17 8l-3 6h6z",
};

export default function TopicIcon({ slug, color, soft, size = 44 }: {
  slug: string; color: string; soft: string; size?: number;
}) {
  return (
    <span className="inline-flex items-center justify-center rounded-[14px]"
          style={{ width: size, height: size, background: soft, color }}>
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none" stroke="currentColor"
           strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={PATHS[slug] ?? PATHS.finance} />
      </svg>
    </span>
  );
}
