"use client";

import { useState } from "react";

/**
 * 내 위치 → 시·도·시·군·구. 브라우저 위치 권한을 받고 /api/map/where 에 소수 셋째 자리까지만 보낸다
 * (약 100m, 정확한 자리는 안 남긴다). 정책지도가 하는 것과 같다. 어디서나 쓰게 훅으로.
 */
export type MyPlace = { sido: string; sigungu: string | null; label: string };

export function useLocate() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const locate = (): Promise<MyPlace | null> => new Promise((res) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setErr("이 브라우저는 위치를 지원하지 않습니다."); res(null); return;
    }
    setBusy(true); setErr(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude.toFixed(3), lng = pos.coords.longitude.toFixed(3);
          const r = await fetch(`/api/map/where?lat=${lat}&lng=${lng}`);
          const j = (await r.json()) as { dong: { sido: string; sgg: string; label: string } | null };
          if (!j.dong) { setErr("위치를 지역으로 바꾸지 못했습니다. 지역을 직접 골라 주세요."); res(null); return; }
          res({ sido: j.dong.sido, sigungu: j.dong.sgg || null, label: j.dong.label });
        } catch {
          setErr("위치를 읽지 못했습니다. 지역을 직접 골라 주세요."); res(null);
        } finally { setBusy(false); }
      },
      (e) => {
        setBusy(false);
        setErr(e.code === 1 ? "위치 권한이 꺼져 있습니다. 지역을 직접 골라도 됩니다." : "위치를 읽지 못했습니다. 지역을 직접 골라 주세요.");
        res(null);
      },
      { maximumAge: 600_000, timeout: 8_000 },
    );
  });

  return { locate, busy, err };
}
