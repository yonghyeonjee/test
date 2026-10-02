// 구글 채용 표시의 근무지·고용형태.
//   node --experimental-strip-types --import ./scripts/ts-resolve.mjs scripts/jobSchema.test.mjs
import { employmentFromTitle, jobLocation, sidoFromOrg } from "../lib/jobSchema.ts";

let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log("  ✗", m); } };
const job = (o) => ({ id: "1", title: "", org: null, region: null, hire: null, recruit: null, sectors: null, headcount: null, start: null, end: null, reg: null, url: null, status: "open", ...o });

ok(sidoFromOrg("부산광역시교육청") === "부산광역시", "부산광역시교육청");
ok(sidoFromOrg("과학기술정보통신부 우정사업본부 경인지방우정청 경기광주우체국") === "경기도", "경기광주우체국 → 경기도");
ok(sidoFromOrg("충북대학교병원") === "충청북도", "충북 → 충청북도");
ok(sidoFromOrg("방위사업청") === null, "방위사업청 → 없음");
ok(sidoFromOrg(null) === null, "null");

const a = jobLocation(job({ region: "서울특별시" }));
ok(a.address.addressRegion === "서울특별시" && a.address.addressCountry === "KR", "지역 있는 공고");
const b = jobLocation(job({ org: "방위사업청" }));
ok(b["@type"] === "Place" && b.address.addressCountry === "KR" && !("addressRegion" in b.address), "지역 모르면 나라만: " + JSON.stringify(b));
const c = jobLocation(job({ org: "보건복지부 국립춘천병원" }));
ok(c.address.addressRegion === "강원특별자치도", "춘천 → 강원? " + JSON.stringify(c));

ok(employmentFromTitle("2026년 제6차 직원(무기계약직-운영직(경비(보훈)·미화) 채용") === "FULL_TIME", "무기계약직");
ok(employmentFromTitle("기간제 공무직 근로자 채용 공고") === "TEMPORARY", "기간제 공무직은 기간제");
ok(employmentFromTitle("일반임기제공무원(7급) 채용") === "CONTRACTOR", "임기제");
ok(employmentFromTitle("2026년 체험형 청년인턴 모집") === "INTERN", "인턴");
ok(employmentFromTitle("시간선택제 임기제공무원 채용") === "PART_TIME", "시간선택제 우선");
ok(employmentFromTitle("학예연구사 채용 공고") === null, "모르면 null");

console.log(bad ? `jobSchema: ${bad}개 틀림` : "jobSchema: 모두 통과");
process.exit(bad ? 1 : 0);
