import type { ReactNode } from "react";

/**
 * 자료 화면의 머리 띠. 히어로와 같은 먹초록에 명조 제목.
 * 여기는 이미 들어온 사람이 보는 곳이라 높이를 반으로 줄였다.
 */
export default function PageBanner({
  eyebrow, title, sub, art, children,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  art: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="hero -mx-5 mt-2 px-6 py-9 sm:mx-0 sm:rounded-card sm:px-10">
      <div className="flex items-center gap-6">
        <div className="min-w-0 flex-1">
          <p className="eyebrow !text-[#8FCFB0]">{eyebrow}</p>
          <h1 className="display mt-3 text-[1.7rem] leading-tight text-white sm:text-[2rem]">
            {title}
          </h1>
          <p className="mt-3 max-w-[32rem] text-[14.5px] leading-[1.8] text-[#B9D6C6]">
            {sub}
          </p>
        </div>
        {/* 좁은 화면에서는 그림을 접는다. 글이 먼저다. */}
        <div className="hidden h-28 w-40 shrink-0 opacity-90 sm:block">{art}</div>
      </div>
      {children}
    </section>
  );
}
