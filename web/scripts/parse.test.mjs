// 한 줄 검색 파서. 조건으로 알아들은 조각을 빼고 남는 낱말이 검색어가 되는지.
//   node --experimental-strip-types scripts/parse.test.mjs
import { parseQuery, parseBizQuery, describe, toParams } from "../lib/parse.ts";
import { expandQuery, tokenize } from "../lib/keywords.ts";

const idx = new Map([
  ["수원", { sido: "경기도", full: "수원시" }],
  ["안산", { sido: "경기도", full: "안산시" }],
  ["광주시", { sido: "경기도", full: "광주시" }],
]);

let bad = 0;
const eq = (a, b, msg) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) { bad++; console.log("FAIL", msg, "\n  got ", x, "\n  want", y); } };

let p = parseQuery("경기 신혼부부 전세", idx);
eq([p.sido, p.keywords], ["경기도", ["신혼부부", "전세"]], "경기 신혼부부 전세");
eq(Object.fromEntries(toParams(p)), { sido: "경기도", q: "신혼부부 전세", via: "text" }, "params");

p = parseQuery("수원 28살 미취업", idx);
eq([p.sigungu, p.sido, p.age, p.employment, p.keywords], ["수원시", "경기도", 28, "미취업", []], "수원 28살 미취업");

p = parseQuery("수원시 신혼 전세 대출", idx);
eq([p.sigungu, p.keywords], ["수원시", ["신혼", "전세", "대출"]], "수원시 신혼 전세 대출");

p = parseQuery("대학생 학자금", idx);
eq([p.employment, p.keywords], ["학생", ["학자금"]], "대학생 학자금");

p = parseQuery("서울 65세 기초수급", idx);
eq([p.sido, p.age, p.household, p.keywords], ["서울특별시", 65, ["저소득"], []], "서울 65세 기초수급");

p = parseQuery("경기도 청년 월세", idx);
eq([p.sido, p.age, p.household, p.keywords], ["경기도", 28, [], ["월세"]], "경기도 청년 월세 — 월세는 검색어");

p = parseQuery("신혼", idx);
eq([p.keywords, p.leftover], [["신혼"], []], "낱말 하나");
eq(describe(p), ["‘신혼’ 포함"], "describe");

p = parseQuery("지원금 조회", idx);
eq([p.keywords, p.leftover.length > 0], [[], true], "군말만 있으면 leftover");

p = parseQuery("부산 한부모 초등학생 교육비", idx);
eq([p.sido, p.household, p.age, p.keywords], ["부산광역시", ["한부모·조손"], 9, ["교육비"]], "부산 한부모 초등학생 교육비");

let b = parseBizQuery("경기도 소상공인 자금");
eq([b.sido, b.target, b.field, b.keywords], ["경기도", "소상공인", ["금융"], []], "biz 기본");
b = parseBizQuery("제조업 스마트공장");
eq([b.industry, b.keywords], [["제조업"], ["스마트공장"]], "biz 낱말");
b = parseBizQuery("3년차 창업기업 판로 온라인몰");
eq([b.years, b.target, b.field, b.keywords], [3, "창업기업", ["판로"], []], "biz 3년차");

eq(tokenize("신혼부부의 전세, 대출을"), ["신혼부부", "전세", "대출"], "조사 제거");
eq(expandQuery("신혼 전세"), ["신혼|신혼부부|예비신혼|신혼가구|결혼", "전세|전월세|임차|보증금|전세자금|전세대출"], "동의어 확장");
eq(expandQuery("  "), null, "빈 검색어");
eq(expandQuery("알수없는말"), ["알수없는말"], "사전에 없는 말은 그대로");

console.log(bad ? `${bad}건 실패` : "parse: 모두 통과");
process.exit(bad ? 1 : 0);
