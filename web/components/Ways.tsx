import Link from "next/link";
import PortalIcon from "./PortalIcon";

export type Way = {
  href: string;
  label: string;
  /** 한 줄 설명. 살아 있는 숫자를 넣는다. */
  sub: string;
  icon: string;
  /** 아이콘 칸 색. tailwind 클래스. */
  tone: string;
  /** 첫 칸(브랜드 색, 휴대폰에서 가로 전체). */
  first?: boolean;
};

/**
 * 사이트의 다섯 축(지원금·채용·시험·기업·지도) — 아이콘 바로가기 열 칸(PortalShortcuts)을 대신한다(2026-11-02).
 * 열 칸은 모두 같은 무게라 아무것도 눈에 띄지 않았다. 다섯 칸은 각각 한 줄 설명과 그날 숫자를 단다.
 * 나머지 입구(마감 달력·주거·생활금융·공공기관·읽을거리)는 머리 메뉴에 그대로 있다.
 */
export default function Ways({ items, className = "" }: { items: Way[]; className?: string }) {
  return (
    <nav aria-label="갈래" className={`grid grid-cols-2 gap-2.5 sm:grid-cols-5 ${className}`}>
      {items.map((w) => (
        <Link key={w.href} href={w.href}
              className={`group flex min-w-0 flex-col gap-1.5 rounded-card border p-3.5 transition-[transform,border-color] duration-150 hover:-translate-y-0.5
                          ${w.first ? "col-span-2 border-brand bg-brandSoft sm:col-span-1" : "border-line bg-surface hover:border-line2"}`}>
          <span className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${w.tone}`}>
            <PortalIcon name={w.icon} className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <b className="text-[15px] font-extrabold leading-snug tracking-[-.02em] text-ink">{w.label}</b>
          <span className="text-[12.5px] leading-snug text-muted">{w.sub}</span>
        </Link>
      ))}
    </nav>
  );
}
