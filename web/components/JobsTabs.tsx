import Link from "next/link";

const TABS = [
  { href: "/jobs", label: "공공기관 채용" },
  { href: "/jobs/overseas", label: "해외취업" },
  { href: "/jobs/majors", label: "학과별 취업률" },
];

/** 취업 묶음의 세 화면을 오가는 탭. */
export default function JobsTabs({ active }: { active: string }) {
  return (
    <nav className="mt-6 flex gap-2 border-b border-line">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
                t.href === active ? "border-brand text-brand" : "border-transparent text-muted hover:text-brand"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
