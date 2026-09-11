import { SITE_NAME } from "@/lib/seo";

/**
 * 맨 아래 통계 띠. "이 사이트에 무엇이 얼마나 있나"를 숫자 넷으로.
 * 정책정보포털 하단의 그것을 본떴다. 숫자는 화면이 넘겨 준다 — 여기서 세지 않는다.
 */
export default function StatsBand({ total, items }: {
  total: number;
  items: { n: number | string; label: string }[];
}) {
  return (
    <section className="stats-band -mx-5 mt-16 px-6 py-9 text-white sm:mx-0 sm:rounded-card sm:px-9">
      <p className="text-center text-[15px] font-bold sm:text-[17px]">
        {SITE_NAME}은 총 <b className="num text-[#8FCFB0]">{total.toLocaleString()}</b>건의 정책·지원 정보를 안내합니다
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="rounded-card bg-white/10 px-3 py-4 text-center">
            <b className="num block text-[1.45rem] font-extrabold">
              {typeof it.n === "number" ? it.n.toLocaleString() : it.n}
            </b>
            <span className="mt-0.5 block text-[11.5px] text-white/70">{it.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
