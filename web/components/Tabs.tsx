import Link from "next/link";

export default function Tabs({
  active,
  counts,
  compact = false,
}: {
  active: "welfare" | "business";
  counts: { welfare: number; business: number };
  /** 카드 안에 넣을 때. 위아래 여백을 줄인다. */
  compact?: boolean;
}) {
  const items = [
    { key: "welfare", label: "개인 복지", href: "/", n: counts.welfare },
    {
      key: "business",
      label: "기업 지원사업",
      href: "/business",
      n: counts.business,
    },
  ] as const;

  return (
    <nav className={`flex gap-6 border-b border-line ${compact ? "mb-5" : "mb-9 mt-5"}`}>
      {items.map((it) => {
        const on = it.key === active;
        return (
          <Link
            key={it.key}
            href={it.href}
            className={`flex-1 rounded-pill py-2.5 text-center text-sm
              transition-colors ${
                on ? "bg-brand font-bold text-white" : "text-muted hover:text-brand"
              }`}
          >
            {it.label}
            <span className={`num ml-1.5 text-xs font-normal ${on ? "text-white/70" : "text-faint"}`}>
              {it.n.toLocaleString()}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
