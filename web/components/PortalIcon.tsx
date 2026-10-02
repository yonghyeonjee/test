/**
 * 포털 아이콘(24×24 선). 바로가기·아래 탭 막대·전체 메뉴가 같이 쓴다.
 * 색은 글자색(currentColor)을 따르고, 뜻은 옆 글이 지므로 aria-hidden.
 */
const PATH: Record<string, string> = {
  find: "M4 6h16 M7 12h10 M10 18h4",
  map: "M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z M12 7.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z",
  biz: "M3 21h18 M5 21V8l7-4 7 4v13 M9 21v-5h6v5 M9 10h.01 M15 10h.01 M9 13h.01 M15 13h.01",
  jobs: "M3 8h18v12H3z M8 8V5.5A1.5 1.5 0 019.5 4h5A1.5 1.5 0 0116 5.5V8 M3 13h18",
  license: "M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.3l-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z",
  calendar: "M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4 M8 14h3",
  home: "M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6",
  money: "M3 7h18v10H3z M12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z M6.5 12h.01 M17.5 12h.01",
  agency: "M3 10l9-6 9 6 M5 10v9 M9.5 10v9 M14.5 10v9 M19 10v9 M3 21h18",
  read: "M4 5a2 2 0 012-2h5v16H6a2 2 0 00-2 2z M20 5a2 2 0 00-2-2h-5v16h5a2 2 0 012 2z",
  search: "M10.5 4a6.5 6.5 0 110 13 6.5 6.5 0 010-13z M15.5 15.5L20 20",
  menu: "M4 7h16 M4 12h16 M4 17h16",
  close: "M6 6l12 12 M18 6L6 18",
  top: "M12 19V5 M5 12l7-7 7 7",
  bell: "M6 16V11a6 6 0 1112 0v5l1.5 2h-15z M10 20a2 2 0 004 0",
  mail: "M3 6h18v12H3z M3 7l9 6 9-6",
  chat: "M4 5h16v11H9l-5 4z",
  chart: "M4 20V10 M10 20V4 M16 20v-7 M21 20H3",
  fire: "M12 3c1 3.5-1 5-2.5 6.5C8 11 7 12.5 7 14.5a5 5 0 0010 0c0-3-2-5-2.5-7-1.5 1-2 2.5-2.5 3 0-3 1-6 0-7.5z",
  check: "M5 12l5 5 9-10",
  chevron: "M9 6l6 6-6 6",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8z M5 21a7 7 0 0114 0",
};

export default function PortalIcon({ name, className = "h-5 w-5", strokeWidth = 1.9 }: {
  name: string; className?: string; strokeWidth?: number;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATH[name] ?? PATH.find} />
    </svg>
  );
}
