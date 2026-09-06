"use client";

import { useEffect, useState } from "react";

export const BIG_KEY = "jw.big";

/**
 * 큰 화면 보기. 어르신이 브라우저 설정을 찾아 들어가지 않아도 되게
 * 화면 안에 둔다. 선택은 localStorage 에 남겨 다음 방문에도 유지한다.
 */
export default function BigText() {
  const [on, setOn] = useState(false);

  // 첫 페인트 전에는 layout 의 인라인 스크립트가 클래스를 붙인다.
  // 여기서는 그 결과를 읽어와 버튼 상태만 맞춘다.
  useEffect(() => {
    setOn(document.documentElement.classList.contains("big"));
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    document.documentElement.classList.toggle("big", next);
    try {
      localStorage.setItem(BIG_KEY, next ? "1" : "0");
    } catch {
      // 사생활 보호 모드 등에서 저장이 막혀도 이번 방문에는 적용된다.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on ? "글자 크기를 원래대로" : "글자를 크게 봅니다"}
      className={`inline-flex shrink-0 items-center gap-1 rounded-pill border-[1.5px]
                  px-2.5 py-1 font-bold transition-colors ${
                    on
                      ? "border-brand bg-brand text-white"
                      : "border-line2 bg-surface text-ink2 hover:border-brand hover:text-brand"
                  }`}
    >
      <span aria-hidden className="text-[11px] leading-none">가</span>
      <span aria-hidden className="text-[15px] leading-none">가</span>
      <span className="ml-0.5 text-xs">{on ? "작게" : "크게"}</span>
    </button>
  );
}
