import Link from "next/link";
import { ageLabel, daysLeft, type Program } from "@/lib/db";

/** 나이 조건을 5~95 축 위의 막대로. 내 나이 위치에 표식. */
function AgeBar({ min, max, me }: { min: number | null; max: number | null; me?: number }) {
  const LO = 5, HI = 95;
  const pos = (v: number) => ((Math.min(Math.max(v, LO), HI) - LO) / (HI - LO)) * 100;
  const from = pos(min ?? LO), to = pos(max ?? HI);
  return (
    <div className="mt-3 flex items-center gap-2.5">
      <div className="relative h-[5px] w-28 rounded-pill bg-line">
        <div
          className="absolute h-full rounded-pill bg-brand/70"
          style={{ left: `${from}%`, width: `${Math.max(to - from, 2)}%` }}
        />
        {me !== undefined && (
          <div
            className="absolute -top-[3px] h-[11px] w-[2px] rounded bg-ink"
            style={{ left: `${pos(me)}%` }}
            aria-hidden
          />
        )}
      </div>
      <span className="num text-xs text-muted">
        {ageLabel({ age_min: min, age_max: max })?.replace("만 ", "") ?? "나이 제한 없음"}
      </span>
    </div>
  );
}

export function Badges({ p }: { p: Program & { first_seen_at?: string } }) {
  const left = daysLeft(p);
  const out: React.ReactNode[] = [];
  if (left !== null && left >= 0 && left <= 14)
    out.push(
      <span key="d" className="badge badge-due num">
        {left === 0 ? "오늘 마감" : `D-${left}`}
      </span>
    );
  return <>{out}</>;
}

export default function ProgramEntry({
  p,
  myAge,
  compact,
}: {
  p: Program;
  myAge?: number;
  compact?: boolean;
}) {
  const place = p.sigungu || p.sido || "전국";
  const href = `/p/${encodeURIComponent(p.source_id)}`;

  return (
    <Link href={href} className="card card-link block p-5">
      <div className="flex items-center gap-2">
        <span className="badge badge-quiet">{place}</span>
        <Badges p={p} />
        {p.org_name && (
          <span className="truncate text-xs text-muted">{p.org_name}</span>
        )}
      </div>

      <h3 className="mt-2.5 text-[1.0625rem] font-bold leading-snug">
        {p.title}
      </h3>

      {p.summary && !compact && (
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">
          {p.summary}
        </p>
      )}

      {(p.age_min !== null || p.age_max !== null) && !compact && (
        <AgeBar min={p.age_min} max={p.age_max} me={myAge} />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
        {p.income_pct && <span className="num">중위소득 {p.income_pct}%↓</span>}
        {p.household?.map((h) => <span key={h}>{h}</span>)}
        {p.biz_target?.map((t) => <span key={t}>{t}</span>)}
        {p.biz_field?.map((f) => <span key={f}>{f}</span>)}
        {p.support_type && p.support_type !== "기타" && <span>{p.support_type}</span>}
        {p.is_always_on && <span>상시</span>}
      </div>
    </Link>
  );
}
