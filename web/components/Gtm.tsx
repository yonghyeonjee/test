"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const ID = process.env.NEXT_PUBLIC_GTM_ID || "";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/** dataLayer 로 사건 하나 밀어 넣기. GTM 이 없으면 아무 일도 안 한다. */
export function track(event: string, data: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || !ID) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...data });
}

/**
 * 화면 전환 알리기.
 *
 * 이 사이트는 조건이 주소(?sido=경기도&age=28)에 담기고 화면 전체가
 * 새로 그려지지 않는다. GTM 의 기본 '페이지뷰'만으로는 조건을 바꿔가며
 * 둘러본 흔적이 잡히지 않아서, 주소가 바뀔 때마다 직접 알려준다.
 */
function RouteChange() {
  const path = usePathname();
  const sp = useSearchParams();

  useEffect(() => {
    const q = sp.toString();
    track("page_view_spa", {
      page_path: q ? `${path}?${q}` : path,
      has_condition: Boolean(sp.get("sido") || sp.get("age") || sp.get("emp")),
    });
  }, [path, sp]);

  return null;
}

export function GtmScript() {
  if (!ID) return null;
  return (
    <Script id="gtm" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${ID}');`}
    </Script>
  );
}

export function GtmNoScript() {
  if (!ID) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}

export { RouteChange };
