import Link from "next/link";
import { GRADE_SLUG, mergeUpcoming, type Upcoming } from "@/lib/qnetExam";

const dot = (iso: string) => iso.replaceAll("-", ".");

/**
 * 접수 마감이 가까운 순으로 세운 시험 일정.
 *
 * 자격증 화면에서 가장 먼저 봐야 할 것은 "무슨 종목이 있나"가 아니라
 * "언제까지 신청해야 하나"다. 놓치면 다음 회차까지 몇 달을 기다린다.
 */
export default function ExamDeadlines({
  items, limit = 6,
  title = "지금 신청할 수 있는 시험",
  intro = "접수 마감이 가까운 순입니다. 원서접수는 정해진 기간에만 열리고, 하루라도 지나면 다음 회차를 기다려야 합니다.",
}: { items: Upcoming[]; limit?: number; title?: string; intro?: string }) {
  if (!items.length) return null;
  // 날짜가 똑같은 접수 창은 한 장으로. 상시 기능사는 여러 회차가 실기
  // 접수를 같은 날 함께 열어서, 그대로 두면 같은 카드가 겹쳐 보인다.
  const list = mergeUpcoming(items).slice(0, limit);

  return (
    <section className="mt-8">
      <h2 className="sec-title text-[1.0625rem] font-extrabold">{title}</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{intro}</p>

      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {list.map((u) => {
          const open = u.state === "open";
          // 접수 중이면 마감까지, 아직이면 시작까지.
          const urgent = open && u.days <= 3;
          return (
            <li key={`${u.round.grade}|${u.stage.label}|${u.stage.from}`}>
              {/* 눌러도 아무 일이 없었다. 해당 등급 일정으로 보낸다. */}
              <Link
                href={`/license/schedule#${GRADE_SLUG[u.round.grade]}`}
                className={`card card-link block h-full p-4 ${urgent ? "border-alert" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`badge ${open ? (urgent ? "badge-closed" : "badge-open") : "badge-soon"}`}>
                    {open ? (u.days === 0 ? "오늘 마감" : `D-${u.days}`) : `${u.days}일 뒤 시작`}
                  </span>
                  <span className="badge badge-quiet">{u.round.grade}</span>
                  <span className="badge badge-quiet">{u.stage.label}</span>
                </div>
                <b className="mt-2 block text-[14.5px] leading-snug">
                  {u.rounds[0]}
                  {u.rounds.length > 1 && (
                    <span className="ml-1 font-normal text-muted">외 {u.rounds.length - 1}개 회차</span>
                  )}
                </b>
                <span className="num mt-1 block text-[13px] text-muted">
                  접수 {dot(u.stage.from)} ~ {dot(u.stage.to)}
                </span>
                {u.round.docExam && u.stage.label.startsWith("필기") && (
                  <span className="num mt-0.5 block text-xs text-faint">
                    시험 {dot(u.round.docExam)}
                    {u.round.docPass ? ` · 발표 ${dot(u.round.docPass)}` : ""}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        한국산업인력공단 공개 자료입니다. 종목마다 일정이 다를 수 있으니 신청 전에{" "}
        <a href="https://www.q-net.or.kr" target="_blank" rel="noopener noreferrer"
           className="underline underline-offset-4 hover:text-brand">큐넷</a>
        에서 한 번 더 확인하세요.
      </p>

      <div className="mt-4">
        <Link href="/license/schedule" className="btn btn-ghost px-5 py-2.5">전체 일정 보기</Link>
      </div>
    </section>
  );
}
