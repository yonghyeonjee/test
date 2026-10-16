import Link from "next/link";
import PortalIcon from "./PortalIcon";
import { CountUp } from "./Motion";

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

  return (
    <section className={`card p-4 sm:p-5 ${className}`} aria-label="이렇게 찾습니다">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[1.0625rem] font-extrabold tracking-[-.02em]">이렇게 찾습니다</h2>
        <Link href="/about" className="text-[12.5px] font-semibold text-muted hover:text-ink">소개 ›</Link>
      </div>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-3 sm:flex-col sm:gap-2">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brandSoft text-brand">
              <PortalIcon name={s.icon} className="h-5 w-5" strokeWidth={2.2} />
              <span className="num absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-extrabold text-white">{s.n}</span>
            </span>
            <span className="min-w-0">
              <b className="block text-[15px] font-extrabold leading-snug">{s.title}</b>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{s.sub}</span>
            </span>
          </li>
        ))}
      </ol>
      {nums.length > 0 && (
        <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-[12px] bg-ground py-3 text-center">
          {nums.map((x) => (
            <div key={x.k} className="px-2">
              <dt className="text-[12px] font-semibold text-muted">{x.k}</dt>
              <dd className="num mt-0.5 text-[18px] font-extrabold tracking-[-.02em] text-ink"><CountUp value={x.v} /><span className="ml-0.5 text-[12px] font-bold text-faint">{x.k === "시·군·구" ? "곳" : "건"}</span></dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
