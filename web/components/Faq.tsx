import type { QA } from "@/lib/faq";

/**
 * 자주 묻는 질문. 접힌 목록으로 두고, 검색엔진에는 FAQPage 로 알린다.
 * 스크립트 없이 <details> 로만 열고 닫힌다.
 */
export default function Faq({ items, title = "자주 묻는 질문" }: { items: QA[]; title?: string }) {
  if (!items.length) return null;
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: { "@type": "Answer", text: x.a },
    })),
  };
  return (
    <section className="mt-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h2 className="sec-title text-[1.0625rem] font-extrabold">{title}</h2>
      <div className="rows mt-4 rounded-card border border-line bg-surface px-5">
        {items.map((x) => (
          <details key={x.q} className="faq group py-1">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-[15px] font-bold">
              <span>{x.q}</span>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                   fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <p className="pb-4 text-[14.5px] leading-[1.8] text-ink2">{x.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
