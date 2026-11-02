import Link from "next/link";

export type TodayTile = {
  /** 작은 이름("오늘 새 채용 공고"). */
  k: string;
  n: number;
  unit?: string;
  /** 숫자 밑 꼬리표("공공기관", "서두르세요"). */
  tag: string;
  /** 꼬리표 색. tailwind 클래스. */
  tone: string;
  href: string;
};

/**
 * "오늘의 숫자" 네 칸(2026-11-02). 회전 띠(HotBanner)와 오른쪽 중복 카드(HomeTopAd 의 브리핑) 자리를 대신한다.
 * 회전 띠는 읽기 전에 넘어갔고 LCP 를 늦췄다. 여기는 움직이지 않고, 칸마다 그 목록으로 간다.
 * 0건인 칸은 빼고, 남는 칸이 둘 미만이면 아무것도 그리지 않는다.
 */
export default function TodayNumbers({ tiles, note, className = "" }: { tiles: TodayTile[]; note?: string; className?: string }) {
  const shown = tiles.filter((t) => t.n > 0).slice(0, 4);
  if (shown.length < 2) return null;
  const cols = shown.length === 2 ? "sm:grid-cols-2" : shown.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4";
  return (
    <section className={className} aria-label="오늘의 숫자">
      <dl className={`grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line ${cols}`}>
        {shown.map((t) => (
          <Link key={t.k} href={t.href} className="group block min-w-0 bg-surface px-4 py-3.5 transition-colors hover:bg-surface2">
            <dt className="truncate text-[12.5px] text-muted">{t.k}</dt>
            <dd className="num mt-0.5 text-[24px] font-black leading-tight tracking-[-.03em] text-ink group-hover:text-brand">
              {t.n.toLocaleString("ko-KR")}<span className="ml-0.5 text-[13px] font-semibold text-muted">{t.unit ?? "건"}</span>
            </dd>
            <dd className="mt-1.5"><span className={`inline-block rounded-pill px-2 py-px text-[12px] font-bold ${t.tone}`}>{t.tag}</span></dd>
          </Link>
        ))}
      </dl>
      {note && <p className="mt-1.5 text-right text-[12px] text-faint">{note}</p>}
    </section>
  );
}
