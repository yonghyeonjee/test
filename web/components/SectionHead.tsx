import Link from "next/link";

/**
 * 구역 제목. 정책정보포털처럼 왼쪽에 굵은 표식을 두고, 오른쪽에 "더보기".
 * 홈처럼 구역이 여럿 늘어서는 화면에서 어디서 어디까지가 한 덩어리인지
 * 눈으로 바로 갈리게 하려는 것이다.
 */
export default function SectionHead({
  title, sub, more, moreLabel = "더보기", as: Tag = "h2",
}: {
  title: string;
  sub?: string;
  more?: string;
  moreLabel?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <Tag className="sec-title text-[1.0625rem] font-extrabold tracking-[-.01em]">{title}</Tag>
        {sub && <p className="mt-1 text-[13px] leading-snug text-muted">{sub}</p>}
      </div>
      {more && (
        <Link href={more}
              className="shrink-0 rounded-pill border border-line2 px-3 py-1 text-[12px]
                         font-semibold text-muted transition-colors hover:border-brand hover:text-brand">
          {moreLabel} +
        </Link>
      )}
    </div>
  );
}
