import Link from "next/link";
import { TOPICS } from "@/lib/topics";
import TopicIcon from "./TopicIcon";

/** 홈의 분야 격자. 정책 앱의 카테고리 자리. 건수는 화면이 넘겨 준다. */
export default function TopicGrid({ counts, limit = 8 }: { counts: Record<string, number>; limit?: number }) {
  const list = TOPICS.slice(0, limit);
  return (
    <section id="topics" className="mt-12">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="sec-title text-[1.0625rem] font-extrabold">분야별로 찾기</h2>
          <p className="mt-1 text-[13px] text-muted">무엇이 필요한지로 고릅니다. 주거·일자리·건강처럼.</p>
        </div>
        <Link href="/topic" className="shrink-0 rounded-pill border border-line2 px-3 py-1 text-[12px] font-semibold text-muted hover:border-brand hover:text-brand">
          전체 분야 +
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {list.map((t) => (
          <Link key={t.slug} href={`/topic/${t.slug}`}
                className="group flex flex-col items-center gap-1.5 rounded-card px-1 py-3 text-center transition hover:bg-surface hover:shadow-lift">
            <TopicIcon slug={t.slug} color={t.color} soft={t.soft} />
            <span className="text-[12.5px] font-bold text-ink2 group-hover:text-brand">{t.name}</span>
            {counts[t.key] !== undefined && (
              <span className="num text-[10.5px] text-faint">{counts[t.key].toLocaleString()}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
