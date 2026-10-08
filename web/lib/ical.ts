/**
 * 일정을 개인 캘린더로.
 *
 * 구글 캘린더는 주소 하나로 "일정 추가" 화면이 열린다(가입·API 없음). 애플·
 * 아웃룩·네이버는 .ics 파일을 받아 열면 된다. 둘 다 하루 단위 일정으로 만든다 —
 * 공고에 시각은 없고, 마감일에 종일 표시되는 편이 놓치지 않는다.
 */
export type CalEvent = {
  title: string;
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD. 없으면 하루. */
  end?: string | null;
  details?: string;
  location?: string;
  url?: string;
};

const ymd = (s: string) => s.replace(/-/g, "");

/** iCalendar 의 종일 일정은 끝 날짜가 "다음 날"이다(배타). 10/16 하루 → DTEND 10/17. */
function nextDay(s: string) {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function span(e: CalEvent) {
  const end = e.end && e.end >= e.start ? e.end : e.start;
  return { start: ymd(e.start), endExclusive: ymd(nextDay(end)) };
}

export function gcalUrl(e: CalEvent): string {
  const { start, endExclusive } = span(e);
  const sp = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${start}/${endExclusive}` });
  const details = [e.details, e.url].filter(Boolean).join("\n\n");
  if (details) sp.set("details", details);
  if (e.location) sp.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${sp}`;
}

const esc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** 75옥텟 접기(RFC 5545). 한글은 한 글자가 3옥텟이라 글자 수가 아니라 옥텟으로 센다. */
const octets = (c: string) => { const n = c.charCodeAt(0); return n < 0x80 ? 1 : n < 0x800 ? 2 : 3; };
function fold(line: string) {
  const out: string[] = [];
  let cur = "", bytes = 0;
  for (const c of line) {
    const b = octets(c);
    if (bytes + b > 74) { out.push(cur); cur = " "; bytes = 1; }
    cur += c; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n");
}

function uid(e: CalEvent, i: number) {
  let h = 5381;
  for (const c of `${e.title}|${e.start}|${e.url ?? ""}`) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return `${h.toString(16)}-${i}@jiwon.knowhow-it.com`;
}

export function icsText(events: CalEvent[], calName = "K나라지원 일정"): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//K나라지원//jiwon.knowhow-it.com//KO",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(calName)}`, "X-WR-TIMEZONE:Asia/Seoul",
  ];
  events.forEach((e, i) => {
    const { start, endExclusive } = span(e);
    lines.push("BEGIN:VEVENT", `UID:${uid(e, i)}`, `DTSTAMP:${stamp}`,
               `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${endExclusive}`, `SUMMARY:${esc(e.title)}`);
    const d = [e.details, e.url].filter(Boolean).join("\n");
    if (d) lines.push(`DESCRIPTION:${esc(d)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** 파일 이름에 못 쓰는 글자를 뺀다. */
export const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "일정";
