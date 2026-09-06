"use client";

import { useState } from "react";

/**
 * 공유하기. 휴대폰에서는 OS 공유 시트(카톡·문자)를 띄우고,
 * 그게 없는 데스크톱에서는 주소를 복사한다.
 */
export default function ShareButton({
  title,
  text,
  className = "",
}: {
  title: string;
  text?: string;
  className?: string;
}) {
  const [done, setDone] = useState<"copied" | null>(null);

  const share = async () => {
    // 서버 렌더 결과에는 주소가 없으니 눌린 시점에 읽는다.
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone("copied");
      setTimeout(() => setDone(null), 2000);
    } catch {
      // 사용자가 공유 시트를 닫은 경우까지 오류로 보여줄 필요는 없다.
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex items-center gap-1.5 rounded-pill border-[1.5px]
                  border-line2 bg-surface px-3.5 py-2 text-[13.5px] font-semibold
                  text-ink2 transition-colors hover:border-brand hover:text-brand
                  ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
      </svg>
      {done === "copied" ? "주소를 복사했습니다" : "공유하기"}
    </button>
  );
}
