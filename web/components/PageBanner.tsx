import type { ReactNode } from "react";

/**
 * 새로 만든 자료 화면의 머리 띠.
 *
 * 히어로와 같은 초록 그라데이션을 쓰되 높이를 반으로 줄였다. 여기는
 * 첫 화면이 아니라 이미 들어온 사람이 보는 곳이라, 화면을 다 먹으면
 * 정작 아래 표가 안 보인다.
 */
export default function PageBanner({
  eyebrow,
  title,
  sub,
  art,
  children,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  art: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="hero -mx-5 mt-2 rounded-none px-5 py-8 sm:mx-0 sm:rounded-card sm:px-8">
      <div className="flex items-center gap-5">
        <div className="min-w-0 flex-1">
          <span className="inline-flex rounded-pill bg-white/15 px-3 py-1 text-[11.5px]
                           font-bold tracking-wide text-white/90">
            {eyebrow}
          </span>
          <h1 className="mt-3 text-[1.6rem] font-extrabold leading-tight text-white">
            {title}
          </h1>
          <p className="mt-2.5 max-w-[30rem] text-[14.5px] leading-relaxed text-white/75">
            {sub}
          </p>
        </div>
        {/* 좁은 화면에서는 그림을 접는다. 글이 먼저다. */}
        <div className="hidden h-24 w-36 shrink-0 sm:block">{art}</div>
      </div>
      {children}
    </section>
  );
}
