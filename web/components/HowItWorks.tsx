import Link from "next/link";
import PortalIcon from "./PortalIcon";
import { CountUp, StepStory } from "./Motion";

/**
 * "이렇게 찾습니다" 세 걸음. 숨고의 이용 방법(요청서 → 견적 비교 → 고수 선택) 자리.
 * 처음 온 사람이 "여기서 뭘 하는 데냐"를 10초 안에 알게 한다. 숫자는 그날 것.
 */
export default function HowItWorks({ total, closing, areas, className = "" }: {
  total: number; closing: number; areas: number; className?: string;
}) {
  const steps = [
    { n: 1, icon: "find", title: "사는 곳·나이를 고릅니다", sub: "회원가입 없이 네 번만 누르면 됩니다. 주민등록번호도 받지 않습니다." },
    { n: 2, icon: "check", title: "맞는 사업만 남습니다", sub: "지역·나이·상태로 걸러 마감일 순으로 보여 줍니다. 저장해 두고 다시 볼 수 있습니다." },
    { n: 3, icon: "agency", title: "원문에서 바로 신청합니다", sub: "모든 공고에 기관 원문 링크가 있습니다. 신청은 기관 쪽에서 합니다." },
  ] as const;
  const nums = [
    { k: "모은 공고", v: total },
    { k: "2주 안 마감", v: closing },
    { k: "시·군·구", v: areas },
  ].filter((x) => x.v > 0);

  // 2026-11-25 스크롤 이야기로. 왼쪽 제목·숫자는 붙어 있고(sticky), 오른쪽 세 걸음은 내려가는 만큼 선이 차오르며 하나씩 켜진다.
  return (
    <section className={`card overflow-hidden p-5 sm:p-7 ${className}`} aria-label="이렇게 찾습니다">
      <StepStory className="grid gap-6 sm:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] sm:gap-8">
        <div className="sm:sticky sm:top-36 sm:self-start">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2 className="mt-1.5 text-[1.375rem] font-black leading-snug tracking-[-.03em] break-keep">
            네 번 누르면<br />받을 수 있는 것만 남습니다
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted break-keep">회원가입도, 주민등록번호도 없습니다. 고른 조건은 이 기기에만 남습니다.</p>
          {nums.length > 0 && (
            <dl className="mt-5 grid grid-cols-3 divide-x divide-line rounded-[14px] bg-ground py-3 text-center">
              {nums.map((x) => (
                <div key={x.k} className="px-2">
                  <dt className="text-[12px] font-semibold text-muted">{x.k}</dt>
                  <dd className="num mt-0.5 text-[18px] font-extrabold tracking-[-.02em] text-ink"><CountUp value={x.v} /><span className="ml-0.5 text-[12px] font-bold text-faint">{x.k === "시·군·구" ? "곳" : "건"}</span></dd>
                </div>
              ))}
            </dl>
          )}
          <Link href="/about" className="mt-4 inline-block text-[13px] font-semibold text-muted hover:text-ink">어떻게 모으는지 보기 ›</Link>
        </div>
        <ol className="step-line relative space-y-4 pl-14 sm:space-y-10 sm:py-4">
          {steps.map((s) => (
            <li key={s.n} data-step className="step relative">
              <span className="step-ic absolute -left-14 top-0 flex h-11 w-11 items-center justify-center rounded-[14px]">
                <PortalIcon name={s.icon} className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <span className="num text-[12px] font-extrabold tracking-[.08em] text-brand">STEP {s.n}</span>
              <b className="mt-0.5 block text-[16px] font-extrabold leading-snug sm:text-[17px]">{s.title}</b>
              <span className="mt-1 block text-[13.5px] leading-relaxed text-muted break-keep">{s.sub}</span>
            </li>
          ))}
        </ol>
      </StepStory>
    </section>
  );
}
