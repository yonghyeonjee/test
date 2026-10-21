"use client";

import { useEffect, useState } from "react";

/**
 * 첫 상호작용(터치·스크롤·마우스 움직임·자판) 뒤에 true 가 된다. 아무 일이 없어도 fallbackMs 뒤에는 true.
 *
 * 첫 화면의 띠와 검색창 안내 글이 스스로 바뀌는데, 바뀔 때마다 그려지는 큰 글자가 새 LCP 후보로 잡혀
 * LCP 가 5초 넘게 나왔다(2026-10-21 Lighthouse·PageSpeed). LCP 는 첫 상호작용에서 측정이 끝나므로,
 * 그 뒤에 돌리면 측정에도 사람 눈에도 손해가 없다. 손대지 않는 사람에게는 fallbackMs 뒤에 돈다.
 */
export function useAfterInteraction(fallbackMs = 8000): boolean {
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (go) return;
    const on = () => setGo(true);
    const opts: AddEventListenerOptions = { once: true, passive: true };
    const evs = ["pointerdown", "pointermove", "touchstart", "keydown", "scroll", "wheel"] as const;
    for (const e of evs) window.addEventListener(e, on, opts);
    const t = setTimeout(on, fallbackMs);
    return () => { for (const e of evs) window.removeEventListener(e, on); clearTimeout(t); };
  }, [go, fallbackMs]);
  return go;
}
