// 연관어 사전과 채용 거르기. "경비" 로 찾으면 경호·보안·방호가 같이 걸려야 한다.
import { expandTerms, expansions, relatedTerms, suggest } from "../lib/thesaurus.ts";
import { filterJobs, jobTermsUsed } from "../lib/jobFilter.ts";

let bad = 0;
const check = (name, ok, extra = "") => { if (!ok) { bad++; console.log("FAIL", name, extra); } else console.log("ok  ", name); };

const e = expandTerms("경비");
check("경비 → 경호·보안·방호", ["경호", "보안", "방호"].every((t) => e.includes(t)), e.join(","));
check("경비 첫 자리는 자기 자신", e[0] === "경비");
check("경비원도 경비 묶음", expandTerms("경비원").includes("경호"));
check("기간제교사 → 교사·공무직 둘 다", expandTerms("기간제교사").includes("강사") && expandTerms("기간제교사").includes("무기계약직"));
check("모르는 말은 그대로", expandTerms("ㅁㄴㅇㄹ").length === 1);
check("한 글자는 안 넓힘", expandTerms("경").length === 1);
check("열둘을 넘지 않음", expandTerms("복지").length <= 12);

const r = relatedTerms(["경비"]);
check("연관 검색어에 자기 자신은 없음", !r.includes("경비") && r.includes("경호"), r.join(","));
check("expansions 는 넓힌 낱말만", expansions(["경비", "ㅁㄴㅇㄹ"]).length === 1);

const s = suggest("경");
check("추천: 앞글자 일치가 먼저", s.length > 0 && s[0].t.startsWith("경"), s.map((x) => x.t).join(","));
check("추천: 꼬리표 있음", s.every((x) => x.tag));
check("추천: 빈 입력은 없음", suggest("").length === 0);

const mk = (title, org = "기관", sectors = null) => ({
  id: title, title, org, region: "서울", hire: null, recruit: null, sectors, headcount: null,
  start: null, end: null, reg: null, url: null, status: "ongoing",
});
const jobs = [
  mk("청원경찰 채용 공고"), mk("특수경비원 모집"), mk("보안관제 요원 채용"), mk("무도실무관 채용"),
  mk("기간제 교사 채용"), mk("시설관리원 채용"), mk("경호원 채용", "경찰청"),
];
const got = filterJobs(jobs, { q: "경비" }).map((j) => j.title);
check("경비 로 거르면 경호·보안·청원경찰까지", ["청원경찰 채용 공고", "특수경비원 모집", "보안관제 요원 채용", "경호원 채용"].every((t) => got.includes(t)) && !got.includes("기간제 교사 채용"), got.join(" | "));
check("낱말 둘은 AND", filterJobs(jobs, { q: "경호 경찰청" }).length === 1);
check("빈 검색어는 전부", filterJobs(jobs, { q: "" }).length === jobs.length);
const used = jobTermsUsed(filterJobs(jobs, { q: "경비" }), "경비");
check("실제 쓰인 연관어만", used.includes("경호") && used.includes("보안") && used.includes("청원경찰") && !used.includes("방호"), used.join(","));
check("쓰인 연관어 없으면 빈 배열", jobTermsUsed(filterJobs(jobs, { q: "교사" }), "교사").length === 0, jobTermsUsed(filterJobs(jobs, { q: "교사" }), "교사").join(","));

console.log(bad ? `${bad} failed` : "all passed");
process.exit(bad ? 1 : 0);
