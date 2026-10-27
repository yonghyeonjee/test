"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * 그리다 터졌을 때의 화면(2026-10-25). 이 파일이 없으면 Next 가 어느 사이트나 똑같은
 * "Application error: a client-side exception has occurred" 한 줄을 200 으로 낸다.
 *
 * 10/6·10/8·10/10 서버가 멎었을 때 구글봇이 그 한 줄을 받아 갔고, 같은 글이 뜬 다른 Next 사이트
 * (카지노·러시아 식당 쪽)와 한 묶음으로 보고 /jobs 의 "구글이 선택한 표준"을 그쪽으로 적었다 — 2026-09
 * Search Engine Journal 에 실린 사례와 같은 모양이다. 그래서 이 화면은 (1) 이 사이트에만 있는 글로 쓰고
 * (2) noindex 를 머리에 꽂아 색인·중복 판정에서 빼고 (3) 사람에게는 다시 시도할 길을 준다.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // 응답은 이미 200 으로 나갔으니 상태 코드는 못 바꾼다. 렌더된 DOM 의 noindex 는 구글이 읽는다.
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex";
    document.head.appendChild(m);
    document.title = "잠시 뒤 다시 열어 주세요 | K나라지원";
    console.error("[K나라지원] 화면을 그리다 멈춤:", error?.digest ?? error?.message);
    return () => { m.remove(); };
  }, [error]);

  return (
    <div className="py-16">
      <p className="text-xs font-bold text-brand">K나라지원</p>
      <h1 className="mt-2 text-display font-extrabold">이 쪽을 그리다 멈췄습니다</h1>
      <p className="mt-4 leading-relaxed text-muted">
        지원사업·채용 자료를 읽어 오는 중에 서버가 잠시 답을 못 했습니다. 자료는 그대로 있으니 몇 초 뒤 다시
        열면 대개 보입니다. 계속 안 되면 첫 화면에서 다시 찾아 주세요.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">다시 열기</button>
        <Link href="/" className="btn btn-ghost">첫 화면으로</Link>
      </div>
      {error?.digest && <p className="mt-6 text-[11px] text-faint">오류 번호 {error.digest}</p>}
    </div>
  );
}
