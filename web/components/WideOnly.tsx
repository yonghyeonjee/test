"use client";

import { useEffect, useState } from "react";

/**
 * 화면이 넉넉할 때만 안의 것을 붙인다.
 *
 * 오른쪽 세로 광고는 css 로 좁은 화면에서 감췄는데, 감춰도 광고 코드는 돌아서
 * 애드센스가 "폭 0 인 자리"라며 TagError 를 던졌다(운영 탐침의 "W" 오류).
 * 보이지도 않을 광고를 부르는 것은 애드센스 정책에도 어긋난다. 그래서 붙이기
 * 전에 화면 크기와 "글자 크게 보기"를 보고, 맞을 때만 붙인다.
 *
 * 2026-10-22: 첫 화면의 PC 전용 기둥·블록에도 쓴다(min="sm"|"lg"). 전에는 휴대폰용과 PC용을 둘 다 HTML 에 넣고
 * CSS 로 한쪽을 감춰, 휴대폰이 안 보이는 PC 기둥까지 받아 hydration 했다. 서버는 아무것도 내지 않고 켜진 뒤
 * 폭이 맞을 때 그린다 — PC 는 한 박자 늦게 나타나지만 기둥 자리는 grid 가 잡고 있어 본문은 밀리지 않는다.
 * 검색엔진은 휴대폰 화면으로 보니(mobile-first) 전과 같다. big(글자 크게) 검사는 광고 때문에 둔 것이라
 * min 으로 쓸 때는 보지 않는다.
 */
export default function WideOnly({ query, min, children }: { query?: string; min?: "sm" | "lg"; children: React.ReactNode }) {
  const [ok, setOk] = useState(false);
  const q = query ?? (min === "sm" ? "(min-width: 640px)" : "(min-width: 1024px)");
  const adMode = Boolean(query);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const big = () => document.documentElement.classList.contains("big");
    const on = () => setOk(mq.matches && (!adMode || !big()));
    on();
    mq.addEventListener("change", on);
    const mo = new MutationObserver(on);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => { mq.removeEventListener("change", on); mo.disconnect(); };
  }, [q, adMode]);
  return ok ? <>{children}</> : null;
}
