import Link from "next/link";
import type { Area, Stat } from "@/lib/db";

function Bar({ n, max }: { n: number; max: number }) {
  return (
    <span className="ml-3 hidden h-1.5 flex-1 rounded-pill bg-line sm:block">
      <span
        className="block h-full rounded-pill bg-brand2/50"
        style={{ width: `${Math.max((n / max) * 100, 3)}%` }}
      />
    </span>
  );
}

function Table({
  title,
  note,
  rows,
}: {
  title: string;
  note?: string;
  rows: { label: string; n: number; href: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-bold">{title}</h3>
        {note && <span className="text-xs text-faint">{note}</span>}
      </div>
      <ul className="mt-3 space-y-0.5">
        {rows.map((r) => (
          <li key={r.label}>
            <Link
              href={r.href}
              className="group flex items-center rounded-[8px] px-2 py-2
                         text-sm transition-colors hover:bg-ground"
            >
              <span className="group-hover:text-brand">{r.label}</span>
              <Bar n={r.n} max={max} />
              <span className="num ml-3 w-10 shrink-0 text-right text-xs text-muted">
                {r.n.toLocaleString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const AGE_LINK: Record<string, number> = {
  "청소년 (~18세)": 16,
  "청년 (19~39세)": 28,
  "중장년 (40~64세)": 52,
  "어르신 (65세~)": 70,
};

export default function StatTables({
  areas,
  age,
  employment,
  household,
}: {
  areas: Area[];
  age: Stat[];
  employment: Stat[];
  household: Stat[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Table
        title="지역으로 찾기"
        note="시·도"
        rows={areas.slice(0, 8).map((a) => ({
          label: a.sido,
          n: a.n,
          href: `/area/${encodeURIComponent(a.sido)}`,
        }))}
      />
      <Table
        title="나이로 찾기"
        rows={age.map((a) => ({
          label: a.label,
          n: a.n,
          href: `/?age=${AGE_LINK[a.label] ?? 30}&via=chip`,
        }))}
      />
      <Table
        title="상황으로 찾기"
        note="가구"
        rows={household.slice(0, 6).map((h) => ({
          label: h.label,
          n: h.n,
          href: `/?hh=${encodeURIComponent(h.label)}&via=chip`,
        }))}
      />
      <Table
        title="일하는 상태로 찾기"
        rows={employment.map((e) => ({
          label: e.label,
          n: e.n,
          href: `/?emp=${encodeURIComponent(e.label)}&via=chip`,
        }))}
      />
    </div>
  );
}
