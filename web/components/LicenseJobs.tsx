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
            // 휴대폰에서는 두 줄로 쌓는다(2026-11-16). 한 줄에 두었을 때 기관 이름이 길면("과학기술정보통신부 우정사업본부
            // 전남지방우정청 강진우체국") 줄지 않는 오른쪽 칸이 줄을 다 차지해 공고 제목이 0폭으로 사라지고 칸 밖으로 넘쳤다.
            // 넓은 화면에서도 기관 칸은 절반까지만 차지하고 넘치면 줄인다. 마감일은 늘 보이게 따로 둔다.
            <li key={j.id} className="px-4 py-3 sm:flex sm:items-baseline sm:gap-3">
              <Link href={`/jobs/${encodeURIComponent(j.id)}`} className="line-clamp-2 text-[14.5px] font-semibold hover:text-brand sm:line-clamp-none sm:block sm:min-w-0 sm:flex-1 sm:truncate">
                {j.title}
              </Link>
              <span className="mt-1 flex min-w-0 items-baseline gap-1 text-[12.5px] text-muted sm:mt-0 sm:max-w-[50%] sm:shrink-0">
                {j.org && <span className="min-w-0 truncate">{j.org}</span>}
                <span className="shrink-0">{j.org ? "· " : ""}{dot(j.end)} 마감</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[12.5px] text-faint">요약이 붙은 공고만 셉니다. 자격 요건은 원문 공고에서 다시 확인하세요.</p>
    </section>
  );
}
