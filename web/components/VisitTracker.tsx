"use client";

import { useEffect } from "react";
import { db } from "@/lib/db";
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
    try {
      if (sessionStorage.getItem(ONCE_KEY)) return;
      sessionStorage.setItem(ONCE_KEY, "1");
    } catch {
      // 저장이 막힌 브라우저면 그냥 한 번 더 보낸다. 통계라 치명적이지 않다.
    }

    const v = readVisit(document.referrer, location.href, location.hostname);
    if (!v) return; // 사이트 내부 이동

    // 응답을 기다리지 않는다. 기록이 화면을 늦추면 안 된다.
    void db
      .rpc("log_visit", {
        p_channel: v.channel,
        p_ref_host: v.refHost,
        p_term: v.term,
        p_landing: v.landing,
        p_utm_source: v.utmSource,
        p_utm_medium: v.utmMedium,
        p_utm_campaign: v.utmCampaign,
      })
      .then(
        () => {},
        () => {}
      );
  }, []);

  return null;
}
