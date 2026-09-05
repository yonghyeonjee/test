import Link from "next/link";
import { daysLeft, type Program } from "@/lib/db";

/** 나이 조건을 5~95 축 위의 막대로 그린다. 내 나이 위치에 표식. */
function AgeBar({
  min,
  max,
  me,
}: {
  min: number | null;
  max: number | null;
  me?: number;
}) {
  const LO = 5;
  const HI = 95;
  const pos = (v: number) => ((Math.min(Math.max(v, LO), HI) - LO) / (HI - LO)) * 100;

  const from = pos(min ?? LO);
  const to = pos(max ?? HI);

  return (
    <div className="mt-2.5 flex items-center gap-2.5">
      <div className="relative h-[3px] w-32 rounded-full bg-rule">
        <div
          className="absolute h-full rounded-full bg-grant"
          style={{ left: `${from}%`, width: `${Math.max(to - from, 2)}%` }}
        />
        {me !== undefined && (
          <div
            className="absolute -top-[3px] h-[9px] w-[2px] bg-ink"
            style={{ left: `${pos(me)}%` }}
            aria-hidden
          />
        )}
      </div>
      <span className="num text-xs text-muted">
        {min !== null && max !== null
          ? `${min}~${max}세`
          : min !== null
            ? `${min}세 이상`
            : max !== null
              ? `${max}세 이하`
              : "나이 제한 없음"}
      </span>
    </div>
  );
}

export default function ProgramEntry({
  p,
  myAge,
}: {
  p: Program;
  myAge?: number;
}) {
  const left = daysLeft(p);
  const urgent = left !== null && left <= 14;
  const place = [p.sigungu, p.sido].filter(Boolean)[0] ?? "전국";

  return (
    <article className="entry">
      <div className="flex items-baseline gap-2 text-xs text-muted">
        <span className="font-bold text-ink">{place}</span>
        {p.org_name && <span className="truncate">{p.org_name}</span>}
      </div>

      <h3 className="mt-1 text-[1.0625rem] font-bold leading-snug">
        <Link
          href={`/p/${encodeURIComponent(p.source_id)}`}
          className="underline decoration-rule decoration-2 underline-offset-4
                     hover:decoration-ink"
        >
          {p.title}
        </Link>
      </h3>

      {p.summary && (
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">
          {p.summary}
        </p>
      )}

      {(p.age_min !== null || p.age_max !== null) && (
        <AgeBar min={p.age_min} max={p.age_max} me={myAge} />
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {p.income_pct && (
          <span className="num text-muted">
            중위소득 {p.income_pct}% 이하
          </span>
        )}
        {p.household?.map((h) => (
          <span key={h} className="text-muted">
            {h}
          </span>
        ))}
        {p.biz_target?.map((t) => (
          <span key={t} className="text-muted">
            {t}
          </span>
        ))}
        {p.biz_field?.map((f) => (
          <span key={f} className="text-muted">
            {f}
          </span>
        ))}
        {p.support_type && p.support_type !== "기타" && (
          <span className="text-muted">{p.support_type}</span>
        )}
        {urgent && (
          <span className="num font-bold text-due">
            {left === 0 ? "오늘 마감" : `마감 ${left}일 전`}
          </span>
        )}
      </div>
    </article>
  );
}
