// 캘린더 주소와 .ics 파일.
import { fileSafe, gcalUrl, icsText } from "../lib/ical.ts";

let bad = 0;
const check = (name, ok, extra = "") => { if (!ok) { bad++; console.log("FAIL", name, extra); } else console.log("ok  ", name); };

const e = { title: "청년미래적금 2차 신청 마감", start: "2026-10-16", details: "월 50만원, 3년", url: "https://jiwon.knowhow-it.com/blog/youth-future-savings", location: "온라인" };
const u = gcalUrl(e);
check("구글: 하루짜리는 다음 날이 끝", u.includes("dates=20261016%2F20261017"), u);
check("구글: 제목·설명·장소", u.includes("text=%EC%B2%AD%EB%85%84") && u.includes("details=") && u.includes("location="));
const u2 = gcalUrl({ title: "접수", start: "2026-10-01", end: "2026-10-10" });
check("구글: 기간은 끝 다음 날", u2.includes("dates=20261001%2F20261011"), u2);
const u3 = gcalUrl({ title: "x", start: "2026-10-10", end: "2026-10-01" });
check("구글: 끝이 앞서면 하루로", u3.includes("dates=20261010%2F20261011"));

const ics = icsText([e, { title: "a; b, c", start: "2026-11-01", end: "2026-11-03" }]);
check("ics: 겉모양", ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.trimEnd().endsWith("END:VCALENDAR") && ics.includes("VERSION:2.0"));
check("ics: 종일 일정", ics.includes("DTSTART;VALUE=DATE:20261016") && ics.includes("DTEND;VALUE=DATE:20261017"));
check("ics: 기간", ics.includes("DTSTART;VALUE=DATE:20261101") && ics.includes("DTEND;VALUE=DATE:20261104"));
check("ics: 쉼표·세미콜론 이스케이프", ics.includes("SUMMARY:a\\; b\\, c"));
check("ics: UID 둘", (ics.match(/^UID:/gm) ?? []).length === 2);
const bytes = (l) => Buffer.byteLength(l, "utf8");
check("ics: 줄 접기(75옥텟 넘는 줄 없음)", ics.split("\r\n").every((l) => bytes(l) <= 75), String(Math.max(...ics.split("\r\n").map(bytes))));
check("ics: 접은 줄을 펴면 URL 이 그대로", ics.replace(/\r\n /g, "").includes("URL:https://jiwon.knowhow-it.com/blog/youth-future-savings"));
check("ics: 한글 제목도 접힌다", ics.replace(/\r\n /g, "").includes("SUMMARY:청년미래적금 2차 신청 마감"));
check("파일 이름", fileSafe("a/b:c*d?") === "a b c d" && fileSafe("") === "일정");

console.log(bad ? `${bad} failed` : "all passed");
process.exit(bad ? 1 : 0);
