import Link from "next/link";

/**
 * 안내 글 안에서 조회 화면으로 넘기는 단추 묶음.
 *
 * "학자금 이자지원" 글을 읽는 사람이 원하는 것은 결국 "우리 시에도 있나"
 * 다. 글에서 낱말(q)을 미리 걸어 두고 시·도만 고르게 하면 한 번에 간다.
 */
export default function FindByCondition({
  q, title, sub, sidos, tab = "welfare", via,
}: {
  q: string; title: string; sub: string; sidos: string[];
  tab?: "welfare" | "business"; via: string;
}) {
  const base = (sido?: string) => {
    const sp = new URLSearchParams();
    if (tab === "business") sp.set("tab", "business");
    if (sido) sp.set("sido", sido);
    sp.set("q", q);
    sp.set("via", via);
    return `/?${sp}`;
  };
  return (
    <section className="mt-10 rounded-card border-l-[3px] border-brand bg-brandSoft/40 px-5 py-5">
      <h2 className="text-[1.0625rem] font-extrabold">{title}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink2">{sub}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Link href={base()} className="chip chip-on">전국</Link>
        {sidos.map((s) => (
          <Link key={s} href={base(s)} className="chip">{s.replace(/(특별자치도|특별자치시|광역시|특별시|통합특별시)$/, "")}</Link>
        ))}
      </div>
    </section>
  );
}
