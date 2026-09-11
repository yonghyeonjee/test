import { SITE_NAME } from "@/lib/seo";
import { ShareBar } from "./Infographic";
import { CountUp } from "./Motion";

/**
 * 맨 아래 통계 띠. "이 사이트에 무엇이 얼마나 있나"를 숫자로.
 * 숫자는 화면이 넘겨 준다 — 여기서 세지 않는다.
 */
export default function StatsBand({ welfare, business, items }: {
  welfare: number;
  business: number;
  items: { n: number | string; label: string }[];
}) {
  const total = welfare + business;
  return (
    <section className="stats-band -mx-5 mt-16 px-6 py-10 text-white sm:mx-0 sm:rounded-card sm:px-10">
      <div className="grid gap-8 md:grid-cols-[1fr_1fr]">
        <div>
          <p className="eyebrow !text-[#8FCFB0]">숫자로 보는 {SITE_NAME}</p>
          <p className="display mt-3 text-[1.6rem] leading-tight">
            지금 <b className="text-[#8FCFB0]"><CountUp value={total} /></b>건의
            <br />정책·지원 정보를 안내합니다
          </p>
          <div className="mt-6">
            <ShareBar a={welfare} b={business} labelA="개인·가구 복지" labelB="기업·소상공인" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            <div key={it.label} className="rounded-card border border-white/15 px-3 py-4 text-center">
              <b className="num display block text-[1.6rem] font-black">
                {typeof it.n === "number" ? <CountUp value={it.n} /> : it.n}
              </b>
              <span className="mt-0.5 block text-[11.5px] text-white/70">{it.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
