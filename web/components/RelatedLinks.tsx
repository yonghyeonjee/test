import Link from "next/link";

export type Related = { href: string; title: string; desc: string };

/**
 * 사이트 안에서 다음에 볼 곳을 권한다.
 *
 * 바깥으로 나가는 링크(배너·원문)는 늘 이보다 아래에 둔다. 읽던 사람을
 * 먼저 사이트 밖으로 보내 놓고 내부 안내를 하면 아무도 보지 않는다.
 */
export default function RelatedLinks({
  title = "이어서 보면 좋은 곳",
  items,
}: {
  title?: string;
  items: Related[];
}) {
  if (!items.length) return null;
  return (
    <nav className="mt-16" aria-label={title}>
      <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
        {title}
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="card card-link block p-5">
            <b className="flex items-center gap-1 text-[15px] leading-snug">
              {it.title}
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 shrink-0 text-faint"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </b>
            <span className="mt-1.5 block text-sm leading-relaxed text-muted">
              {it.desc}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
