"use client";

import { useEffect, useState } from "react";

/**
 * 화면이 넉넉할 때만 안의 것을 붙인다.
 *
 * 오른쪽 세로 광고는 css 로 좁은 화면에서 감췄는데, 감춰도 광고 코드는 돌아서
 * 애드센스가 "폭 0 인 자리"라며 TagError 를 던졌다(운영 탐침의 "W" 오류).
 * 보이지도 않을 광고를 부르는 것은 애드센스 정책에도 어긋난다. 그래서 붙이기
 * 전에 화면 크기와 "글자 크게 보기"를 보고, 맞을 때만 붙인다.
 */
export default function WideOnly({ query, children }: { query: string; children: React.ReactNode }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const big = () => document.documentElement.classList.contains("big");
    const on = () => setOk(mq.matches && !big());
    on();
    mq.addEventListener("change", on);
    const mo = new MutationObserver(on);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => { mq.removeEventListener("change", on); mo.disconnect(); };
  }, [query]);
  return ok ? <>{children}</> : null;
}
