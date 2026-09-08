"use client";

import { track } from "./Gtm";

/** 원문으로 나가는 버튼. 이 서비스의 실질적인 전환 지점이다. */
export default function ApplyLink({
  href,
  source,
  title,
  region,
}: {
  href: string;
  source: string;
  title: string;
  region: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        track("apply_click", { source, program: title, region })
      }
      className="btn btn-primary mt-10 w-full py-4 text-[0.95rem]"
    >
      원문에서 확인하고 신청하기
    </a>
  );
}
