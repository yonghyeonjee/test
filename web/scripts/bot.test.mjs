// 코드와 시험이 어긋나지 않게, 실제 파일에서 정규식을 그대로 꺼내 쓴다.
import { readFileSync } from "node:fs";
const src = readFileSync("lib/bot.ts", "utf8");
const grab = (name) => {
  const m = src.match(new RegExp(`const ${name} =\\s*(/[\\s\\S]*?/i);`));
  if (!m) throw new Error(name + " 를 못 찾았습니다");
  return eval(m[1]);
};
const BOT = grab("BOT"), HUMAN = grab("HUMAN");
const isBot = (ua) => { const s = (ua ?? "").trim(); if (!s) return true; if (BOT.test(s)) return true; return !HUMAN.test(s); };

const CHROME = "Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const cases = [
  // 크롤러
  ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", true],
  ["Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", true],
  ["Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)", true],
  ["Mozilla/5.0 (compatible; Daum/4.1; +http://cs.daum.net/faq/15/4118.html)", true],
  ["Mozilla/5.0 (compatible; YandexBot/3.0)", true],
  ["Mozilla/5.0 (compatible; Baiduspider/2.0)", true],
  ["Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)", true],
  ["Mozilla/5.0 (compatible; ClaudeBot/1.0)", true],
  ["Mozilla/5.0 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)", true],
  ["facebookexternalhit/1.1", true],
  ["curl/8.4.0", true],
  ["", true],
  [null, true],
  // 사람
  [CHROME, false],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", false],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0", false],
  ["Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36", false],
  // 앱 안에서 보는 진짜 사람들
  [CHROME + " NAVER(inapp; search; 1200; 12.4.5)", false],
  [CHROME + " KAKAOTALK 10.4.5", false],
  ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 DaumApps/5.19.0", false],
  [CHROME + " Instagram 320.0.0.0", false],
];
let bad = 0;
for (const [ua, want] of cases) {
  const got = isBot(ua);
  if (got !== want) { bad++; console.log("FAIL", JSON.stringify(ua), "want", want, "got", got); }
}
console.log(bad === 0 ? `isBot OK — ${cases.length}건 모두 통과` : `${bad}건 실패`);
process.exit(bad ? 1 : 0);
