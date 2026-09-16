/**
 * 크롤러인지 본다.
 *
 * 검색 기록이 사람의 것이 아니게 되어 있었다. 정책 화면에는 조건별 링크가
 * 수천 개 깔려 있고 크롤러가 그것을 한 시간에 300개씩 훑는다. 그 링크는
 * 모두 조건이 붙은 홈 주소라 서버가 "검색 1건"으로 셌다. 어느 날 661건
 * 가운데 594건이 그런 것이었고, 서로 다른 조건 조합이 274가지였다.
 * 사람이 하루에 274가지 조건을 바꿔 가며 찾지는 않는다.
 *
 * 화면은 그대로 보여 준다. 기록만 남기지 않는다 — 크롤러를 막으면 색인이
 * 안 된다. 세어서는 안 될 뿐이다.
 *
 * 이름표를 속이는 크롤러는 어차피 못 거른다. 그래도 훑는 양의 대부분은
 * 이름을 밝히는 큰 검색엔진이라 이 정도로 충분히 걸러진다.
 */
/**
 * 이름에 든 낱말로 가린다.
 *
 * "search" 같은 흔한 낱말은 넣으면 안 된다. 네이버 앱 안에서 보는 사람의
 * 이름표가 "… NAVER(inapp; search; 1200; 12.4.5)" 라, 넣는 순간 진짜
 * 사람이 봇으로 세어진다. 카카오톡 안에서 보는 사람도 마찬가지다.
 * 크롤러가 실제로 쓰는 이름만 적는다.
 */
const BOT =
  /bot|crawl|spider|slurp|scrape|index|monitor|preview|fetch|curl|wget|python-requests|httpclient|okhttp|axios|headless|lighthouse|pagespeed|gtmetrix|semrush|ahrefs|mj12|dotbot|petal|bytespider|perplexity|yeti|daumoa|daum\/|yandex|baidu|sogou|coccoc|ia_archiver|mediapartners|meta-externalagent|facebookexternalhit|whatsapp|telegram|slackbot|discord|embedly|feed|rss|validator|uptime|pingdom|dataprovider|zgrab|masscan/i;

/** 사람이 쓰는 브라우저는 이 가운데 하나를 반드시 달고 온다. */
const HUMAN = /mozilla|opera|safari|chrome|firefox|edge/i;

export function isBot(ua: string | null | undefined): boolean {
  const s = (ua ?? "").trim();
  // 이름표가 아예 없으면 브라우저가 아니다.
  if (!s) return true;
  if (BOT.test(s)) return true;
  return !HUMAN.test(s);
}
