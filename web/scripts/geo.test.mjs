// 자리 찾기. 시·군·구 이름 → 좌표, 채용 공고 기관명 → 시·군·구.
import { findSgg, haversineKm, locate, locateJob, normSido } from "../lib/geo.ts";

let bad = 0;
const check = (name, ok, extra = "") => { if (!ok) { bad++; console.log("FAIL", name, extra); } else console.log("ok  ", name); };
const near = (p, lat, lng, tol = 0.6) => p && Math.abs(p.lat - lat) < tol && Math.abs(p.lng - lng) < tol;

check("서울 관악구", near(locate("서울특별시", "관악구"), 37.47, 126.95, 0.1) && !locate("서울특별시", "관악구").approx);
check("전남광주 광산구(광주 쪽 코드)", near(locate("전남광주통합특별시", "광산구"), 35.16, 126.8, 0.15));
check("전남광주 순천시(전남 쪽 코드)", near(locate("전남광주통합특별시", "순천시"), 35.0, 127.35, 0.3));
check("대구 군위군(2023 편입)", near(locate("대구광역시", "군위군"), 36.17, 128.65, 0.2));
check("인천 미추홀구(옛 남구 이름표)", near(locate("인천광역시", "미추홀구"), 37.46, 126.65, 0.1));
check("인천 영종구(2026 신설, 손으로)", near(locate("인천광역시", "영종구"), 37.49, 126.53, 0.1));
check("구가 있는 시는 하나로(수원시)", near(locate("경기도", "수원시"), 37.28, 127.01, 0.1));
check("시군구 모르면 시·도 가운데(approx)", locate("경기도", "-")?.approx === true && locate("경기도", "경기도교육청")?.approx === true);
check("시·도도 모르면 null(전국)", locate(null, null) === null && locate("경기@대전", null) === null);
check("옛 시·도 이름", normSido("전라남도") === "전남광주통합특별시" && normSido("광주광역시") === "전남광주통합특별시" && normSido("강원도") === "강원특별자치도" && normSido("전라북도") === "전북특별자치도");
const km = haversineKm([37.5665, 126.978], [35.1796, 129.0756]);
check("서울→부산 직선거리 약 325km", km > 310 && km < 340, String(km));

const j = (org, title = "채용 공고", region = null) => locateJob({ org, title, region });
check("기관명의 시군구: 인천광역시 연수구", j("인천광역시 연수구", "채용", "인천광역시")?.sigungu === "연수구");
check("힌트 없이도 유일한 이름이면", j("서울특별시 서대문구")?.sigungu === "서대문구");
check("시·도만 있으면 그 가운데(approx)", j("경기도교육청 두원공업고등학교", "채용", "경기도")?.approx === true && j("경기도교육청 두원공업고등학교", "채용", "경기도")?.sido === "경기도");
check("줄기 + 대학교: 국립군산대학교 → 군산시", j("국립군산대학교 지원시설 학생생활관")?.sigungu === "군산시");
check("줄기 + 지원: 수원지방법원 안산지원 → 안산시", j("대법원 수원지방법원 안산지원")?.sigungu === "안산시");
check("영양관리는 영양군이 아니다", j("인천광역시 연수구", "지방임기제공무원(영양관리 전담요원) 경력경쟁임용시험 공고", "인천광역시")?.sigungu === "연수구");
check("역량 강화는 강화군이 아니다", j("보건복지부", "역량 강화 사업 기간제근로자 채용")?.sigungu == null);
check("고령자는 고령군이 아니다", j("고용노동부", "고령자 고용지원 기간제 채용") === null || j("고용노동부", "고령자 고용지원 기간제 채용")?.sigungu == null);
check("수영 강사는 수영구가 아니다", j("부산광역시체육회", "수영 강사 채용", "부산광역시")?.sigungu == null);
check("광주시청 + 경기 힌트 → 경기 광주시", j("광주시청", "채용", "경기도")?.sigungu === "광주시" && j("광주시청", "채용", "경기도")?.sido === "경기도");
check("광주광역시 북구 → 전남광주 북구", j("광주광역시 북구")?.sigungu === "북구" && j("광주광역시 북구")?.sido === "전남광주통합특별시");
check("중구만 있고 힌트 없으면 못 고른다", findSgg("중구 보건소", null) === null);
check("중구 + 대전 힌트", findSgg("중구 보건소", "대전광역시")?.sido === "대전광역시");
check("남양주는 양주가 아니다", j("남양주시청")?.sigungu === "남양주시");
check("중앙부처는 null", j("통일부") === null);
check("옛 region 이름의 채용", j("전라남도 나주시", "채용", "전라남도")?.sido === "전남광주통합특별시" && j("전라남도 나주시", "채용", "전라남도")?.sigungu === "나주시");
check("마산우체국: 시군구 없음·시도 없음 → null", j("과학기술정보통신부 우정사업본부 부산지방우정청 마산우체국") === null || j("과학기술정보통신부 우정사업본부 부산지방우정청 마산우체국")?.sigungu == null);

console.log(bad ? `${bad} failed` : "all passed");
process.exit(bad ? 1 : 0);
