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
          <Link key={it.href} href={it.href} className="card card-link group flex items-start gap-4 p-5">
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] leading-snug group-hover:text-brand">{it.title}</b>
              <span className="mt-1.5 block text-sm leading-relaxed text-muted">
                {it.desc}
              </span>
            </span>
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brandSoft text-brand transition-transform group-hover:translate-x-0.5" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
