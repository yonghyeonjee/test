"use client";

import { useEffect } from "react";
import { track } from "./Gtm";

/**
 * 결과 화면에서 한 번 보내는 사건.
 *
 * 이 서비스에서 정말 봐야 할 것은 방문 수가 아니라
 * "무슨 조건으로 찾았고, 몇 건이 나왔는가"다.
 * 특히 0건은 데이터 구멍을 알려주는 가장 값진 신호다.
 */
export default function TrackResults({
  n,
  kind,
  entry,
  sido,
  ageBand,
  employment,
}: {
  n: number;
  kind: string;
  entry: string;
  sido?: string;
  ageBand?: string;
  employment?: string;
}) {
  useEffect(() => {
    track("search_result", {
      kind,
      entry,
      result_count: n,
      is_empty: n === 0,
      sido: sido ?? "(전국)",
      age_band: ageBand ?? "(무관)",
      employment: employment ?? "(무관)",
    });
  }, [n, kind, entry, sido, ageBand, employment]);

  return null;
}
