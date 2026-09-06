/**
 * 어디서 들어왔는지 판정한다.
 *
 * 검색어에 대해 미리 알아둘 것: 구글은 리퍼러에서 검색어를 지운 지 오래고,
 * 네이버·다음도 대부분 지운다. 그래서 term 은 대개 비어 있다 — 코드가
 * 잘못된 게 아니라 브라우저가 안 넘겨 준다. 실제 검색어를 보려면
 * 구글 서치콘솔과 네이버 서치어드바이저를 봐야 한다.
 * 여기서는 넘어오는 경우(일부 네이버 유입, Bing, 사내 링크)와 직접 붙인
 * utm_term 만 담는다.
 */

type Rule = { test: RegExp; name: string };

const CHANNELS: Rule[] = [
  { test: /(^|\.)naver\.com$/, name: "네이버" },
  { test: /(^|\.)google\./, name: "구글" },
  { test: /(^|\.)daum\.net$|(^|\.)kakao\.com$/, name: "다음·카카오" },
  { test: /(^|\.)bing\.com$/, name: "빙" },
  { test: /(^|\.)search\.zum\.com$|(^|\.)zum\.com$/, name: "줌" },
  { test: /(^|\.)instagram\.com$/, name: "인스타그램" },
  { test: /(^|\.)facebook\.com$|(^|\.)fb\.com$/, name: "페이스북" },
  { test: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/, name: "유튜브" },
  { test: /(^|\.)threads\.net$/, name: "스레드" },
  { test: /(^|\.)x\.com$|(^|\.)twitter\.com$/, name: "엑스" },
  { test: /(^|\.)tistory\.com$|(^|\.)blog\.naver\.com$/, name: "블로그" },
  { test: /(^|\.)knowhow-it\.com$|(^|\.)jeepedia\.com$/, name: "우리 사이트" },
];

/** 검색 포털이 검색어를 담아 보낼 때 쓰는 이름들. */
const TERM_KEYS = ["query", "q", "keyword", "wd", "search_query", "text"];

export type Visit = {
  channel: string;
  refHost: string | null;
  term: string | null;
  landing: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

export function readVisit(
  referrer: string,
  href: string,
  selfHost: string
): Visit | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const sp = url.searchParams;

  let refHost: string | null = null;
  let term: string | null = null;
  let channel = "직접 유입";

  if (referrer) {
    try {
      const r = new URL(referrer);
      refHost = r.hostname.replace(/^www\./, "");
      // 우리 사이트 안에서의 이동은 유입이 아니다.
      if (r.hostname === selfHost) return null;

      const hit = CHANNELS.find((c) => c.test.test(refHost!));
      channel = hit ? hit.name : refHost;

      for (const k of TERM_KEYS) {
        const v = r.searchParams.get(k);
        if (v && v.trim()) {
          term = v.trim();
          break;
        }
      }
    } catch {
      /* 형식이 이상한 리퍼러는 직접 유입으로 둔다 */
    }
  }

  // utm 을 직접 붙였다면 그쪽이 더 정확하다.
  const utmSource = sp.get("utm_source");
  const utmMedium = sp.get("utm_medium");
  const utmCampaign = sp.get("utm_campaign");
  if (utmSource) channel = utmSource;
  term = sp.get("utm_term") || term;

  return {
    channel,
    refHost,
    term,
    landing: url.pathname,
    utmSource,
    utmMedium,
    utmCampaign,
  };
}
