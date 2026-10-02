// 읍·면·동 자리(lib/dong.ts): 동 이름이 든 공고만 동에 붙는가, 가까운 동·센터, 범위 안 자리.
import { dongInText, dongsOf, nearestOf, placesIn } from "../lib/dong.ts";
import { sggChoices } from "../lib/geo.ts";

let bad = 0;
const check = (name, ok, extra = "") => { if (!ok) { bad++; console.log("FAIL", name, extra); } else console.log("ok  ", name); };

const siheung = dongsOf("경기도", "시흥시");
check("시흥시 읍·면·동이 있다", siheung.length >= 15, String(siheung.length));
check("정왕1동은 행정복지센터 자리", siheung.some((d) => d.dong === "정왕1동" && d.hall && /행정복지센터|주민센터/.test(d.hall)));
const suwon = dongsOf("경기도", "수원시");
check("구가 있는 시: 수원시 아래 구 이름", suwon.some((d) => d.gu === "장안구") && suwon.some((d) => d.gu === "영통구"));

// 시·군·구가 없거나 OSM 경계가 없는 곳
check("세종은 '세종시' 한 칸", dongsOf("세종특별자치시", "세종시").some((d) => d.dong === "조치원읍"));
const sgp = dongsOf("제주특별자치도", "서귀포시");
check("제주: 서귀포시 칸에 중문동·대정읍", sgp.some((d) => d.dong === "중문동") && sgp.some((d) => d.dong === "대정읍"));
check("제주: 한림읍은 제주시(오타 '한립읍' 바로잡음)", dongsOf("제주특별자치도", "제주시").some((d) => d.dong === "한림읍" && d.hall));
check("제주: 경계 이름 '일도이동'은 센터 이름 일도2동으로", dongsOf("제주특별자치도", "제주시").some((d) => d.dong === "일도2동"));
check("법정동 경계(부평구 갈산동)는 빠진다", !dongsOf("인천광역시", "부평구").some((d) => d.dong === "갈산동"));
// 인천 이름: 좌표표의 옛 이름(남구)으로 물어도 미추홀구, 없어진 구는 고르기에 없다
check("인천 남구로 물어도 미추홀구 동", dongsOf("인천광역시", "남구").some((d) => d.dong === "주안1동"));
const ic = sggChoices("인천광역시");
check("인천 고르기: 미추홀구·제물포구 있고 중구·남구 없음", ic.includes("미추홀구") && ic.includes("제물포구") && !ic.includes("중구") && !ic.includes("남구"), ic.join(","));

// 동에 붙이기
check("제목 맨 앞의 동 이름", dongInText("경기도", "시흥시", "정왕본동 어르신 반찬 나눔")?.dong === "정왕본동");
check("붙여 쓴 센터 이름", dongInText("경기도", "시흥시", "정왕1동행정복지센터 기간제 채용")?.dong === "정왕1동");
check("읍·면·동 행정복지센터(어느 동인지 없음)는 안 붙는다", dongInText("경기도", "시흥시", "주소지 읍·면·동 행정복지센터 방문 신청") === null);
check("다른 시·군·구의 동 이름은 안 본다", dongInText("경기도", "시흥시", "정자1동 행정복지센터") === null);
check("동 둘이 걸리면 고르지 않는다", dongInText("경기도", "시흥시", "정왕1동 정왕2동 합동 행사") === null);
check("감면·중동 같은 말은 동이 아니다", dongInText("경기도", "부천시", "중동 수출 기업 감면") === null);

// 가까운 동·센터
const near = nearestOf(37.3448, 126.7341); // 시흥 정왕동 일대
check("가까운 동은 시흥시 정왕 쪽", near.dong?.sgg === "시흥시" && /정왕|배곧/.test(near.dong?.dong ?? ""), JSON.stringify(near.dong?.dong));
check("가까운 센터 거리 3km 안", (near.hall?.km ?? 99) < 3, String(near.hall?.km));
check("바다 한가운데는 없음", nearestOf(36.0, 124.6).dong === null);
check("넓은 동: 센터 앞이면 그 동(제주 중문동)", nearestOf(33.253, 126.434).dong?.dong === "중문동", JSON.stringify(nearestOf(33.253, 126.434).dong?.dong));

// 범위 안 자리
const box = placesIn({ s: 37.33, w: 126.70, n: 37.40, e: 126.83 }); // 시흥시청(126.80)까지
check("시흥 일대 범위에 센터·청사가 있다", box.length >= 8 && box.some((p) => p.office), String(box.length));
const many = placesIn({ s: 37.4, w: 126.8, n: 37.7, e: 127.2 }, 50);
check("많으면 가운데에서 가까운 limit 개", many.length === 50);

if (bad) { console.log(`\n${bad}건 실패`); process.exit(1); }
console.log("\n모두 통과");
