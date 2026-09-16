"use client";

import { useEffect, useRef } from "react";

/**
 * 관리자가 넣은 광고 HTML 을 실제로 돌아가게 끼운다.
 *
 * innerHTML 로 넣은 <script> 는 브라우저가 실행하지 않는다. 첫 방문(서버가
 * 그린 HTML)에서는 돌지만, 목록에서 상세로 넘어가듯 화면 안에서 이동하면
 * React 가 DOM 을 만들기 때문에 스크립트가 죽은 글자로 남는다. 그래서
 * 광고가 첫 화면에서만 보이고 그다음부터는 빈 칸이 된다.
 *
 * 붙은 뒤에 script 태그를 새로 만들어 바꿔 끼우면 실행된다. 주소(src)가
 * 있는 것은 <head> 에 한 번만 둔다 — 애드센스 로더는 두 번 넣으면
 * "head tag 는 하나만" 이라며 그 뒤의 push 를 막는다.
 *
 * 자동광고는 여기서 막지 않는다.
 *
 * 한동안 로더 주소에서 ?client= 를 떼어 봤다. 자동광고 코드가 그 인자로
 * 켜지니 떼면 안 나올 줄 알았는데, 떼고 배포한 뒤에도 화면 아래 고정 띠가
 * 그대로 나왔다. 막지도 못하면서 애드센스가 주는 코드와 달라지기만 했고,
 * 우리가 자리를 정해 둔 수동 지면까지 안 채워질 위험이 남았다. 되돌린다.
 *
 * 자동광고를 쓸지 말지는 애드센스 계정에서 정한다. 1차 도메인은 자동광고를
 * 쓰고 이 사이트만 수동 지면으로 두려면, 애드센스 → 광고 → 사이트별 →
 * knowhow-it.com 에서 jiwon.knowhow-it.com 을 페이지 제외로 넣는다.
 * 제외는 주소 앞부분으로 맞추므로 하위 도메인만 따로 빠진다.
 *
 * 다만 페이지 단위 광고를 켜는 push(enable_page_level_ads)는 코드에 들어
 * 있으면 그대로 실행되니, 그것만 걸러 낸다.
 */
export default function AdHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html;
    for (const old of Array.from(el.querySelectorAll("script"))) {
      const src = old.getAttribute("src");
      if (src) {
        old.remove();
        if (document.querySelector(`script[src="${CSS.escape(src)}"]`)) continue;
        const s = document.createElement("script");
        for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
        document.head.appendChild(s);
        continue;
      }
      if (/enable_page_level_ads/.test(old.text)) { old.remove(); continue; }
      const s = document.createElement("script");
      for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
      s.text = old.text;
      old.replaceWith(s);
    }
    return () => { el.innerHTML = ""; };
  }, [html]);

  return <div ref={ref} className="ad-html" />;
}
