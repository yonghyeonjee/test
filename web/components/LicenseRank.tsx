import Link from "next/link";
import { josa } from "@/lib/faq";
import type { LicenseRank as Rank } from "@/lib/licenseRank";

/**
 * "같은 등급 종목과 견주면"(2026-11-27, lib/licenseRank). 그 등급에서 몇 번째로 많이 보는 시험인지,
 * 다른 종목보다 붙기 쉬운 편인지. 견줄 자료가 없으면 칸을 내지 않는다.
 */
export default function LicenseRank({ name, data }: { name: string; data: Rank | null }) {
  if (!data) return null;
  const { series, n, rank, applicants, rate, median, rateRank, rateN, top } = data;
  const gap = rate !== null && median !== null ? Math.round((rate - median) * 10) / 10 : null;
  return (
    <section className="mt-10" aria-labelledby="license-rank-h">
      <h2 id="license-rank-h" className="sec-title text-[1.0625rem] font-extrabold">같은 {series} 종목과 견주면</h2>
      <div className="card mt-4 p-5">
        <ul className="space-y-2 text-[14.5px] leading-[1.75] text-ink2">
          <li>
            {josa(name, "은는")} 통계가 있는 {series} <b className="num">{n}</b>종목 가운데 접수자가{" "}
            <b className="num">{rank}번째</b>로 많습니다. 최근 세 해 접수자는 <b className="num">{applicants.toLocaleString("ko-KR")}명</b>입니다.
          </li>
          {rate !== null && median !== null && rateRank !== null && (
            <li>
              가장 낮은 단계의 합격률은 <b className="num">{rate}%</b>로, {series} 종목의 가운데값 <b className="num">{median}%</b>보다{" "}
              {gap === 0 ? "같은 수준입니다" : <><b className="num">{Math.abs(gap as number)}%p</b> {(gap as number) > 0 ? "높습니다" : "낮습니다"}</>}.
              합격률이 높은 순으로는 <b className="num">{rateN}</b>종목 가운데 <b className="num">{rateRank}번째</b>입니다.
            </li>
          )}
        </ul>
        {top.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13.5px] text-muted">
            <span>{series}에서 많이 보는 다른 종목</span>
            {top.map((t) => (
              <Link key={t.code} href={`/license/${encodeURIComponent(t.code)}`} className="chip">
                {t.name}<span className="num text-[12px] text-faint">{t.applicants.toLocaleString("ko-KR")}명</span>
              </Link>
            ))}
          </p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted">
          큐넷 수험자 동향의 최근 세 해를 K나라지원이 모아 센 것입니다. 접수자는 필기·실기를 더한 수이고, 합격률은 단계별 합격자÷응시자 가운데 낮은 쪽입니다.
          응시자가 30명이 안 되는 종목은 합격률 순위에서 뺐습니다.
        </p>
      </div>
    </section>
  );
}
