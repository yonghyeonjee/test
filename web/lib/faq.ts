import { ageLabel, applyStatus, daysLeft, STATUS_LABEL, type Area, type Detail } from "./db";
import { hasStructure } from "./govText";
import { manwon, standardFor, tableYear } from "./medianIncome";

/**
 * 상세 화면을 "표"가 아니라 "글"로 읽히게 하는 문장들.
 *
 * 공고 원문은 딱딱하고 빠진 곳이 많다. 필드에서 문장을 만들어 처음 온
 * 사람이 30초 안에 "나한테 해당되나, 언제까지, 어디서"를 알 수 있게 한다.
 * 없는 값은 문장에서 빼고, 지어내지 않는다.
 */

export type QA = { q: string; a: string };

/**
 * 받침 유무로 조사를 고른다. "청년은" / "어르신은" 처럼.
 *
 * "으로/로" 는 규칙이 하나 더 있다 — 받침이 ㄹ 이면 "로" 를 쓴다
 * ("서울로", "물로"). 그래서 종성 번호를 따로 본다.
 */
export function josa(word: string, pair: "은는" | "이가" | "을를" | "과와" | "으로") {
  const last = word.charCodeAt(word.length - 1);
  const korean = last >= 0xac00 && last <= 0xd7a3;
  const jong = korean ? (last - 0xac00) % 28 : 0;
  const has = korean ? jong !== 0 : false;
  if (pair === "으로") return word + (!has || jong === 8 ? "로" : "으로");
  const [a, b] = pair === "은는" ? ["은", "는"] : pair === "이가" ? ["이", "가"] : pair === "을를" ? ["을", "를"] : ["과", "와"];
  return word + (has ? a : b);
}

/** 검색에서 많이 치는 말로 이 사업을 한 단어로 부른다. */
export function topicKeyword(p: Detail) {
  if (p.kind === "business" || p.kind === "event") return "기업지원사업";
  const t = p.topics ?? [], h = p.household ?? [];
  if (t.includes("일자리") || p.employment?.includes("구직중")) return "취업지원제도";
  if (t.includes("주거") || h.includes("무주택")) return "주거지원";
  if (t.includes("임신·출산") || h.includes("임산부")) return "출산지원금";
  if ((p.age_min ?? 0) >= 60) return "노인 복지";
  if (p.age_max !== null && p.age_max <= 39 && (p.age_min ?? 0) >= 15) return "청년지원금";
  if (h.includes("저소득")) return "저소득층 지원";
  if (t.includes("교육")) return "교육비 지원";
  return "복지서비스";
}

const clip = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const cut = t.slice(0, n);
  const end = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("다 "));
  return (end > 40 ? cut.slice(0, end + 1) : cut).trim();
};

function who(p: Detail) {
  const out: string[] = [];
  const age = ageLabel(p);
  if (age) out.push(age);
  if (p.household?.length) out.push(p.household.slice(0, 2).join("·"));
  if (p.employment?.length) out.push(p.employment.slice(0, 2).join("·"));
  if (p.biz_target?.length) out.push(p.biz_target.slice(0, 2).join("·"));
  return out;
}

/** 2026-12-31 → 2026년 12월 31일. 숫자만 늘어놓은 날짜는 눈에 안 들어온다. */
export function korDate(iso: string | null | undefined) {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : (iso ?? "");
}

/**
 * 접수 기간 한 문장.
 *
 * 예전에는 부르는 쪽이 "접수는 " 을 앞에 붙이고 여기서도 "접수하며" 라고
 * 해서 "접수는 2026-12-31까지 접수하며" 가 됐다. 여기서 문장을 통째로
 * 만든다.
 */
function period(p: Detail) {
  if (p.is_always_on || !p.apply_end) return "따로 마감 없이 상시 접수합니다.";
  const end = korDate(p.apply_end);
  const left = daysLeft(p);
  const st = applyStatus(p);
  if (st === "closed") return `${end}에 접수가 끝났습니다.`;
  if (st === "upcoming" && p.apply_start)
    return `${korDate(p.apply_start)}부터 접수를 시작해 ${end}에 마감합니다.`;
  if (left === 0) return `오늘이 마감일입니다. ${end}까지 접수합니다.`;
  if (left !== null && left > 0) return `${end}까지 접수합니다. 오늘 기준 ${left}일 남았습니다.`;
  return `${end}까지 접수합니다.`;
}

/**
 * 머리글 아래 요약. 문단을 나눠 돌려준다.
 *
 * 예전에는 세 문장을 한 덩어리로 이어 붙였다. 화면에서는 열 줄짜리 벽이
 * 됐고, 가운데에 원문을 90자에서 자른 조각까지 끼어 있었다. 그 조각은
 * "▤ 주택기준 : … 4억원 이하 - 전세전환가액입니다" 처럼 문장 중간에서
 * 끊긴 채 "입니다" 만 붙어 나왔다.
 *
 * 지원 내용은 아래 "지원내용" 칸에서 GovText 가 줄을 살려 제대로 보여
 * 준다. 여기서 또 자를 이유가 없다 — 뺀다. 원문에 구조가 없고 짧을
 * 때만 한 줄로 옮긴다.
 */
export function programIntro(p: Detail): string[] {
  const where = p.sigungu || p.sido || "전국";
  const w = who(p);
  const target = w.length ? `${w.join(", ")} 대상` : "해당 조건을 갖춘 분";

  // "수원시에서 경기도이 운영하는" 이었다. 조사가 받침을 안 보고 "이" 로
  // 굳어 있었고(경기도 → 경기도가), 곳과 기관을 겹쳐 적어 어색했다.
  // 기관이 곳과 같으면 한 번만 적는다.
  const org = p.org_name?.trim();
  const runBy =
    !org || org === where
      ? `${josa(where, "이가")} 운영하는`
      : `${josa(org, "이가")} ${where}에서 운영하는`;

  // 예전에는 "…으로" 를 붙여 놓아 "노인 복지으로" 가 나왔다.
  const out = [`${josa(p.title, "은는")} ${runBy} ${josa(topicKeyword(p), "으로")}, ${target}입니다.`];

  // 아래에서 제대로 보여 주는 원문을 여기서 또 자르지 않는다.
  const raw = p.benefit_text ?? p.summary;
  if (raw && !hasStructure(raw)) {
    const benefit = clip(raw, 90).replace(/[.\s]+$/, "");
    // 원문이 이미 온전한 문장이면("…지원합니다") 그대로 둔다. 앞에
    // "지원 내용은" 을 붙이고 뒤에 "입니다" 를 또 붙이면
    // "지원 내용은 …지원합니다입니다" 가 된다.
    if (benefit) out.push(/(다|함|음|됨|임)$/.test(benefit) ? `${benefit}.` : `지원 내용은 ${benefit}입니다.`);
  }

  out.push(period(p));
  return out;
}

/**
 * "기준 중위소득 180% 이하" 뒤에 붙일 금액 보기.
 *
 * 퍼센트만 적힌 문장은 아무것도 알려 주지 않는다. 흔한 가구 크기 몇 개만
 * 금액으로 보여 준다. 올해 고시 표가 없으면 아무 말도 하지 않는다 —
 * 낡은 금액을 적느니 안 적는 편이 낫다.
 */
function incomeExample(pct: number) {
  const year = tableYear();
  if (year === null) return "";
  const parts = [1, 2, 4]
    .map((n) => {
      const m = standardFor(n, pct, year);
      return m === null ? null : `${n}인 가구 월 ${manwon(m)}`;
    })
    .filter(Boolean);
  return parts.length ? ` ${year}년 기준으로 ${parts.join(", ")} 정도입니다.` : "";
}

/** "이런 분이 해당됩니다" 점검 목록. */
export function programChecks(p: Detail) {
  const out: string[] = [];
  const where = p.sigungu || p.sido;
  if (where) out.push(`${where}에 주소를 두고 있다`);
  const age = ageLabel(p);
  if (age) out.push(`나이가 ${age}에 해당한다`);
  if (p.income_pct) out.push(`가구 소득이 기준 중위소득 ${p.income_pct}% 이하다`);
  for (const h of p.household ?? []) out.push(`${h} 가구다`);
  for (const e of p.employment ?? []) out.push(`현재 ${e} 상태다`);
  for (const b of p.biz_target ?? []) out.push(`${josa(b, "이가")} 운영하는 사업체다`);
  if (p.biz_years_min !== null || p.biz_years_max !== null)
    out.push(`업력이 ${p.biz_years_min ?? 0}년${p.biz_years_max !== null ? `~${p.biz_years_max}년` : " 이상"}이다`);
  return out.slice(0, 6);
}

/** 신청 전에 챙길 것. 원문에 없더라도 늘 맞는 말만. */
export function programBeforeApply(p: Detail) {
  const items = [
    "공고 원문의 소득·재산 기준을 확인합니다. 화면에 담기지 않은 요건이 남아 있을 수 있습니다.",
    "신분증, 주민등록등본, 통장 사본은 대부분의 사업에서 공통으로 요구합니다.",
  ];
  if (p.kind === "business") items.push("사업자등록증과 최근 재무 자료, 4대보험 가입자 명부를 준비합니다.");
  else items.push("같은 성격의 다른 지원과 중복 수급이 제한될 수 있으니 이미 받는 것이 있으면 문의처에 먼저 확인합니다.");
  if (!p.is_always_on && p.apply_end) items.push("접수 마감일 전에 서류를 갖춰야 합니다. 마감 당일은 창구가 붐빕니다.");
  return items;
}

/** 자주 묻는 질문. 답은 전부 필드에서 나온다. */
export function programFaq(p: Detail): QA[] {
  const where = p.sigungu || p.sido || "전국";
  const w = who(p);
  const out: QA[] = [];
  out.push({
    q: `${p.title}은 누가 신청할 수 있나요?`,
    a: w.length
      ? `${where}에 거주하는 ${w.join(", ")}이 대상입니다. ${clip(p.target_text, 120) || "세부 자격은 공고 원문에서 확인하세요."}`
      : clip(p.target_text, 160) || `${where} 거주자 가운데 공고에 적힌 조건을 갖춘 분입니다. 원문에서 세부 자격을 확인하세요.`,
  });
  out.push({
    q: "소득 기준이 있나요?",
    a: p.income_pct
      ? `네. 가구 소득이 기준 중위소득 ${p.income_pct}% 이하여야 합니다.${incomeExample(p.income_pct)} 다만 실제 심사는 연봉이 아니라 재산까지 환산해 더한 소득인정액으로 하므로, 경계선이라면 주민센터나 복지로에서 확인하세요.`
      : "화면에 추려진 소득 기준은 없습니다. 다만 원문에 재산·소득 요건이 있을 수 있으니 신청 전에 확인하세요.",
  });
  out.push({
    q: "언제까지 신청해야 하나요?",
    // period() 가 마침표까지 붙여 돌려준다. 여기서 또 붙이면 "남았습니다.." 가 된다.
    a: `${period(p)} 현재 상태는 '${STATUS_LABEL[applyStatus(p)]}'입니다.`,
  });
  out.push({
    q: "어디서 어떻게 신청하나요?",
    a: clip(p.apply_method, 160) || (p.kind === "business"
      ? "기업마당 공고 원문의 접수처(주관 기관 누리집 또는 이메일)로 신청합니다."
      : `관할 주민센터(행정복지센터) 방문 또는 복지로 온라인 신청이 일반적입니다. 원문에서 접수처를 확인하세요.`),
  });
  out.push({
    q: "다른 지원금과 같이 받을 수 있나요?",
    a: "성격이 다른 지원(예: 현금 수당과 요금 감면)은 대개 함께 받을 수 있지만, 같은 목적의 지원은 중복이 제한되는 경우가 많습니다. 공고의 '중복 수급' 항목을 보거나 문의처에 확인하세요.",
  });
  if (p.contact) out.push({ q: "문의는 어디로 하나요?", a: `${p.dept_name || p.org_name || "담당 기관"} ${p.contact}` });
  return out;
}

/** 지역 화면의 자주 묻는 질문. */
export function areaFaq(sido: string, a: Area): QA[] {
  return [
    { q: `${sido} 청년지원금은 어디서 찾나요?`, a: `이 화면에서 나이를 넣고 조회하면 ${sido}의 청년 대상 사업 ${a.youth}건이 남습니다. 도(시) 사업과 시·군·구 사업이 따로 있으니 시·군·구까지 넣어 보세요.` },
    { q: `${sido} 복지서비스는 신청해야만 받나요?`, a: "대부분 그렇습니다. 자격이 있어도 신청하지 않으면 지급되지 않습니다. 주민센터 방문이나 복지로 온라인 신청이 일반적이고, 공고마다 접수처가 적혀 있습니다." },
    { q: "어르신·저소득 가구 지원도 같이 볼 수 있나요?", a: `네. ${sido}에는 어르신 대상 ${a.senior}건, 저소득 가구 대상 ${a.low_income}건, 장애인 대상 ${a.disabled}건이 있습니다. 조회 화면에서 가구 사정을 고르면 그것만 남습니다.` },
    { q: "여기 나온 사업이 전부인가요?", a: "복지로와 기업마당에 공개된 공고를 매일 새벽 모은 것입니다. 기관 홈페이지에만 올라오는 사업은 공공기관 화면에서 따로 볼 수 있고, 최종 확인은 원문에서 하셔야 합니다." },
  ];
}
