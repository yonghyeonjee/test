"use client";

import { useState } from "react";

// 이 탭에서 화면을 한 번이라도 그렸나. 서버에서는 늘 false(모듈 변수가 요청 사이에 남으므로 window 로 가른다).
let booted = false;

/**
 * 화면이 바뀔 때 살짝 떠오른다. 새 화면임을 알리는 정도로만, 240ms.
 *
 * 2026-10-22: 첫 로드에는 걸지 않는다. animation … both 는 첫 프레임부터 opacity 0 이라 본문 전체가 투명하게
 * 시작하고, 휴대폰은 스크립트로 바쁜 메인 스레드가 애니메이션을 시작할 때까지 글자가 안 보여 LCP 가 FCP 보다
 * 1~4초 늦었다(Lighthouse "그리기 지연 3,994ms", 실제 크롬 +860ms). 사이트 안 이동(두 번째 화면부터)에만 쓴다.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const [animate] = useState(() => {
    if (typeof window === "undefined") return false;
    const again = booted;
    booted = true;
    return again;
  });
  return <div className={animate ? "page-enter" : undefined}>{children}</div>;
}
