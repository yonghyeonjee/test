import Link from "next/link";
import { TOPICS } from "@/lib/topics";
import TopicIcon from "./TopicIcon";

/** 홈의 분야 격자. 정책 앱의 카테고리 자리. 건수는 화면이 넘겨 준다. */
export default function TopicGrid({ counts, limit = 8, className = "mt-12" }: {
  counts: Record<string, number>; limit?: number;
  /** 바깥 상자 클래스. 첫 화면은 카드("card p-4 sm:p-5")로 감싼다. */
  className?: string;
}) {
  const list = TOPICS.slice(0, limit);
  return (
    <section id="topics" className={className}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="sec-title text-[1.0625rem] font-extrabold">분야별로 찾기</h2>
          <p className="mt-1 text-[13px] text-muted">무엇이 필요한지로 고릅니다. 주거·일자리·건강처럼.</p>
        </div>
        <Link href="/topic" className="shrink-0 text-[12.5px] font-semibold text-muted hover:text-ink">
          전체 분야 ›
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {list.map((t) => (
          <Link key={t.slug} href={`/topic/${t.slug}`}
                className="group flex flex-col items-center gap-1.5 rounded-card px-1 py-2.5 text-center transition hover:bg-surface2">
            <TopicIcon slug={t.slug} color={t.color} soft={t.soft} />
            <span className="text-[12.5px] font-bold text-ink2 group-hover:text-ink">{t.name}</span>
            {counts[t.key] !== undefined && (
              <span className="num text-[12px] text-faint">{counts[t.key].toLocaleString()}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
