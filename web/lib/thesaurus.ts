/**
 * 연관어 사전. "경비"를 치면 "경호·보안·방호"도 같이 찾고, 결과 위에
 * 연관 검색어로 보여 준다.
 *
 * keywords.ts 의 SYNONYMS 는 복지 공고 본문을 거르는 데 맞춘 묶음이라 좁다.
 * 여기는 그 위에 채용 직무·대상·자격 묶음을 더한 것으로, 통합 검색과 채용
 * 목록, 검색창 추천에 쓴다. LLM 은 쓰지 않는다 — 같은 말이면 같은 결과.
 *
 * 묶음 안의 말은 서로 연관어다. 찾는 낱말이 묶음의 어느 말을 품거나 그 말에
 * 품기면 그 묶음이 걸린다("경비원" → 경비 묶음).
 */
import { SYNONYMS } from "./keywords";
import { TOPICS } from "./topics";

const JOB_GROUPS: string[][] = [
  ["경비", "경호", "보안", "방호", "청원경찰", "경비원", "방범", "시설경비", "특수경비"],
  ["시설관리", "시설관리원", "설비", "영선", "기계설비", "전기설비", "시설직"],
  ["간호", "간호사", "간호조무사", "보건", "방문간호", "보건직"],
  ["요양", "요양보호사", "돌봄", "생활지원사", "장기요양", "돌봄사"],
  ["조리", "조리사", "조리원", "급식", "영양사", "식당", "조리실무사"],
  ["운전", "운전원", "운전기사", "차량", "운수", "버스기사", "운행"],
  ["청소", "환경미화", "미화", "미화원", "환경관리", "환경실무원", "위생"],
  ["사무", "사무보조", "행정", "사무원", "행정보조", "행정지원", "사무직", "행정사무"],
  ["교사", "교원", "기간제교사", "강사", "시간강사", "교육공무직", "특수교사", "담임"],
  ["사서", "도서관", "사서보조", "도서"],
  ["상담", "상담사", "상담원", "심리상담", "복지상담", "상담직"],
  ["사회복지", "사회복지사", "복지", "복지관", "복지사", "주민센터"],
  ["전산", "정보화", "개발자", "프로그래머", "데이터", "소프트웨어", "정보시스템", "정보보호", "전산직"],
  ["회계", "경리", "재무", "세무", "회계원", "회계직"],
  ["연구", "연구원", "연구사", "박사", "석사", "연구직", "연구보조"],
  ["안전", "산업안전", "안전관리자", "소방", "방재", "안전보건"],
  ["농업", "농촌", "영농", "농림", "농기계", "축산", "농업기술"],
  ["체육", "생활체육", "스포츠", "수영", "체육지도자", "트레이너"],
  ["통역", "번역", "외국어", "영어", "다문화", "이중언어"],
  ["보육", "보육교사", "어린이집", "유치원", "돌봄교사", "아이돌봄"],
  ["환경", "환경관리", "폐기물", "재활용", "수질", "대기"],
  ["건축", "토목", "시공", "건설", "감리", "설계", "건축직"],
  ["의료", "의사", "약사", "임상", "물리치료", "병원", "보건소", "치료사"],
  ["인턴", "청년인턴", "체험형", "채용형", "인턴십"],
  ["공무직", "무기계약직", "공무직근로자", "기간제", "계약직", "임기제", "기간제근로자"],
  ["주차", "주차관리", "주차관리원", "주차장"],
  ["경영", "기획", "총무", "인사", "홍보", "마케팅"],
  ["무도", "무도실무관", "호송", "교정", "보호관찰"],
  ["자격증", "국가자격", "기능사", "기사", "산업기사", "기술사", "자격"],
  ["청년", "청년층", "대학생", "사회초년생", "2030"],
  ["노인", "어르신", "고령", "시니어", "경로", "노년"],
  ["장애", "장애인", "중증장애", "활동지원"],
  ["소상공인", "자영업", "자영업자", "소공인", "점포", "가게"],
  ["한부모", "조손", "미혼모", "싱글맘"],
  ["다자녀", "셋째", "다둥이"],
  ["신혼", "신혼부부", "예비신혼", "결혼"],
];

export const GROUPS: string[][] = [...JOB_GROUPS, ...SYNONYMS];

const clean = (w: string) => w.replace(/\s+/g, "").toLowerCase();

/** 낱말이 든 묶음들. "경비원" 은 경비 묶음에, "기간제교사" 는 교사·공무직 묶음에. */
function groupsOf(word: string): string[][] {
  const w = clean(word);
  if (w.length < 2) return [];
  return GROUPS.filter((g) => g.some((s) => {
    const c = clean(s);
    return c === w || (c.length >= 2 && (w.includes(c) || c.includes(w)));
  }));
}

/** 찾을 말 전부: 낱말 자신 + 연관어. 채용 제목처럼 짧은 글을 OR 로 뒤질 때 쓴다. */
export function expandTerms(word: string): string[] {
  const out = [word];
  for (const g of groupsOf(word)) for (const s of g) if (!out.includes(s)) out.push(s);
  return out.slice(0, 12);
}

/** 화면에 보일 연관 검색어. 낱말 자신은 빼고, 가까운 묶음 순으로. */
export function relatedTerms(words: string[], max = 10): string[] {
  const seen = new Set(words.map(clean));
  const out: string[] = [];
  for (const w of words) {
    for (const g of groupsOf(w)) {
      for (const s of g) {
        const c = clean(s);
        if (seen.has(c)) continue;
        seen.add(c); out.push(s);
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}

/**
 * 낱말 하나하나를 넓힌 결과를 한눈에. 화면에 "‘경비’ → 경호·보안·방호도 함께"
 * 라고 적을 때 쓴다. 넓힌 것이 없는 낱말은 빠진다.
 */
export function expansions(words: string[]): { word: string; also: string[] }[] {
  return words
    .map((w) => ({ word: w, also: expandTerms(w).slice(1) }))
    .filter((x) => x.also.length > 0);
}

/** 검색창 추천에 쓰는 낱말 목록. 코드에 적힌 것만 — 서버를 부르지 않는다. */
export type Vocab = { t: string; tag: string };
export const VOCAB: Vocab[] = (() => {
  const seen = new Set<string>();
  const out: Vocab[] = [];
  const add = (t: string, tag: string) => { const c = clean(t); if (c.length >= 2 && !seen.has(c)) { seen.add(c); out.push({ t, tag }); } };
  for (const g of JOB_GROUPS) for (const s of g) add(s, "채용·직무");
  for (const g of SYNONYMS) for (const s of g) add(s, "지원금");
  for (const t of TOPICS) { add(t.name, "분야"); add(t.key, "분야"); }
  for (const s of ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"]) add(s, "지역");
  return out;
})();

/** 입력 중인 글에 맞는 추천. 앞글자 일치가 먼저, 그다음 포함. */
export function suggest(q: string, max = 7): Vocab[] {
  const c = clean(q);
  if (c.length < 1) return [];
  const starts = VOCAB.filter((v) => clean(v.t).startsWith(c));
  const includes = VOCAB.filter((v) => !clean(v.t).startsWith(c) && clean(v.t).includes(c));
  return [...starts, ...includes].slice(0, max);
}
