import Link from "next/link";
import { korDate } from "@/lib/faq";
import { gradeOfSeries, type Upcoming } from "@/lib/qnetExam";

/**
 * 이 종목의 다가오는 시험 일정.
 *
 * 종목 API 와 일정 API 는 따로 논다. 종목 쪽에는 날짜가 없고, 일정 쪽에는
 * 종목이 없다. 둘을 등급으로 이어야 "내가 볼 자격증의 다음 접수일" 이
 * 나온다 — 그게 사람이 알고 싶은 것이다.
 *
 * 일정 API 가 다루지 않는 국가전문자격은 회차를 지어내지 않고, 어디서
 * 봐야 하는지만 알려 준다.
 */
export default function ExamRoundsFor({
  series,
  name,
  list,
}: {
  series: string;
  name: string;
  list: Upcoming[];
}) {
  const grade = gradeOfSeries(series);

  if (!grade)
    return (
      <section className="mt-10">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">시험 일정</h2>
        <div className="card mt-4 p-5">
          <p className="text-[14.5px] leading-relaxed text-ink2">
            {name}은 국가기술자격 통합 일정(기술사·기능장·기사·산업기사·기능사)에
            들어가지 않습니다. 시행기관이 따로 공고하니 아래에서 확인하세요.
          </p>
          <a href="https://www.q-net.or.kr" target="_blank" rel="noopener noreferrer"
             className="btn btn-ghost mt-4">큐넷에서 확인</a>
        </div>
      </section>
    );

  return (
    <section className="mt-10">
      <h2 className="sec-title text-[1.0625rem] font-extrabold">다음 시험 일정</h2>
      <p className="mt-3 text-[14px] leading-relaxed text-muted">
        {name}은 <b className="text-ink2">{grade}</b> 회차로 치릅니다. 같은 등급 종목이
        같은 날 함께 봅니다.
      </p>

      {list.length === 0 ? (
        <div className="card mt-4 p-5">
          <p className="text-[14.5px] leading-relaxed text-muted">
            다가오는 접수 일정이 아직 올라오지 않았습니다. 보통 시행 두세 달 전에
            공고됩니다.
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-2.5">
          {list.slice(0, 4).map((u) => (
            <li key={`${u.round.round}-${u.stage.label}`}
                className={`card p-4 ${u.state === "open" ? "border-brand/40 bg-brandSoft/40" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <b className="text-[14.5px] leading-snug">{u.round.round}</b>
                <span className={`badge ${u.state === "open" ? "badge-open" : "badge-soon"}`}>
                  {u.state === "open"
                    ? u.days === 0 ? "오늘 마감" : `마감 ${u.days}일 전`
                    : `${u.days}일 뒤 접수 시작`}
                </span>
              </div>
              <span className="mt-1.5 block text-[13.5px] text-muted">
                {u.stage.label} · <span className="num">{korDate(u.stage.from)} ~ {korDate(u.stage.to)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/license/schedule" className="btn btn-ghost">전체 시험 일정</Link>
        <a href="https://www.q-net.or.kr" target="_blank" rel="noopener noreferrer"
           className="btn btn-ghost">큐넷에서 원서 접수</a>
      </div>
    </section>
  );
}
