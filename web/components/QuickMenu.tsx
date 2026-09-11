import Link from "next/link";
import { ArtAgency, ArtJeonse, ArtJobs, ArtLicense, ArtPolicy, ArtStudy } from "./Art";

/**
 * 첫 화면의 바로가기 줄. 정책정보포털의 아이콘 메뉴 자리다.
 * 찾기 카드 바로 아래에 두어, 검색을 안 할 사람도 어디로 갈지 보이게 한다.
 */
const ITEMS = [
  { href: "/policies", label: "전체 정책", Art: ArtPolicy },
  { href: "/jobs", label: "채용·취업", Art: ArtJobs },
  { href: "/license", label: "자격증", Art: ArtLicense },
  { href: "/money/jeonse", label: "전세 금리", Art: ArtJeonse },
  { href: "/money/student-loan", label: "학자금", Art: ArtStudy },
  { href: "/agency", label: "공공기관", Art: ArtAgency },
];

export default function QuickMenu() {
  return (
    <nav aria-label="바로가기"
         className="mt-3 grid grid-cols-3 gap-2 rounded-card bg-surface p-3 shadow-card ring-1
                    ring-inset ring-line/50 sm:grid-cols-6">
      {ITEMS.map((it) => (
        <Link key={it.href} href={it.href}
              className="group flex flex-col items-center gap-1.5 rounded-[12px] px-2 py-2.5
                         text-center transition-colors hover:bg-brandSoft">
          <span className="h-10 w-14"><it.Art /></span>
          <span className="text-[12.5px] font-bold text-ink2 group-hover:text-brand">{it.label}</span>
        </Link>
      ))}
    </nav>
  );
}
