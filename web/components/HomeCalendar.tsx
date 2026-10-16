import Link from "next/link";
import { addDays, deadlineDays, examDays, todayKst } from "@/lib/calendar";
import { Box } from "./PortalHome";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

/** 첫 화면의 이레 마감 띠. 날짜를 누르면 마감 달력의 그날로 간다. */
export default async function HomeCalendar({ className = "" }: { className?: string }) {
  const today = todayKst();
  const to = addDays(today, 6);
  const [days, exams] = await Promise.all([deadlineDays(today, to), examDays(today, to)]);
  const cols = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    const n = days[d] ?? { p: 0, job: 0, exam: 0 };
    return { d, total: n.p + n.job + (exams[d]?.length ?? 0), wd: new Date(`${d}T00:00:00Z`).getUTCDay() };
  });
  const week = cols.reduce((a, c) => a + c.total, 0);
  return (
    <Box title="마감 달력" sub={`이레 안 ${week.toLocaleString("ko-KR")}건`} more="/calendar" moreLabel="달력 전체" className={className}>
      <ol className="grid grid-cols-7 gap-1">
        {cols.map((c, i) => (
          <li key={c.d}>
            <Link href={`/calendar?d=${c.d}`}
                  className={`flex flex-col items-center rounded-[10px] py-2 transition-colors hover:bg-ground ${i === 0 ? "bg-brandSoft" : ""}`}>
              <span className={`text-[11px] font-semibold ${c.wd === 0 ? "text-alert" : c.wd === 6 ? "text-cat-blue" : "text-faint"}`}>{i === 0 ? "오늘" : WD[c.wd]}</span>
              <span className={`num text-[15px] font-extrabold ${i === 0 ? "text-brand" : "text-ink"}`}>{Number(c.d.slice(8, 10))}</span>
              <span className="num mt-0.5 text-[11.5px] font-semibold text-muted">{c.total > 0 ? c.total : "·"}</span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[12px] text-faint">숫자는 그날 마감되는 지원사업·채용·시험 수. 달력에서 내 위치나 지역을 고르면 줄어듭니다.</p>
    </Box>
  );
}
