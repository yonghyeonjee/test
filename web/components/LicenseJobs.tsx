import Link from "next/link";

import { josa } from "@/lib/faq";
import type { LicenseJobs as Data } from "@/lib/licenseJobs";

/**
 * "이 자격증을 찾는 공공기관 채용"(2026-11-06). 나라일터 공고 요약에서 응시 자격·우대 사항에 종목 이름이
 * 들어간 공고를 센 것. 3건 미만이면 그리지 않는다(숫자가 작으면 오해만 산다).
 */
const dot = (v: string | null) => (v ? v.slice(5).replace("-", ".") : "");
const ym = (v: string) => `${v.slice(0, 4)}년 ${Number(v.slice(5, 7))}월`;

export default function LicenseJobs({ name, data }: { name: string; data: Data | null }) {
  if (!data || data.total < 3) return null;
  return (
    <section className="mt-10" aria-labelledby="lic-jobs-h">
      <h2 id="lic-jobs-h" className="sec-title text-[1.0625rem] font-extrabold">{josa(name, "을를")} 찾는 공공기관 채용</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-ink2">
        이 사이트가 공고문을 읽어 요약한 나라일터 채용 공고{data.since ? `(${ym(data.since)} 이후 등록)` : ""} 가운데{" "}
        <b className="num text-ink">{data.total.toLocaleString("ko-KR")}건</b>이 응시 자격이나 우대 사항에 {josa(name, "을를")} 적었습니다.
        {data.openN > 0
          ? <> 그중 <b className="num text-ink">{data.openN.toLocaleString("ko-KR")}건</b>이 지금 접수 중입니다.</>
          : " 지금 접수 중인 공고는 없습니다."}
      </p>
      {data.open.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
          {data.open.map((j) => (
            <li key={j.id} className="flex items-baseline gap-3 px-4 py-3">
              <Link href={`/jobs/${encodeURIComponent(j.id)}`} className="min-w-0 flex-1 truncate text-[14.5px] font-semibold hover:text-brand">
                {j.title}
              </Link>
              <span className="shrink-0 text-[12.5px] text-muted">{j.org ? `${j.org} · ` : ""}{dot(j.end)} 마감</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[12.5px] text-faint">요약이 붙은 공고만 셉니다. 자격 요건은 원문 공고에서 다시 확인하세요.</p>
    </section>
  );
}
