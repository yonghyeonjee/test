"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import StoryBody from "@/components/StoryBody";
import type { Block } from "@/lib/stories";
import { blocksToMd, checkBlocks, mdToBlocks } from "@/lib/storyMd";
import { deleteBlogPost, getBlogPost, listBlogPosts, saveBlogPost, type BlogListRow } from "./actions";

/**
 * 블로그 글 편집기(2026-11-15). 목록에서 골라 고치거나 새로 쓴다.
 * 왼쪽에 마크다운, 오른쪽에 실제 글과 같은 모양의 미리보기. 저장하면 블록으로 바뀌어 blog_posts 에 들어간다.
 */
const KINDS: [string, string][] = [
  ["case", "실제 사례(사람이 쓴 글 · 검색에 내놓음)"],
  ["guide", "제도 안내(공식 발표를 확인해 쓰는 글 · 검색에 내놓음)"],
  ["org", "기관별 채용"], ["role", "직무별 채용"], ["license", "자격증 시험"],
  ["topic", "지원 주제(noindex)"], ["region", "지역 현황(noindex)"], ["sigungu", "시·군·구 현황(noindex)"], ["daily", "주간 채용 브리핑(noindex)"],
];

type Form = {
  slug: string; kind: string; subject: string; title: string; summary: string; keywords: string; published_at: string; md: string;
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
const EMPTY: Form = { slug: "", kind: "case", subject: "", title: "", summary: "", keywords: "", published_at: "", md: "" };

const SNIPPETS: { label: string; title: string; text: string; wrap?: [string, string] }[] = [
  { label: "소제목", title: "소제목(목차에 들어갑니다)", text: "\n\n## 소제목\n\n" },
  { label: "굵게", title: "고른 글자를 굵게", text: "**굵게**", wrap: ["**", "**"] },
  { label: "링크", title: "고른 글자에 링크", text: "[글자](/주소)", wrap: ["[", "](/주소)"] },
  { label: "목록", title: "목록", text: "\n\n- 첫째\n- 둘째\n- 셋째\n\n" },
  { label: "표", title: "표", text: "\n\n| 구분 | 내용 |\n| --- | --- |\n| 가 | 나 |\n| 다 | 라 |\n\n" },
  { label: "참고", title: "작은 글씨 안내", text: "\n\n> 참고로 적을 말\n\n" },
  { label: "사진", title: "사진(사이트 안 경로)", text: "\n\n![사진 설명](/img/story/파일.jpg)\n*출처*\n\n" },
  { label: "링크 묶음", title: "관련 글 묶음", text: "\n\n:::links\n- [글 제목](/story/주소)\n- [글 제목](/story/주소)\n:::\n\n" },
];

export default function BlogPanel() {
  const [rows, setRows] = useState<BlogListRow[]>([]);
  const [all, setAll] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  const [view, setView] = useState<"both" | "write" | "preview">("both");
  const [pending, start] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);

  const reload = (everything = all) =>
    start(async () => {
      const r = await listBlogPosts(!everything);
      if (r.error) setMsg({ ok: false, text: r.error });
      setRows(r.rows);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(false); }, []);

  const blocks = useMemo<Block[]>(() => (form ? mdToBlocks(form.md) : []), [form]);
  const problem = form ? checkBlocks(blocks) : null;
  const chars = form ? form.md.replace(/\s+/g, "").length : 0;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const open = (slug: string) =>
    start(async () => {
      setMsg(null); setAskDelete(false);
      const r = await getBlogPost(slug);
      if (!r.post) { setMsg({ ok: false, text: r.error ?? "글을 읽지 못했습니다." }); return; }
      const p = r.post;
      setIsNew(false);
      setForm({
        slug: p.slug, kind: p.kind, subject: p.subject, title: p.title, summary: p.summary,
        keywords: (p.keywords ?? []).join(", "), published_at: String(p.published_at).slice(0, 10), md: blocksToMd(p.body as Block[]),
      });
    });

  const fresh = () => { setMsg(null); setAskDelete(false); setIsNew(true); setForm({ ...EMPTY, published_at: today() }); };

  const insert = (s: (typeof SNIPPETS)[number]) => {
    const el = area.current;
    if (!el || !form) return;
    const a = el.selectionStart, b = el.selectionEnd;
    const picked = form.md.slice(a, b);
    const text = s.wrap && picked ? `${s.wrap[0]}${picked}${s.wrap[1]}` : s.text;
    const next = form.md.slice(0, a) + text + form.md.slice(b);
    set("md", next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + text.length; });
  };

  const save = () => {
    if (!form) return;
    if (problem) { setMsg({ ok: false, text: problem }); return; }
    start(async () => {
      const r = await saveBlogPost({
        slug: form.slug, kind: form.kind, subject: form.subject, title: form.title, summary: form.summary,
        keywords: form.keywords.split(","), body: blocks, published_at: form.published_at, isNew,
      });
      if (r.error) { setMsg({ ok: false, text: r.error }); return; }
      setMsg({ ok: true, text: `저장했습니다. /story/${form.slug.trim()}` });
      setIsNew(false);
      reload();
    });
  };

  const remove = () => {
    if (!form) return;
    start(async () => {
      const r = await deleteBlogPost(form.slug);
      if (r.error) { setMsg({ ok: false, text: r.error }); return; }
      setMsg({ ok: true, text: `지웠습니다: ${form.title}` });
      setForm(null); setAskDelete(false);
      reload();
    });
  };

  const input = "w-full rounded-ctl border border-line px-3.5 py-2 text-sm outline-none focus:border-brand";

  return (
    <section className="card mt-4 scroll-mt-14 p-5" aria-labelledby="blog-admin-h">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="blog-admin-h" className="text-sm font-bold">블로그 글</h2>
        <span className="text-xs text-faint">마크다운으로 쓰고, 오른쪽 미리보기 그대로 저장됩니다</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={fresh} className="btn btn-primary px-4 py-2 text-[13.5px]">새 글 쓰기</button>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={all} onChange={(e) => { setAll(e.target.checked); reload(e.target.checked); }} />
          자동으로 만든 글도 보기
        </label>
      </div>

      <ul className="mt-3 max-h-64 divide-y divide-line overflow-y-auto rounded-ctl border border-line">
        {rows.length === 0 && <li className="px-3 py-3 text-sm text-muted">{pending ? "불러오는 중…" : "글이 없습니다."}</li>}
        {rows.map((r) => (
          <li key={r.slug}>
            <button type="button" onClick={() => open(r.slug)}
                    className={`flex w-full items-baseline gap-3 px-3 py-2.5 text-left text-sm hover:bg-ground ${form?.slug === r.slug && !isNew ? "bg-brandSoft/50" : ""}`}>
              <span className="min-w-0 flex-1 truncate font-semibold">{r.title}</span>
              <span className="shrink-0 text-xs text-faint">{r.kind}</span>
              <time className="num shrink-0 text-xs text-muted" dateTime={String(r.published_at).slice(0, 10)}>{String(r.published_at).slice(0, 10)}</time>
            </button>
          </li>
        ))}
      </ul>

      {msg && <p role="status" className={`mt-3 rounded-ctl px-3 py-2 text-[13px] ${msg.ok ? "bg-brandSoft text-brand" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      {form && (
        <form className="mt-5 border-t border-line pt-5" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <h3 className="text-[15px] font-bold">{isNew ? "새 글" : "글 고치기"}</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="bp-title" className="block text-xs font-bold text-muted">제목</label>
              <input id="bp-title" value={form.title} onChange={(e) => set("title", e.target.value)} className={`mt-1 ${input}`} required />
              <p className="mt-1 text-xs text-faint">검색 결과에 그대로 나옵니다. 다른 글과 겹치지 않는 낱말을 앞에 두세요. {form.title.length}자</p>
            </div>
            <div>
              <label htmlFor="bp-slug" className="block text-xs font-bold text-muted">글 주소</label>
              <div className="mt-1 flex items-center gap-1 text-sm">
                <span className="shrink-0 text-faint">/story/</span>
                <input id="bp-slug" value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} className={input}
                       readOnly={!isNew} aria-describedby="bp-slug-h" placeholder="jeonse-loan-guide" required />
              </div>
              <p id="bp-slug-h" className="mt-1 text-xs text-faint">{isNew ? "영문 소문자·숫자·하이픈. 저장한 뒤에는 바꿀 수 없습니다." : "주소는 바꾸지 않습니다(검색엔진에 알려진 주소)."}</p>
            </div>
            <div>
              <label htmlFor="bp-date" className="block text-xs font-bold text-muted">발행일</label>
              <input id="bp-date" type="date" value={form.published_at} onChange={(e) => set("published_at", e.target.value)} className={`mt-1 ${input}`} required />
              <p className="mt-1 text-xs text-faint">내일 날짜를 넣으면 그날부터 보입니다.</p>
            </div>
            <div>
              <label htmlFor="bp-kind" className="block text-xs font-bold text-muted">갈래</label>
              <select id="bp-kind" value={form.kind} onChange={(e) => set("kind", e.target.value)} className={`mt-1 ${input}`}>
                {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="bp-subject" className="block text-xs font-bold text-muted">글감(짧게)</label>
              <input id="bp-subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} className={`mt-1 ${input}`} placeholder="전세대출 갈아타기 절차" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="bp-summary" className="block text-xs font-bold text-muted">요약</label>
              <textarea id="bp-summary" value={form.summary} onChange={(e) => set("summary", e.target.value)} rows={2} className={`mt-1 ${input}`} required />
              <p className="mt-1 text-xs text-faint">목록과 검색 결과의 설명문입니다. 80~160자가 알맞습니다. {form.summary.length}자</p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="bp-kw" className="block text-xs font-bold text-muted">핵심 낱말</label>
              <input id="bp-kw" value={form.keywords} onChange={(e) => set("keywords", e.target.value)} className={`mt-1 ${input}`} placeholder="전세대출 거절, 잔금일 대출 실행" />
              <p className="mt-1 text-xs text-faint">쉼표로 나눠 12개까지.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-bold text-muted">본문</span>
            {SNIPPETS.map((s) => (
              <button key={s.label} type="button" title={s.title} onClick={() => insert(s)} className="chip !py-1 !text-[12.5px]">{s.label}</button>
            ))}
            <span className="ml-auto inline-flex overflow-hidden rounded-pill border border-line text-xs" role="group" aria-label="보기 방식">
              {([["write", "쓰기"], ["both", "나란히"], ["preview", "미리보기"]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                        className={`px-3 py-1 ${view === v ? "bg-ink text-white" : "text-ink2 hover:bg-ground"}`}>{l}</button>
              ))}
            </span>
          </div>

          <div className={`mt-2 grid gap-4 ${view === "both" ? "lg:grid-cols-2" : ""}`}>
            {view !== "preview" && (
              <div>
                <label htmlFor="bp-md" className="sr-only">본문(마크다운)</label>
                <textarea id="bp-md" ref={area} value={form.md} onChange={(e) => set("md", e.target.value)} spellCheck={false}
                          className="h-[32rem] w-full resize-y rounded-ctl border border-line p-3.5 font-mono text-[13.5px] leading-relaxed outline-none focus:border-brand"
                          placeholder={"첫 문단은 글 전체를 한두 문장으로.\n\n## 소제목\n\n문단은 빈 줄로 나눕니다. **굵게**, [링크](/story/주소).\n\n- 목록\n- 목록\n\n| 구분 | 내용 |\n| --- | --- |\n| 가 | 나 |\n\n> 작은 글씨 안내"} />
                <p className="mt-1 text-xs text-faint">
                  글자 {chars.toLocaleString()}자 · 소제목 {blocks.filter((b) => b.type === "h2").length}개
                  {blocks.filter((b) => b.type === "h2").length >= 3 ? " · 목차 자동" : ""}
                </p>
              </div>
            )}
            {view !== "write" && (
              <div className="rounded-ctl border border-line bg-surface p-4 lg:max-h-[34rem] lg:overflow-y-auto" aria-label="미리보기">
                <p className="text-xs font-bold text-muted">미리보기</p>
                <h1 className="article-title mt-2 text-[1.5rem] leading-[1.3]">{form.title || "제목"}</h1>
                {blocks.length ? <StoryBody blocks={blocks} /> : <p className="mt-4 text-sm text-muted">본문을 쓰면 여기에 실제 글 모양으로 보입니다.</p>}
              </div>
            )}
          </div>

          {problem && <p className="mt-3 text-[13px] text-red-700">{problem}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="submit" disabled={pending} className="btn btn-primary px-5 py-2.5 text-[14px]">{pending ? "저장 중…" : isNew ? "발행" : "고친 내용 저장"}</button>
            <button type="button" onClick={() => { setForm(null); setAskDelete(false); }} className="btn btn-ghost px-4 py-2.5 text-[14px]">닫기</button>
            {!isNew && <a href={`/story/${form.slug}`} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-brand underline underline-offset-4">글 보기 ↗</a>}
            {!isNew && (
              <span className="ml-auto flex items-center gap-2">
                {askDelete ? (
                  <>
                    <span className="text-[13px] text-red-700">정말 지울까요? 되돌릴 수 없습니다.</span>
                    <button type="button" onClick={remove} disabled={pending} className="rounded-pill bg-red-600 px-4 py-2 text-[13px] font-bold text-white">지우기</button>
                    <button type="button" onClick={() => setAskDelete(false)} className="btn btn-ghost px-3 py-2 text-[13px]">취소</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setAskDelete(true)} className="text-[13px] text-red-700 underline underline-offset-4">이 글 지우기</button>
                )}
              </span>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
