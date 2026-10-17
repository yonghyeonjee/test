import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 글 본문의 가벼운 표시. **굵게** 와 [글자](주소) 만 알아듣는다.
 *
 * 자료에서 만든 글(blog_posts)과 코드에 적힌 안내 글이 같은 표시를 쓴다.
 * HTML 은 받지 않는다 — 우리가 만든 글만 들어오지만, 그래도 글자는 글자로만.
 */
const LINK_CLS = "underline underline-offset-4 decoration-brand/40 hover:text-brand";

export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  // 안쪽 주소(/로 시작)는 빈칸이 있어도 받는다. 자료 글이 "[충청북도 옥천군](/jobs/org/충청북도 옥천군)"처럼
  // 기관 이름을 그대로 넣어 링크가 되지 않고 글자로 보였다(2026-10-17). 바깥 주소는 예전처럼 빈칸에서 끊는다.
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((\/[^)\n]+|[^)\s]+)\)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={i++}>{m[1]}</strong>);
    else {
      const href = m[3].startsWith("/") ? m[3].trim().replace(/ /g, "%20") : m[3];
      out.push(
        href.startsWith("/")
          ? <Link key={i++} href={href} className={LINK_CLS}>{m[2]}</Link>
          : <a key={i++} href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLS}>{m[2]}</a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Inline({ text }: { text: string }) {
  return <>{inline(text)}</>;
}
