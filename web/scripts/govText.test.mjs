// 공고 원문 쪼개기. 목록은 목록으로, 문장은 문장으로.
//   node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/govText.test.mjs
import { parseGovText } from "../lib/govText.ts";

let bad = 0;
const ok = (cond, msg) => { if (!cond) { bad++; console.log("  ✗", msg); } };
const texts = (b) => b.map((x) => (x.kind === "field" ? `${x.label}:${x.value}` : x.text));

// 1. 복지로 지원대상 — "- (연령기준)" 항목 셋이 한 문단에 붙어 있었다.
{
  const b = parseGovText("❍ 지원조건 : 아래의 요건을 모두 충족하는 자 - (연령기준) 19~39세 (2026년 기준, 1987. 1. 1. ~ 2007. 12. 31. 출생자) - (거주기준) 신청일 기준 1년 이상 충주시에 주민등록을 두고 있는 자 - (수강기준) 2026. 1. 1. ~ 11. 30. 기간 내 수강을 시작하여 완료한 자");
  ok(b[0].kind === "field" && b[0].label === "지원조건", "❍ 지원조건 : 은 이름:값");
  const heads = b.filter((x) => x.kind === "head").map((x) => x.text);
  ok(heads.length === 3, `항목 셋 (${heads.length}): ${JSON.stringify(texts(b))}`);
  ok(heads[0]?.startsWith("(연령기준) 19~39세 (2026년 기준, 1987. 1. 1. ~ 2007. 12. 31. 출생자)"), "날짜는 자르지 않는다: " + heads[0]);
  ok(heads[2] === "(수강기준) 2026. 1. 1. ~ 11. 30. 기간 내 수강을 시작하여 완료한 자", heads[2]);
}

// 2. 선정기준 — 표시 없이 괄호 이름이 이어지고, 각주 별표가 낱말에 붙어 있다.
{
  const b = parseGovText("□ 지원조건 : 아래의 요건을 모두 충족하는 자(연령기준) 19~39세(1987.1.1.~2007.12.31.)(거주기간) 신청일 기준 1년 이상 충주시에 주민등록을 두고 있는 자(수강기준) 2026.1.1.~11.30. 기간 내 수강을 시작하여 완료한 자※ 지원분야 시험을 응시하기 위한 학원* 및 직업능력개발시설**에서 수강한 경우로 한정* 교육청에 등록된 학원(나이스교육정보개방포털>데이터셋>학원교습소정보에서 조회가능한 학원(교습소 제외)** 직업능력개발시설(고용24>기업>직업능력개발>훈련기관·강사>훈련기관평가정보>집체훈련·원격훈련에서 확인(미취업기준) 수강시작일~수강완료일 기준 미취업자*※ 수강완료일 이후에 취업 또는 사업자등록을 한 경우는 신청 가능* 미취업자 : 아래 요건을 모두 충족하는 자① 건강보험 자격득실 확인서 상 직장가입자가 아닌 자※ 단, 1년 이하 비정규직 단기근로자는 신청 가능(근로계약서 등 증빙 필요)② 사실증명(사업자등록사실여부) 상 사업자등록을 하지 않은 자※ 단, 수강시작일 전 휴업 또는 폐업한 자는 신청 가능(휴·폐업증명서 등 증빙 필요)");
  const t = texts(b);
  ok(b[0].kind === "field" && b[0].value === "아래의 요건을 모두 충족하는 자", "□ 지원조건 값: " + b[0].value);
  ok(t.includes("(연령기준) 19~39세(1987.1.1.~2007.12.31.)"), "연령기준 한 줄: " + JSON.stringify(t.slice(0, 5)));
  ok(t.includes("(거주기간) 신청일 기준 1년 이상 충주시에 주민등록을 두고 있는 자"), "거주기간 한 줄");
  ok(t.some((x) => x.startsWith("지원분야 시험을 응시하기 위한 학원* 및 직업능력개발시설**에서 수강한 경우로 한정")), "각주 별표에서 끊지 않는다: " + JSON.stringify(t.filter((x) => x.includes("학원"))));
  ok(!t.includes("및 직업능력개발시설") && !t.includes("에서 수강한 경우로 한정"), "토막 줄이 없다");
  ok(b.some((x) => x.kind === "note" && x.text.startsWith("미취업자 : 아래 요건")), "각주 풀이(* 미취업자 :)는 단서로");
  ok(b.filter((x) => x.kind === "item").length === 2, "①② 두 항목");
  ok(b.some((x) => x.kind === "note" && x.text.startsWith("단, 1년 이하")), "※ 단서");
  ok(b.filter((x) => x.kind === "head").length >= 3, "괄호 이름 항목은 목록(head)");
}

// 3. 전에 되던 것이 그대로 되나.
{
  const b = parseGovText("- 접수처 : 주소지 동 행정복지센터 - 접수방법 : 본인 직접 방문 접수 (09:00 ~ 18:00) * 대리접수 불가- 제출서류 1) 신청서 1부 2) 통장사본 * 공고일 이후 발급분만 유효");
  const t = texts(b);
  ok(t[0] === "접수처:주소지 동 행정복지센터", t[0]);
  ok(b.some((x) => x.kind === "note" && x.text === "대리접수 불가"), "띄어 쓴 별표는 단서: " + JSON.stringify(t));
  ok(b.some((x) => x.kind === "head" && x.text === "제출서류"), "소제목");
  ok(b.filter((x) => x.kind === "item").length === 2, "1) 2)");
  const c = parseGovText("보증금 + (월임대료×12) ÷ 제한 산정률. 2025. 1. 1. 부터 시행");
  ok(c.length === 1 && c[0].kind === "text", "괄호 안 숫자·날짜는 자르지 않는다: " + JSON.stringify(texts(c)));
  const d = parseGovText("월 20만원 지원 (2024-01 ~ 2024-12) - 신청은 읍면동");
  ok(texts(d).length === 2, "날짜 범위의 하이픈은 그대로: " + JSON.stringify(texts(d)));
}

console.log(bad ? `govText: ${bad}개 틀림` : "govText: 모두 통과");
process.exit(bad ? 1 : 0);
