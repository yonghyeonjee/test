// 많이 찾는 말 집계. 기록 → 칩 목록.
import { landingLabel, orgLabel, rankHot, termLabel } from "../lib/hotRank.ts";

let bad = 0;
const check = (name, ok, extra = "") => { if (!ok) { bad++; console.log("FAIL", name, extra); } else console.log("ok  ", name); };

check("검색어 꼬리 떼기", termLabel("한국농어촌공사 채용") === "한국농어촌공사" && termLabel("보건복지부 채용공고") === "보건복지부" && termLabel("남양주 교육지원청 홈페이지") === "남양주 교육지원청");
check("짧거나 긴 말·숫자·영문은 버림", termLabel("a") === null && termLabel("토론토lmia 스폰") === null && termLabel("전주 통계청2026고용조사") === null && termLabel("x".repeat(13)) === null);
check("기관명은 끝 말", orgLabel("과학기술정보통신부 우정사업본부 경인지방우정청") === "경인지방우정청" && orgLabel("대법원 법원행정처") === "법원행정처" && orgLabel("한국농어촌공사") === "한국농어촌공사" && orgLabel("경기도 과천시") === "경기도 과천시");
check("착지: 기관별 채용", landingLabel("/jobs/org/%ED%95%9C%EA%B5%AD%EB%86%8D%EC%96%B4%EC%B4%8C%EA%B3%B5%EC%82%AC")?.label === "한국농어촌공사");
check("착지: 낱말 채용 검색", landingLabel("/jobs/q/%EA%B0%84%ED%98%B8%EC%82%AC")?.label === "간호사");
check("착지: 통합 검색", landingLabel("/search?q=%EC%8B%A0%ED%98%BC%EB%B6%80%EB%B6%80+%EC%A0%84%EC%84%B8")?.label === "신혼부부 전세");
check("착지: 공고 하나는 뺌", landingLabel("/p/WLF00001769") === null && landingLabel("/jobs/303491") === null && landingLabel("/admin") === null);

const visits = [];
for (let i = 0; i < 7; i++) visits.push({ term: "한국농어촌공사 채용", landing: "/jobs" });
for (let i = 0; i < 3; i++) visits.push({ term: "질병관리청 채용", landing: "/" });
for (let i = 0; i < 28; i++) visits.push({ term: null, landing: "/jobs/org/%ED%95%9C%EA%B5%AD%EB%86%8D%EC%96%B4%EC%B4%8C%EA%B3%B5%EC%82%AC" });
for (let i = 0; i < 12; i++) visits.push({ term: null, landing: "/blog/social-worker-license" });
visits.push({ term: "한번만 나온 말", landing: "/" });
visits.push({ term: null, landing: "/business/search?q=%EC%88%98%EC%B6%9C" }, { term: null, landing: "/business/search?q=%EC%88%98%EC%B6%9C" });
const searches = [];
for (let i = 0; i < 66; i++) searches.push({ kind: "welfare", household: ["저소득"], employment: null, biz_field: null, biz_target: null, entry: "form" });
for (let i = 0; i < 5; i++) searches.push({ kind: "welfare", household: ["무주택"], employment: null, biz_field: null, biz_target: null, entry: "policies" });
for (let i = 0; i < 10; i++) searches.push({ kind: "business", household: null, employment: null, biz_field: ["창업"], biz_target: null, entry: "form" });
const r = rankHot({ visits, searches });
check("복지: 저소득·농어촌공사가 앞", r.welfare[0] === "저소득" && r.welfare[1] === "한국농어촌공사", r.welfare.join(","));
check("복지: 정책 전체 클릭은 안 셈", !r.welfare.includes("무주택"));
check("복지: 한 번 나온 말은 없음", !r.welfare.includes("한번만 나온 말"));
check("복지: 기본 말로 채워 열 개", r.welfare.length === 10 && r.welfare.includes("경비"));
check("기업: 창업·수출", r.business[0] === "창업" && r.business.includes("수출"), r.business.join(","));
check("기업: 복지 말은 안 섞임", !r.business.includes("저소득"));
check("기록이 비면 기본 목록", rankHot({ visits: [], searches: [] }).fromLog === false && rankHot({ visits: [], searches: [] }).welfare.length === 10);

console.log(bad ? `${bad} failed` : "all passed");
process.exit(bad ? 1 : 0);
