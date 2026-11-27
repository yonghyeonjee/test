"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { readVisit } from "@/lib/referrer";

const ONCE_KEY = "jw.visit";
const FLOW_KEY = "jw.flow";

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
    // 검색엔진 크롤러(자바스크립트를 돌린다)와 자동화 브라우저(점검)는 사람이 아니니 세지 않는다.
    if (navigator.webdriver || /bot|crawl|spider|slurp|yeti|headless|lighthouse|probe/i.test(navigator.userAgent)) return;
    // 사람 브라우저는 언어 목록이 비지 않는다. 비어 있으면 자동화 브라우저다.
    if (!navigator.languages || navigator.languages.length === 0) return;
    try {
      try {
        if (sessionStorage.getItem(ONCE_KEY)) return;
        sessionStorage.setItem(ONCE_KEY, "1");
      } catch {
        // 저장이 막힌 브라우저면 그냥 한 번 더 보낸다. 통계라 치명적이지 않다.
      }

      const v = readVisit(document.referrer, location.href, location.hostname);
      if (!v) return; // 사이트 내부 이동
      // 이 방문의 길과 첫 쪽을 탭에 적어 둔다. 다음 쪽으로 넘어갈 때 그 흐름을 한 줄씩 보낸다(아래).
      try { sessionStorage.setItem(FLOW_KEY, JSON.stringify({ c: v.channel, l: v.landing, n: 1, p: location.pathname })); } catch { /* 없어도 된다 */ }

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

  // 방문 흐름(2026-11-27): 들어온 사람이 다음 쪽으로 넘어가는지. 같은 탭에서 둘째~다섯째 쪽만, 쪽마다 한 줄.
  // 길(채널)·내린 쪽·몇 번째·본 쪽만 보낸다 — 사람이나 기기를 가리키는 값은 없다. 첫 줄(유입)을 보낸 방문만 잇는다.
  const pathname = usePathname();
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FLOW_KEY);
      if (!raw) return;
      const f = JSON.parse(raw) as { c: string; l: string; n: number; p: string };
      const here = location.pathname;
      if (!f || f.p === here || f.n >= 5) return;
      f.n += 1; f.p = here;
      sessionStorage.setItem(FLOW_KEY, JSON.stringify(f));
      void fetch("/api/visit/step", {
        method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: f.c, landing: f.l, step: f.n, path: here }),
      }).then(() => {}, () => {});
    } catch {
      // 흐름 기록은 없어도 되는 것이다.
    }
  }, [pathname]);

  return null;
}
