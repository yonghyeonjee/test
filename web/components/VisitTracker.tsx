"use client";

import { useEffect } from "react";
import { readVisit } from "@/lib/referrer";

const ONCE_KEY = "jw.visit";

/**
 * 방문 한 번에 한 줄만 기록한다.
 *
 * 화면을 옮길 때마다 남기면 유입이 아니라 페이지뷰가 되어 버려서,
 * 같은 탭에서는 처음 한 번만 보낸다. 리퍼러는 첫 화면에서만 제대로 오므로
 * 어차피 그때 읽어야 한다.
 */
export default function VisitTracker() {
  useEffect(() => {
    // 통계 한 줄은 우리 서버(/api/visit)로 보낸다. 브라우저가 DB 를 직접 부르지 않는다.
    try {
      try {
        if (sessionStorage.getItem(ONCE_KEY)) return;
        sessionStorage.setItem(ONCE_KEY, "1");
      } catch {
        // 저장이 막힌 브라우저면 그냥 한 번 더 보낸다. 통계라 치명적이지 않다.
      }

      const v = readVisit(document.referrer, location.href, location.hostname);
      if (!v) return; // 사이트 내부 이동

      // 응답을 기다리지 않는다. 기록이 화면을 늦추면 안 된다.
      void fetch("/api/visit", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      }).then(() => {}, () => {});
    } catch {
      // 유입 기록은 없어도 되는 것이다. 화면을 막지 않는다.
    }
  }, []);

  return null;
}
