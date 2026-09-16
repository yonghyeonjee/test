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
 * 자동 광고는 쓰지 않는다. 로더 주소의 ?client= 는 자동 광고를 위한
 * 것이다 — 그게 붙어 있으면 계정 설정에 따라 구글이 화면 아무 데나
 * (아래 고정 띠, 화면 전환 사이 전면) 광고를 끼운다. 떼어 내면 우리가
 * 자리를 정한 <ins> 에만 나온다. 각 <ins> 가 data-ad-client 를 들고 있어
 * 그것으로 충분하다. 페이지 단위 광고를 켜는 push 도 버린다.
 */
const LOADER = /adsbygoogle\.js/;

/** 로더 주소에서 자동 광고용 client 인자를 뗀다. */
function manualOnly(src: string): string {
  if (!LOADER.test(src)) return src;
  try {
    const u = new URL(src, location.href);
    u.searchParams.delete("client");
    return u.toString();
  } catch {
    return src;
  }
}
export default function AdHtml({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html;
    for (const old of Array.from(el.querySelectorAll("script"))) {
      const rawSrc = old.getAttribute("src");
      if (rawSrc) {
        old.remove();
        const src = manualOnly(rawSrc);
        if (document.querySelector(`script[src="${CSS.escape(src)}"]`)) continue;
        const s = document.createElement("script");
        for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
        s.src = src;
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
