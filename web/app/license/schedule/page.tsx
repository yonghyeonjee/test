import type { Metadata } from "next";
import Link from "next/link";
import { ArtLicense } from "@/components/Art";
import AdSlot from "@/components/AdSlot";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import PageBanner from "@/components/PageBanner";
import PromoBanner from "@/components/PromoBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { getLicenses, type License } from "@/lib/qnet";
import { EXAM_GRADES, applyWindows, daysUntil, getExamRounds, gradeOfSeries, splitRounds, windowState, type ExamRound } from "@/lib/qnetExam";
import { licenseRelated } from "@/lib/related";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "국가기술자격 시험 일정 — 원서접수 마감일 한눈에",
  description:
    "기술사·기능장·기사·산업기사·기능사 시험의 원서접수 기간과 시험일, 합격자 발표일을 " +
    "마감이 가까운 순으로 정리했습니다. 접수는 정해진 기간에만 열립니다.",
  keywords: ["국가기술자격 시험일정", "기사 원서접수", "기능사 시험일정", "큐넷 접수기간", "자격증 시험일"],
  alternates: { canonical: "/license/schedule" },
};

const dot = (v: string | null) => (v ? v.replaceAll("-", ".") : "—");

/**
 * 회차 표 한 덩어리.
 *
 * 앞으로 올 것과 지난 것에 같은 표를 쓰되, 지난 것은 접어 둔다.
 */
function RoundTable({
  grade, list, today,
}: { grade: string; list: ExamRound[]; today: Date }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[38rem] border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b-2 border-line2 text-left text-[12.5px] text-muted">
            <th className="py-2 pr-3 font-semibold">회차</th>
            <th className="py-2 pr-3 font-semibold">필기 접수</th>
            <th className="py-2 pr-3 font-semibold">필기시험</th>
            <th className="py-2 pr-3 font-semibold">
              {grade === "기술사" ? "면접 접수" : "실기 접수"}
            </th>
            <th className="py-2 font-semibold">합격 발표</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            // 지금 열려 있는 접수 창이 있으면 그 줄을 눈에 띄게.
            const open = applyWindows(r).some((w) => windowState(w, today) === "open");
            return (
              <tr key={r.id} className={`border-b border-line ${open ? "bg-brandSoft/40" : ""}`}>
                <td className="py-2.5 pr-3 font-semibold">
                  {r.round}
                  {open && <span className="badge badge-open ml-1.5">접수 중</span>}
                </td>
                <td className="num py-2.5 pr-3">{dot(r.docRegStart)} ~ {dot(r.docRegEnd)}</td>
                <td className="num py-2.5 pr-3">{dot(r.docExam)}</td>
                <td className="num py-2.5 pr-3">{dot(r.pracRegStart)} ~ {dot(r.pracRegEnd)}</td>
                <td className="num py-2.5">{dot(r.pracPass)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function ExamSchedule() {
  const [rounds, licenses] = await Promise.all([
    getExamRounds(),
    // 회차만 늘어놓으면 "2026년 상시 기능사 20회" 가 무슨 시험인지 알 수
    // 없다. 등급마다 어떤 종목이 딸려 있는지 함께 보여 준다.
    getLicenses().then((b) => b.all).catch(() => [] as License[]),
  ]);
  const today = new Date();

  /** 등급별 종목. 두 API 를 잇는 자리다. */
  const byGrade = new Map<string, License[]>();
  for (const l of licenses) {
    const g = gradeOfSeries(l.series);
    if (!g) continue;
    const cur = byGrade.get(g) ?? [];
    cur.push(l);
    byGrade.set(g, cur);
  }

  return (
    <div className="pb-4">
      <PageBanner
        eyebrow="자격증"
        title="언제까지 신청해야 하는지부터"
        sub="원서접수는 정해진 기간에만 열립니다. 하루라도 지나면 다음 회차를 기다려야 합니다."
        art={<ArtLicense />}
      />

      <nav aria-label="위치" className="mt-6 text-[13px] text-muted">
        <Link href="/license" className="hover:text-brand">자격증</Link>
        {" · "}
        <span className="text-ink2">시험 일정</span>
      </nav>

      {rounds.length === 0 ? (
        <div className="card mt-8 p-8 text-center">
          <p className="leading-relaxed text-muted">
            아직 시험 일정을 받아오지 못했습니다.
            <br />
            매일 오전 9시에 새로 받아 옵니다.
          </p>
          <a href="https://www.q-net.or.kr" target="_blank" rel="noopener noreferrer"
             className="btn btn-ghost mt-5">큐넷에서 직접 보기</a>
        </div>
      ) : (
        EXAM_GRADES.map((grade) => {
          const { upcoming, past, undated } = splitRounds(
            rounds.filter((r) => r.grade === grade),
            today,
          );
          if (!upcoming.length && !past.length && !undated.length) return null;
          const items = byGrade.get(grade) ?? [];
          return (
            <section key={grade} className="mt-12">
              <h2 className="sec-title text-[1.0625rem] font-extrabold">{grade}</h2>
              {items.length > 0 && (
                <div className="mt-3">
                  <p className="text-[13.5px] leading-relaxed text-muted">
                    이 일정으로 치르는 종목 <b className="num text-ink2">{items.length}개</b>.
                    아래 회차는 종목과 상관없이 같습니다.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1.5 text-[13px]">
                    {items.slice(0, 10).map((x) => (
                      <Link key={x.code} href={`/license/${encodeURIComponent(x.code)}`}
                            className="text-muted transition-colors hover:text-brand">
                        {x.name}
                      </Link>
                    ))}
                    {items.length > 10 && (
                      <Link href={`/license?series=${encodeURIComponent(items[0].series)}`}
                            className="font-semibold text-brand hover:underline">
                        +{items.length - 10}개 전체
                      </Link>
                    )}
                  </div>
                </div>
              )}
              {upcoming.length > 0 ? (
                <RoundTable grade={grade} list={upcoming} today={today} />
              ) : (
                <p className="mt-4 text-[14px] text-muted">
                  앞으로 남은 회차가 아직 올라오지 않았습니다. 보통 시행 두세 달 전에
                  공고됩니다.
                </p>
              )}

              {/* 지난 회차는 접어 둔다. 필요한 사람은 열어 보면 된다. */}
              {past.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer list-none text-[13.5px] font-semibold text-muted hover:text-brand">
                    지난 회차 {past.length}개 보기
                  </summary>
                  <RoundTable grade={grade} list={past} today={today} />
                </details>
              )}

              {undated.length > 0 && (
                <div className="mt-4 border-l-2 border-line2 pl-3">
                  <p className="text-[13px] leading-relaxed text-muted">
                    날짜가 아직 정해지지 않은 회차: {undated.map((r) => r.round).join(", ")}
                  </p>
                </div>
              )}
            </section>
          );
        })
      )}

      <AdSlot name="page_bottom" />

      <section className="mt-14">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">접수 전에 알아 둘 것</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            원서접수는 대개 열흘 안팎만 열립니다. 접수 첫날과 마지막 날 오전에 큐넷이 몰려
            느려지는 일이 잦으니, 마지막 날 저녁에 하려다 못 하는 경우가 실제로 나옵니다.
            접수 기간 중간에 해 두는 편이 안전합니다.
          </p>
          <p>
            필기에 붙으면 실기 접수는 따로 해야 합니다. 필기 합격자 발표 뒤에 실기 접수
            기간이 열리는데, 이걸 놓쳐서 필기 합격이 날아가는 일이 매 회차 있습니다.
            필기 합격은 보통 2년간 유효하지만, 그 안에 실기를 붙어야 합니다.
          </p>
          <p>
            응시 자격에 경력이나 학력이 걸리는 등급(기사·기능장·기술사)은 서류 제출 기간이
            따로 있습니다. 위 표의 필기 접수와는 다른 날짜이고, 증명서 발급에 며칠 걸리는
            것이 있으니 미리 떼어 두세요.
          </p>
        </div>
      </section>

      <Faq
        items={[
          {
            q: "여기 없는 종목의 일정은요?",
            a: "이 표는 등급별 공통 일정입니다. 종목에 따라 시행 회차가 다른 경우가 있어, 정확한 것은 큐넷의 종목별 시험일정에서 확인하셔야 합니다. 종목 상세 화면에도 링크를 두었습니다.",
          },
          {
            q: "접수 기간을 놓치면 어떻게 되나요?",
            a: "다음 회차를 기다려야 합니다. 추가 접수는 원칙적으로 없습니다. 기능사는 한 해 서너 번, 기사는 세 번 정도, 기술사는 등급에 따라 두세 번 열립니다.",
          },
          {
            q: "응시료는 얼마인가요?",
            a: "종목과 등급에 따라 다릅니다. 기능사 필기는 만 원대, 기사는 이만 원대에서 시작하고 실기는 그보다 비쌉니다. 국민내일배움카드나 지자체 자격증 응시료 지원 사업으로 돌려받을 수 있는 경우가 있으니 지원금 목록에서 사는 곳을 확인해 보세요.",
          },
        ]}
      />

      <GuideBanner />
      <PromoBanner placement="license-schedule" context="job" />
      <RelatedLinks items={licenseRelated()} />
    </div>
  );
}
