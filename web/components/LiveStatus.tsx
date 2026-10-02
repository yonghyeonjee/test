"use client";

import { useEffect, useState } from "react";
import { STATUS_LABEL, applyStatus, daysLeft, type ApplyStatus } from "@/lib/consts";

/**
 * 공고 상세의 접수 상태(배지·마감까지 n일)를 보는 사람의 오늘 날짜로 다시 센다.
 *
 * 상세 쪽은 사흘에 한 번만 새로 그린다(캐시 저장을 줄이려고 — Vercel ISR Writes). 그러면 서버가 그린
 * "마감까지 3일"이 사흘 뒤에도 남는다. 서버 값으로 먼저 그리고, 화면에 붙은 뒤 오늘 기준으로 고친다.
 */
type Dates = { apply_start: string | null; apply_end: string | null; is_always_on: boolean | null };

const BADGE: Record<ApplyStatus, string> = {
  closed: "badge-closed", upcoming: "badge-soon", ongoing: "badge-open", always: "badge-open",
};

function useLive(d: Dates) {
  const p = { apply_start: d.apply_start, apply_end: d.apply_end, is_always_on: d.is_always_on ?? false };
  const [v, setV] = useState(() => ({ status: applyStatus(p), left: daysLeft(p) }));
  useEffect(() => {
    setV({ status: applyStatus(p), left: daysLeft(p) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.apply_start, d.apply_end, d.is_always_on]);
  return v;
}

export function StatusBadge(d: Dates) {
  const { status } = useLive(d);
  return <span className={`badge ${BADGE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function StatusNotice(d: Dates & { startLabel: string }) {
  const { status, left } = useLive(d);
  if (status === "closed") {
    return (
      <p className="mt-5 inline-block border-l-[3px] border-line2 pl-3 text-sm font-bold text-muted">
        접수가 끝난 공고입니다. 내년에 다시 열리는 사업일 수 있으니 원문에서
        확인하세요.
      </p>
    );
  }
  if (status === "upcoming" && d.apply_start) {
    return (
      <p className="num mt-5 inline-block border-l-[3px] border-gold pl-3 text-sm font-bold text-gold">
        {d.startLabel} 접수 시작 예정
      </p>
    );
  }
  if (status === "ongoing" && left !== null && left >= 0 && left <= 30) {
    return (
      <p className="num mt-5 inline-block border-l-[3px] border-accent pl-3 text-sm font-bold text-accent">
        {left === 0 ? "오늘 접수 마감" : `접수 마감까지 ${left}일`}
      </p>
    );
  }
  return null;
}
