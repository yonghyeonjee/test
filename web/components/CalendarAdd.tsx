"use client";

import { useEffect, useRef, useState } from "react";
import { fileSafe, gcalUrl, icsText, type CalEvent } from "@/lib/ical";
import Glyph from "./Glyph";
import { track } from "./Gtm";

/**
 * 일정을 개인 캘린더에 담는 단추.
 *
 * 구글 캘린더는 링크 하나로 "일정 만들기" 화면이 열린다. 애플·아웃룩·네이버는
 * .ics 파일을 받아 열면 된다(구글도 설정 → 가져오기로 올릴 수 있다).
 *
 *  - 일정이 하나면 단추 둘을 나란히.
 *  - 여럿이면 펼침 목록(날짜마다 구글 / .ics)과 "전부 .ics".
 *  - bulk 는 "앞으로 남은 회차 전부" 같은 큰 묶음 — .ics 하나만.
 */
export default function CalendarAdd({
  events, label = "캘린더에 담기", size = "md", file, bulk = false, className = "",
}: {
  events: CalEvent[];
  label?: string;
  size?: "sm" | "md";
  /** 내려받는 파일 이름(확장자 없이). */
  file?: string;
  bulk?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  if (!events.length) return null;
  const name = fileSafe(file ?? events[0].title);
  const btn = size === "sm" ? "btn btn-ghost !px-2.5 !py-1 !text-[12.5px]" : "btn btn-ghost px-3 py-1.5 text-[13px]";

  const download = (evs: CalEvent[]) => {
    const blob = new Blob([icsText(evs)], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    track("calendar_add", { how: "ics", n: evs.length });
    setOpen(false);
  };
  const google = (e: CalEvent) => {
    track("calendar_add", { how: "google", n: 1 });
    window.open(gcalUrl(e), "_blank", "noopener");
    setOpen(false);
  };

  if (bulk) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <button type="button" onClick={() => download(events)} className={btn}>
          <Glyph name="calendar" className="mr-1 h-4 w-4" />{label} <span className="num ml-1 text-muted">{events.length}개 (.ics)</span>
        </button>
        <span className="text-[12px] text-faint">구글 캘린더는 설정 → 가져오기에서 이 파일을 올리면 됩니다.</span>
      </div>
    );
  }

  if (events.length === 1) {
    const e = events[0];
    return (
      <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
        <a href={gcalUrl(e)} target="_blank" rel="noopener noreferrer" className={btn}
           onClick={() => track("calendar_add", { how: "google", n: 1 })}>
          <Glyph name="calendar" className="mr-1 h-4 w-4" />구글 캘린더
        </a>
        <button type="button" onClick={() => download([e])} className={btn} title="애플·아웃룩·네이버 캘린더">
          .ics 내려받기
        </button>
      </span>
    );
  }

  return (
    <div ref={box} className={`relative inline-block ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={btn}>
        <Glyph name="calendar" className="mr-1 h-4 w-4" />{label}
        <svg viewBox="0 0 20 20" className="ml-1 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 8l5 5 5-5" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-[calc(100%+6px)] z-30 w-[19rem] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-card border border-line bg-white shadow-lift">
          <ul className="max-h-72 divide-y divide-line overflow-y-auto">
            {events.map((e) => (
              <li key={`${e.start}-${e.title}`} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                <span className="min-w-0 flex-1">
                  <span className="num block text-[11.5px] text-faint">{e.start.replaceAll("-", ".")}{e.end && e.end !== e.start ? ` ~ ${e.end.replaceAll("-", ".")}` : ""}</span>
                  <span className="block truncate">{e.title}</span>
                </span>
                <button type="button" onClick={() => google(e)} className="shrink-0 font-bold text-brand hover:underline">구글</button>
                <button type="button" onClick={() => download([e])} className="shrink-0 text-muted hover:text-brand">.ics</button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => download(events)}
                  className="block w-full border-t border-line bg-surface2 px-3 py-2 text-left text-[13px] font-semibold text-ink2 hover:text-brand">
            전부 .ics 로 내려받기 <span className="num text-muted">{events.length}개</span>
          </button>
        </div>
      )}
    </div>
  );
}
