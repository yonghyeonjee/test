/**
 * 자유 입력 파서.
 *
 * "안산 28살 미취업" / "경기도 청년 월세" / "서울 65세 기초수급"
 * 같은 한 줄 입력을 조건으로 바꾼다.
 *
 * LLM 을 쓰지 않는다. 조회 한 번마다 비용이 붙으면 안 되고,
 * 같은 문장이 매번 다르게 해석되면 신뢰가 무너진다.
 */

import { EMPLOYMENT, HOUSEHOLD } from "./db";

export type Parsed = {
  sido?: string;
  sigungu?: string;
  age?: number;
  employment?: string;
  household: string[];
  leftover: string[]; // 못 알아들은 낱말
};

const SIDO_WORDS: [RegExp, string][] = [
  [/서울/, "서울특별시"],
  [/부산/, "부산광역시"],
  [/대구/, "대구광역시"],
  [/인천/, "인천광역시"],
  [/대전/, "대전광역시"],
  [/울산/, "울산광역시"],
  [/세종/, "세종특별자치시"],
  [/경기/, "경기도"],
  [/강원/, "강원특별자치도"],
  [/충북|충청북/, "충청북도"],
  [/충남|충청남/, "충청남도"],
  [/전북|전라북/, "전북특별자치도"],
  [/경북|경상북/, "경상북도"],
  [/경남|경상남/, "경상남도"],
  [/제주/, "제주특별자치도"],
  // 2026-07-01 통합. 옛 표기로 검색해도 잡히게 둔다.
  [/광주|전남|전라남/, "전남광주통합특별시"],
];

/** 생애주기 낱말 → 대표 나이. 숫자가 없을 때만 쓴다. */
const AGE_WORDS: [RegExp, number][] = [
  [/영유아|유아/, 3],
  [/아동|어린이|초등/, 9],
  [/청소년|중학|고등/, 16],
  [/청년/, 28],
  [/신중년|중장년|중년/, 52],
  [/노인|어르신|고령/, 70],
];

const HH_WORDS: [RegExp, string][] = [
  [/기초|수급|차상위|저소득|생계급여/, "저소득"],
  [/장애/, "장애인"],
  [/한부모|조손|미혼모|미혼부/, "한부모·조손"],
  [/다자녀|둘째|셋째/, "다자녀"],
  [/다문화|결혼이민|탈북|새터민/, "다문화·탈북민"],
  [/유공자|보훈|참전/, "보훈대상자"],
  [/1인|일인|독거|혼자/, "1인가구"],
  [/임산부|임신|출산/, "임산부"],
  [/무주택|전세|월세|주거/, "무주택"],
];

const EMP_WORDS: [RegExp, string][] = [
  [/미취업|무직|백수/, "미취업"],
  [/구직|취준|이직/, "구직중"],
  [/재직|직장|회사원|근로/, "재직"],
  [/자영업|소상공|사업자|창업/, "자영업"],
  [/학생|대학생|재학/, "학생"],
  [/퇴직|은퇴/, "퇴직"],
];

/**
 * @param sggIndex 시군구 이름 → 시도. "안산" 처럼 '시' 를 뺀 형태도 받는다.
 */
export function parseQuery(
  raw: string,
  sggIndex: Map<string, { sido: string; full: string }>
): Parsed {
  const text = (raw || "").trim();
  const out: Parsed = { household: [], leftover: [] };
  if (!text) return out;

  // 1) 나이 — 숫자가 있으면 그것이 우선이다
  const m = text.match(/(\d{1,3})\s*(?:세|살)?/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 0 && n <= 120) out.age = n;
  }

  // 2) 시군구 먼저. "광주시"(경기)와 "광주"(광역시)가 겹치므로
  //    구체적인 쪽을 먼저 본다.
  const keys = Array.from(sggIndex.keys()).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k.length >= 2 && text.includes(k)) {
      const hit = sggIndex.get(k)!;
      out.sigungu = hit.full;
      out.sido = hit.sido;
      break;
    }
  }

  // 3) 시도
  if (!out.sido) {
    for (const [re, name] of SIDO_WORDS) {
      if (re.test(text)) {
        out.sido = name;
        break;
      }
    }
  }

  // 4) 취업 상태
  for (const [re, v] of EMP_WORDS) {
    if (re.test(text)) {
      out.employment = v;
      break;
    }
  }

  // 5) 가구 상황 (여러 개 가능)
  for (const [re, v] of HH_WORDS) {
    if (re.test(text) && !out.household.includes(v)) out.household.push(v);
  }

  // 6) 나이 숫자가 없으면 생애주기 낱말로 대신한다
  if (out.age === undefined) {
    for (const [re, n] of AGE_WORDS) {
      if (re.test(text)) {
        out.age = n;
        break;
      }
    }
  }

  // 7) 아무것도 못 알아들은 낱말 (안내 문구용)
  const known =
    (out.sido ? 1 : 0) + (out.age !== undefined ? 1 : 0) +
    (out.employment ? 1 : 0) + out.household.length;
  if (known === 0) out.leftover = text.split(/\s+/).slice(0, 5);

  return out;
}

/** 파싱 결과를 사람이 읽는 문장으로 되돌려 준다 (확인용) */
export function describe(p: Parsed) {
  const bits: string[] = [];
  if (p.sigungu) bits.push(p.sigungu);
  else if (p.sido) bits.push(p.sido);
  if (p.age !== undefined) bits.push(`${p.age}세`);
  if (p.employment) bits.push(p.employment);
  bits.push(...p.household);
  return bits;
}

export function toParams(p: Parsed) {
  const sp = new URLSearchParams();
  if (p.sido) sp.set("sido", p.sido);
  if (p.sigungu) sp.set("sigungu", p.sigungu);
  if (p.age !== undefined) sp.set("age", String(p.age));
  if (p.employment) sp.set("emp", p.employment);
  p.household.forEach((h) => sp.append("hh", h));
  sp.set("via", "text");
  return sp;
}

export { EMPLOYMENT, HOUSEHOLD };
