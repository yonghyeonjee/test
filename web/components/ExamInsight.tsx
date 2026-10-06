import { korDate } from "@/lib/faq";
import {
  difficulty, estimateMonths, monthList, peopleText, upcomingEvents,
  type Difficulty, type ExamSite,
} from "@/lib/examInsight";
import { schedPageUrl } from "@/lib/qnetSite";

/**
 * 이 종목의 "언제 치르나" 와 "얼마나 어렵나".
 *
 * 공공데이터 API 의 등급별 회차(ExamRoundsFor)는 접수 마감일을 알려 주고, 이 칸은 큐넷 종목 안내에서
 * 읽어 둔 것으로 그 뒤를 잇는다 — 이 종목이 실제로 치르는 회차와 달, 지난 3년의 응시자·합격자.
 * 아직 읽어 둔 것이 없는 종목은 칸 자체를 내지 않는다(빈 칸을 보여 줄 이유가 없다).
 */
const LEVEL_BADGE: Record<Difficulty["level"], string> = {
  "쉬운 편": "badge-open", 보통: "badge-soon", "어려운 편": "badge-due", "매우 어려움": "badge-hot",
};

const shortDate = (iso: string) => korDate(iso).replace(/^\d{4}년 /, "");
const span = (a: string, b: string | null) => (b && b !== a ? `${shortDate(a)} ~ ${shortDate(b)}` : shortDate(a));

export default function ExamInsight({ name, code, site, title = "시험 시기와 난이도", today = new Date() }: {
  name: string; code: string; site: ExamSite; title?: string; today?: Date;
}) {
  const up = upcomingEvents(site.sched, today).slice(0, 4);
  const est = estimateMonths(site.sched, today);
  const diff = difficulty(site.stats);
  if (!up.length && !est && !diff) return null;

  const estText = est && (() => {
    const a = est.months.필기, b = est.months.실기;
    // 공인중개사처럼 1차·2차를 같은 날 치르면 "1차는 10월, 2차는 10월" 이 아니라 한 번에 말한다.
    const parts: string[] = a.length && b.length && a.join() === b.join()
      ? [`${est.names.필기}·${est.names.실기} 모두 ${monthList(a)}`]
      : [a.length ? `${est.names.필기}는 ${monthList(a)}` : "", b.length ? `${est.names.실기}는 ${monthList(b)}` : ""].filter(Boolean);
    const basis = est.years.length === 1 ? `${est.years[0]}년 일정` : `${est.years[0]}~${est.years.at(-1)}년 일정`;
    return `${parts.join(", ")}에 치르는 편입니다. ${basis}을 바탕으로 한 추정입니다.`;
  })();

  return (
    <section className="mt-10">
      <h2 className="sec-title text-[1.0625rem] font-extrabold">{title}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(up.length > 0 || est) && (
          <div className="card p-5">
            <b className="block text-[14px] font-bold text-muted">언제 치르나</b>
            {up.length > 0 ? (
              <ul className="mt-3 grid gap-2">
                {up.map((e) => (
                  <li key={`${e.label}-${e.stage}-${e.examStart}`} className="text-[14.5px] leading-snug">
                    <b>{e.year}년 {e.label}{/필기|실기|면접|차$/.test(e.label) ? "" : ` ${e.stage}`}</b>
                    <span className="num mt-0.5 block text-[13.5px] text-ink2">시험 {span(e.examStart, e.examEnd)}</span>
                    {e.regStart && <span className="num block text-[13px] text-muted">접수 {span(e.regStart, e.regEnd)}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[14.5px] leading-relaxed text-ink2">올해 남은 시험은 없습니다.</p>
            )}
            {estText && (
              <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
                {estText}
                {est?.next && !up.length && (
                  <> 다음 {est.names[est.next.stage]}는 <b className="text-ink2">{est.next.year}년 {est.next.month}월쯤</b>으로 예상합니다.</>
                )}
              </p>
            )}
          </div>
        )}

        {diff && (
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="text-[14px] font-bold text-muted">얼마나 어렵나</b>
              <span className={`badge ${LEVEL_BADGE[diff.level]}`}>{diff.level}</span>
            </div>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink2">
              최근 {diff.years.length}년({diff.years[0]}~{diff.years.at(-1)}) 합격률은
              {diff.rate.필기 !== null && <> 필기 <b className="num">{diff.rate.필기}%</b></>}
              {diff.rate.필기 !== null && diff.rate.실기 !== null && ","}
              {diff.rate.실기 !== null && <> 실기 <b className="num">{diff.rate.실기}%</b></>}
              입니다.
              {diff.applicantsPerYear !== null && <> 한 해 <b className="num">{peopleText(diff.applicantsPerYear)}</b> 접수합니다.</>}
            </p>
            <table className="num mt-3 w-full text-[13px]">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-1 font-medium">연도</th><th className="py-1 font-medium">단계</th>
                  <th className="py-1 text-right font-medium">응시</th><th className="py-1 text-right font-medium">합격</th><th className="py-1 text-right font-medium">합격률</th>
                </tr>
              </thead>
              <tbody>
                {diff.rows.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-1">{r.year}</td><td className="py-1">{r.stage}</td>
                    <td className="py-1 text-right">{(r.takers ?? 0).toLocaleString("ko-KR")}</td>
                    <td className="py-1 text-right">{(r.passers ?? 0).toLocaleString("ko-KR")}</td>
                    <td className="py-1 text-right">{r.pass_rate ?? "-"}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[12px] text-faint">
              등급은 합격률이 가장 낮은 단계({diff.by}) 기준입니다. 55% 이상 쉬운 편, 35% 이상 보통, 20% 이상 어려운 편.
            </p>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">
        출처: 큐넷 {name} 종목 안내(시험일정·수험자 동향).{" "}
        <a href={schedPageUrl(code)} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand">큐넷에서 보기</a>
      </p>
    </section>
  );
}
