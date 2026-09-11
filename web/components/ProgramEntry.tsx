import Link from "next/link";
import {
  ageLabel,
  applyStatus,
  daysLeft,
  STATUS_LABEL,
  type Program,
} from "@/lib/db";

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

const STATUS_CLASS = {
  closed:   "badge-closed",
  upcoming: "badge-soon",
  ongoing:  "badge-open",
  always:   "badge-open",
} as const;

export function Badges({ p }: { p: Program & { first_seen_at?: string } }) {
  const status = applyStatus(p);
  const left = daysLeft(p);
  const out: React.ReactNode[] = [
    // 접수 상태를 맨 앞에. 마감된 공고를 모르고 눌러보는 일이 없게 한다.
    <span key="s" className={`badge ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>,
  ];
  // 진행 중이면서 2주 안에 끝나는 것만 남은 날짜를 덧붙인다.
  if (status === "ongoing" && left !== null && left >= 0 && left <= 14)
    out.push(
      <span key="d" className="badge badge-due num">
        {left === 0 ? "오늘 마감" : `D-${left}`}
      </span>
    );
  return <>{out}</>;
}

/**
 * 접수 기간 중 얼마나 지났는지. 시작일과 마감일이 다 있을 때만 그린다.
 * 마감이 가까울수록 막대 끝이 흙색으로 물든다.
 */
function DueBar({ p }: { p: Program }) {
  if (!p.apply_start || !p.apply_end || p.is_always_on) return null;
  const s = new Date(p.apply_start + "T00:00:00+09:00").getTime();
  const e = new Date(p.apply_end + "T23:59:59+09:00").getTime();
  if (!(e > s)) return null;
  const k = Math.min(1, Math.max(0, (Date.now() - s) / (e - s)));
  if (k <= 0 || k >= 1) return null;
  return (
    <div className="mt-3 flex items-center gap-2" title="접수 기간 진행">
      <div className="due flex-1"><i style={{ width: `${Math.round(k * 100)}%` }} /></div>
      <span className="num text-[11px] text-muted">~{p.apply_end.slice(5).replace("-", ".")}</span>
    </div>
  );
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

      <DueBar p={p} />

      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
        {p.income_pct && <span className="num">중위소득 {p.income_pct}%↓</span>}
        {p.household?.map((h) => <span key={h}>{h}</span>)}
        {p.biz_target?.map((t) => <span key={t}>{t}</span>)}
        {p.biz_field?.map((f) => <span key={f}>{f}</span>)}
        {p.support_type && p.support_type !== "기타" && <span>{p.support_type}</span>}
      </div>
      <span className="go text-xs font-bold text-brand" aria-hidden>자세히 →</span>
    </Link>
  );
}
