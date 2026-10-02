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

  // 두 갈래를 고르는 마디 단추(세그먼트). 고른 쪽은 흰 칸이 떠오른다.
  return (
    <nav aria-label="갈래" className={`flex gap-1 rounded-[14px] bg-ground p-1 ${compact ? "mb-5" : "mb-8 mt-5"}`}>
      {items.map((it) => {
        const on = it.key === active;
        return (
          <Link
            key={it.key}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={`flex-1 rounded-[11px] py-2.5 text-center text-[14.5px] transition-colors ${
              on ? "bg-white font-extrabold text-ink shadow-[0_1px_3px_rgba(17,24,39,.12)]" : "font-semibold text-muted hover:text-ink"
            }`}
          >
            {it.label}
            <span className={`num ml-1.5 text-[12px] font-semibold ${on ? "text-brand" : "text-faint"}`}>
              {it.n.toLocaleString()}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
