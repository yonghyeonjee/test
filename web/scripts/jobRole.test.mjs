// 실제 나라일터 제목으로 직무·단계·세부 분야 읽기를 확인한다.
import { detectRole, detailOf, stageOf } from "../lib/jobRole.ts";

const cases = [
  ["인천송림초등학교 기간제 교사 (5,6학년 영어전담교사)채용 공고(3차 자격확대)", "teacher-temp", "open", "5,6학년 영어전담교사"],
  ["2026학년도 인천여자상업고등학교 시간강사(상업) 채용 공고", "lecturer", "open", "상업"],
  ["2026년 임신 사전건강관리사업 기간제근로자(간호사) 채용", "nurse", "open", "간호사"],
  ["[광주보호관찰소] 2026년 제1회 공무직근로자(무도실무관) 채용 서류전형 합격자 및 면접시험 일정 공고", "martial", "interview", "무도실무관"],
  ["2026년 국립서울문화유산연구소 공무직근로자(사서, 안전관리원) 채용 공고", "librarian", "open", "사서, 안전관리원"],
  ["진실화해를위한과거사정리위원회 별정직공무원(고위나급~7급상당) 최종합격자 공고", "term-official", "final", "고위나급~7급상당"],
  ["2026년 하반기 국토교통부(서울지방국토관리청) 청년인턴 최종합격자 공고", "intern", "final", "서울지방국토관리청"],
  ["2026년도 제11회 포항우체국 상시계약집배원 채용시험 공고", "postal", "open", null],
  ["광주지방고용노동청전주지청 기간제근로자(통계조사관) 채용 공고", "survey", "open", "통계조사관"],
  ["2026년 울산광역시 직원식당 기간제근로자(조리원) 채용시험 계획 재공고", "cook", "repost", "조리원"],
  ["대전청사관리소 공무직(환경실무원 / 미화Ⅱ) 대체 기간제 근로자 채용 공고", "cleaning", "open", "환경실무원 / 미화Ⅱ"],
  ["대구광역시 임기제공무원 경력경쟁임용시험 공고(건축구조 분야)", "term-official", "open", "건축구조 분야"],
  ["2026년 제4회 강릉시 임기제공무원 임용시험 공고(보건소 관리의사, 아동학대 전담인력)", "doctor", "open", "보건소 관리의사, 아동학대 전담인력"],
  ["전남대학교 국제협력과 교육공무원(조교) 공개채용 공고", "ta", "open", "조교"],
  ["한경국립대학교 학군단운영요원(교관) 채용 공고", "military", "open", "교관"],
  ["2026년 제3회 국립부곡병원 약무직 공무원 경력경쟁채용시험 2차 재공고", "pharma", "repost", null],
  ["2026년 제4회 창원시의회 한시임기제공무원 임용시험 계획 공고", "term-official", "plan", null],
  ["인천광역시청소년활동진흥센터 채용 공고", "youth", "open", null, "인천광역시청소년활동진흥센터"],
  ["2026년 세종학당재단 하반기 무기계약직, 일반계약직 채용 공고", "public-worker", "open", null],
  ["OOO 기관 인력 모집", null, "open", null],
];
let bad = 0;
for (const [title, wantRole, wantStage, wantDetail, org = null] of cases) {
  const r = detectRole(title, org)?.key ?? null, s = stageOf(title), d = detailOf(title);
  if (r !== wantRole || s !== wantStage || d !== wantDetail) {
    bad++;
    console.log("FAIL", title, "\n   got", r, s, JSON.stringify(d), "\n  want", wantRole, wantStage, JSON.stringify(wantDetail));
  }
}
console.log(bad ? `${bad}건 실패` : `직무 읽기 OK — ${cases.length}건 모두 통과`);
process.exit(bad ? 1 : 0);
