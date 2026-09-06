import Link from "next/link";

export default function Tabs({
  active,
  counts,
}: {
  active: "welfare" | "business";
  counts: { welfare: number; business: number };
}) {
  const items = [
    { key: "welfare", label: "개인 복지", href: "/", n: counts.welfare },
    {
      key: "business",
      label: "기업 지원사업",
      href: "/?tab=business",
      n: counts.business,
    },
  ] as const;

  return (
    <nav className="mb-9 flex gap-6 border-b border-line">
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
