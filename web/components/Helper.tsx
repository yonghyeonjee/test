"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HELPER_CHIPS, HELPER_FAQ, type HelperLink } from "@/lib/helperFaq";

/**
 * 응답 도우미(2026-11-27). 오른쪽 아래 단추를 누르면 채팅 창이 열린다.
 *
 * 자주 묻는 질문은 정해진 답으로 바로 답하고, 그 밖에 적은 말은 군말을 떼고 사이트 검색으로 찾아
 * 공고 제목과 주소를 돌려준다(app/api/ask). 글을 지어내는 AI 가 아니다 — 공고의 자격·금액은 원문이 맞다.
 * 닫혀 있을 때는 단추 하나만 그린다. 대화는 창을 닫아도 그 화면에 있는 동안 남는다.
 */

type Item = { href: string; title: string; sub: string };
type Sec = { key: string; label: string; total: number; href: string; items: Item[] };
type Msg =
  | { role: "user"; text: string }
  | { role: "bot"; lines: string[]; links?: HelperLink[]; sections?: Sec[]; chips?: boolean; wait?: boolean };

type Ask =
  | { kind: "faq"; faq: string }
  | { kind: "search"; terms: string; bits: string[]; sections: Sec[]; more: string }
  | { kind: "none"; terms: string; bits: string[]; more: string; faq: string | null }
  | { kind: "error"; terms: string; more: string }
  | { kind: "empty" };

const faqMsg = (id: string): Msg | null => {
  const f = HELPER_FAQ.find((x) => x.id === id);
  return f ? { role: "bot", lines: f.a, links: f.links } : null;
};

function toMsg(a: Ask): Msg {
  if (a.kind === "faq") return faqMsg(a.faq) ?? { role: "bot", lines: ["답을 찾지 못했습니다."], chips: true };
  if (a.kind === "search") {
    const n = a.sections.reduce((s, x) => s + x.total, 0);
    const cond = a.bits.length ? ` (${a.bits.join(" · ")})` : "";
    return {
      role: "bot",
      lines: [`‘${a.terms}’${cond}로 찾았습니다. 모두 ${n.toLocaleString("ko-KR")}건 가운데 앞의 것만 보여 드립니다.`,
              "자격과 금액, 접수 방법은 공고 원문에서 확인하세요."],
      sections: a.sections, links: [{ href: a.more, label: "검색 결과 전체 보기" }],
    };
  }
  if (a.kind === "none") {
    const f = a.faq ? faqMsg(a.faq) : null;
    if (f && f.role === "bot") return { ...f, lines: [`‘${a.terms}’에 맞는 공고는 찾지 못했습니다.`, ...f.lines] };
    return {
      role: "bot",
      lines: [`‘${a.terms}’에 맞는 공고를 찾지 못했습니다.`, "낱말을 줄여서 다시 적어 보세요. 예: 간호사, 수원 공무직, 청년 월세"],
      links: [{ href: a.more, label: "통합 검색에서 다시 찾기" }, { href: "/jobs", label: "채용 공고 전체" }, { href: "/policies", label: "전체 정책" }],
    };
  }
  if (a.kind === "error") {
    return { role: "bot", lines: ["지금은 찾지 못했습니다. 잠시 뒤 다시 물어보시거나 통합 검색을 써 주세요."],
             links: [{ href: a.more, label: "통합 검색으로 가기" }] };
  }
  return { role: "bot", lines: ["찾는 직무·기관·지역이나 지원금 이름을 적어 주세요. 예: 간호사 채용, 수원 29세 월세, 정보처리기사"], chips: true };
}

export default function Helper() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  // 새 답의 첫 줄이 보이게. 끝으로 내리면 긴 답(공고 목록)은 앞머리가 위로 넘어가 버린다.
  useEffect(() => {
    const last = end.current?.previousElementSibling?.lastElementChild;
    if (last && msgs.length) last.scrollIntoView({ block: "start" });
  }, [msgs, open]);

  const push = (m: Msg) => setMsgs((xs) => [...xs.filter((x) => !(x.role === "bot" && x.wait)), m]);

  const pick = (id: string, q: string) => {
    setMsgs((xs) => [...xs, { role: "user", text: q }]);
    const m = faqMsg(id);
    if (m) push(m);
  };

  const ask = async (raw: string) => {
    const q = raw.trim().slice(0, 80);
    if (!q || busy) return;
    setText("");
    setBusy(true);
    setMsgs((xs) => [...xs, { role: "user", text: q }, { role: "bot", lines: ["찾는 중입니다…"], wait: true }]);
    try {
      const r = await fetch(`/api/ask?q=${encodeURIComponent(q)}`);
      push(toMsg(r.ok ? ((await r.json()) as Ask) : { kind: "error", terms: q, more: `/search?q=${encodeURIComponent(q)}` }));
    } catch {
      push(toMsg({ kind: "error", terms: q, more: `/search?q=${encodeURIComponent(q)}` }));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

  const chips = (
    <ul className="mt-3 flex flex-col items-start gap-2">
      {HELPER_CHIPS.map((f) => (
        <li key={f.id}>
          <button type="button" onClick={() => pick(f.id, f.q)}
                  className="rounded-pill border border-line bg-surface px-3.5 py-2 text-left text-[13.5px] font-semibold leading-snug text-brand shadow-sm transition-colors hover:border-brand">
            {f.q}
          </button>
        </li>
      ))}
    </ul>
  );

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="도우미에게 물어보기"
              title="도우미에게 물어보기"
              className="fixed bottom-20 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-pill bg-brand text-white shadow-lift transition-transform hover:-translate-y-0.5 sm:bottom-5 sm:right-[5.25rem]">
        {/* 2026-11-28 글자("물어보기")를 빼고 아이콘만. 이름은 aria-label·title 로 남긴다. */}
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" /><path d="M9 11h.01M12 11h.01M15 11h.01" />
        </svg>
      </button>
    );
  }

  return (
    <section role="dialog" aria-label="K나라지원 도우미"
             className="fixed inset-x-2 bottom-2 z-50 flex max-h-[min(40rem,calc(100dvh-1rem))] flex-col overflow-hidden rounded-[22px] border border-line bg-surface shadow-float
                        sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[38rem] sm:w-[24rem]">
      <header className="flex items-center justify-between gap-2 bg-brandSoft px-4 py-3">
        <b className="text-[15px] font-extrabold text-ink">K나라지원 도우미</b>
        <span className="flex items-center gap-1">
          {msgs.length > 0 && (
            <button type="button" onClick={() => setMsgs([])} className="rounded-pill px-2.5 py-1 text-[13px] font-semibold text-muted hover:text-ink">처음으로</button>
          )}
          <button type="button" onClick={() => setOpen(false)} aria-label="도우미 닫기" className="flex h-8 w-8 items-center justify-center rounded-pill text-ink2 hover:bg-surface">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
        {msgs.length === 0 ? (
          <div>
            <p className="text-[17px] leading-snug text-ink">무엇이든 물어보세요</p>
            <p className="text-[18px] font-extrabold leading-snug tracking-[-.02em] text-ink">채용·지원금 찾기 도우미</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">자주 묻는 질문 바로 답변 · 공고 찾아 드림 · 자격과 금액은 원문에서 확인</p>
            {chips}
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {msgs.map((m, i) => m.role === "user" ? (
              <li key={i} className="ml-8 self-end rounded-[16px] rounded-br-[4px] bg-brand px-3.5 py-2 text-[14px] leading-relaxed text-white">{m.text}</li>
            ) : (
              <li key={i} className="mr-4 self-start rounded-[16px] rounded-bl-[4px] bg-ground px-3.5 py-2.5 text-[14px] leading-relaxed text-ink2">
                {m.lines.map((l, j) => <p key={j} className={j ? "mt-1.5" : ""}>{l}</p>)}
                {m.sections?.map((s) => (
                  <div key={s.key} className="mt-3">
                    <p className="flex items-baseline justify-between gap-2 text-[12.5px] font-bold text-muted">
                      <span>{s.label} <span className="num">{s.total.toLocaleString("ko-KR")}건</span></span>
                      {s.total > s.items.length && <Link href={s.href} onClick={() => setOpen(false)} className="shrink-0 text-brand hover:underline">더 보기 ›</Link>}
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-1.5">
                      {s.items.map((it) => (
                        <li key={it.href}>
                          <Link href={it.href} onClick={() => setOpen(false)}
                                className="block rounded-[12px] border border-line bg-surface px-3 py-2 transition-colors hover:border-brand">
                            <b className="line-clamp-2 text-[13.5px] font-bold leading-snug text-ink break-keep">{it.title}</b>
                            {it.sub && <span className="num mt-0.5 block truncate text-[12px] text-muted">{it.sub}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {m.links && m.links.length > 0 && (
                  <p className="mt-2.5 flex flex-wrap gap-1.5">
                    {m.links.map((l) => (
                      <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                            className="rounded-pill border border-line bg-surface px-2.5 py-1 text-[12.5px] font-bold text-brand hover:border-brand">{l.label} ›</Link>
                    ))}
                  </p>
                )}
                {m.chips && chips}
              </li>
            ))}
          </ol>
        )}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void ask(text); }} className="border-t border-line bg-surface px-3 pb-3 pt-2.5">
        <div className="flex items-center gap-2 rounded-pill border border-line2 bg-surface pl-4 pr-1.5 focus-within:border-brand">
          {/* 16px: 아이폰이 입력칸에 초점을 줄 때 화면을 확대하지 않게. */}
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={80} enterKeyHint="send"
                 placeholder="직무·기관·지역이나 궁금한 점을 적어 주세요" aria-label="도우미에게 물어볼 말"
                 className="min-w-0 flex-1 bg-transparent py-2.5 text-[16px] text-ink outline-none placeholder:text-faint sm:text-[14.5px]" />
          <button type="submit" disabled={busy || !text.trim()} aria-label="보내기"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-brand text-white disabled:opacity-40">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 3L10 14M21 3l-7 18-4-8-8-4z" /></svg>
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11.5px] text-faint">정해진 답과 사이트 검색으로 답하는 자동 도우미입니다</p>
      </form>
    </section>
  );
}
