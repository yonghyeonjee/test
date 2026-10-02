/**
 * 작은 선 아이콘. 24×24, 현재 글자색을 따른다. 뜻은 옆 글이 지므로 aria-hidden.
 * 사람·서류 종류·안내 표식처럼 여러 화면이 같이 쓰는 것만 둔다.
 */
const PATH: Record<string, string> = {
  youth: "M12 11a4 4 0 100-8 4 4 0 000 8z M5 21v-1a7 7 0 0114 0v1 M18 5l2 2-2 2",
  senior: "M12 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M7 21v-5a5 5 0 0110 0v5 M16 13l3 8",
  lowincome: "M3 12l9-8 9 8 M6 11v9h12v-9 M9 20v-5h6v5",
  business: "M3 9l2-5h14l2 5 M3 9h18v3a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-6 0z M5 12v8h14v-8 M9 20v-5h6v5",
  pdf: "M6 3h8l4 4v14H6z M14 3v4h4 M8 17h2.5a1.5 1.5 0 000-3H8v5",
  hwp: "M6 3h8l4 4v14H6z M14 3v4h4 M8 19v-6M8 16h4M12 19v-6",
  doc: "M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6M9 16h6",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1 M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8z M5 21a7 7 0 0114 0",
  history: "M3 12a9 9 0 109-9 9 9 0 00-7 3.3 M3 4v4h4 M12 8v4l3 2",
  pin: "M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z M12 10h.01",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  spark: "M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z",
  check: "M5 12l5 5 9-10",
  book: "M4 5a2 2 0 012-2h5v16H6a2 2 0 00-2 2z M20 5a2 2 0 00-2-2h-5v16h5a2 2 0 012 2z",
  brain: "M12 4a6 6 0 016 6c0 3-2 4-2 6H8c0-2-2-3-2-6a6 6 0 016-6z M10 20h4",
  chart: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  calendar: "M4 6h16v14H4z M4 10h16 M8 3v4M16 3v4",
  mail: "M3 6h18v12H3z M3 7l9 6 9-6",
};

export default function Glyph({ name, className = "h-4 w-4", strokeWidth = 2 }: { name: keyof typeof PATH | string; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATH[name] ?? PATH.doc} />
    </svg>
  );
}

/** 파일 확장자에 맞는 아이콘 이름. */
export function fileGlyph(ext?: string): string {
  if (!ext) return "doc";
  if (ext === "pdf") return "pdf";
  if (ext === "hwp" || ext === "hwpx") return "hwp";
  return "doc";
}
