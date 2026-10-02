/**
 * 긴 글의 목차. 소제목마다 붙인 id 로 바로 간다.
 *
 * 검색엔진은 소제목과 목차 링크로 글의 짜임을 읽고, 사람은 긴 글에서
 * 찾는 부분으로 바로 내려간다. 글 머리 바로 아래에 둔다.
 */
export type TocItem = { id: string; label: string };

export default function Toc({ items, title = "목차" }: { items: TocItem[]; title?: string }) {
  if (items.length < 3) return null;
  return (
    <nav aria-label={title} className="mt-6 rounded-card border border-line bg-ground/60 px-5 py-4">
      <p className="text-[13px] font-bold text-muted">{title}</p>
      <ol className="mt-2 grid gap-x-6 gap-y-1 text-[14px] sm:grid-cols-2">
        {items.map((it, i) => (
          <li key={it.id} className="flex gap-2 leading-relaxed">
            <span className="num w-5 shrink-0 text-right text-[12px] text-faint">{i + 1}</span>
            <a href={`#${it.id}`} className="min-w-0 break-keep underline-offset-4 hover:text-brand hover:underline">{it.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
