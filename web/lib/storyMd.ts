import type { Block } from "./stories";

/**
 * 블로그 글 본문(blog_posts.body 의 블록 배열)과 마크다운 사이를 오간다(2026-11-15).
 * 관리자 편집기(app/admin/BlogPanel.tsx)가 쓴다. 사람은 마크다운으로 쓰고, 저장할 때 블록으로 바꾼다.
 * 화면은 예전 그대로 블록을 그린다(components/StoryBody.tsx) — 편집기로 쓴 글과 자동 글의 모양이 같다.
 *
 * 알아듣는 것
 *   ## 소제목            → h2 (id 는 s1, s2 … 차례로. 따로 주려면 "## 제목 {#id}")
 *   빈 줄로 나뉜 문단    → p   (**굵게**, [글자](주소) 는 문단 안에서 그대로 쓴다)
 *   - 항목               → list
 *   | 가 | 나 | 표       → table (둘째 줄은 |---|---| 구분선)
 *   > 참고               → note (작은 글씨 안내)
 *   ![설명](/img/…)      → img  (바로 아랫줄 *출처* 는 캡션)
 *   :::links … :::       → links (안에 "- [글자](주소)" 줄)
 *   :::bars 단위 … :::   → bars  (안에 "- 이름: 숫자" 줄)
 *   :::summary 제목 … :::→ summary (글머리 핵심 정리 상자. 안에 "- 한 줄" 들)
 *   :::steps … :::       → steps   (번호 붙은 단계. 안에 "- 한 단계" 들)
 *   :::faq … :::         → faq     (안에 "Q. 질문" 줄과 그 아래 "A. 답" 줄)
 * 목차(toc)는 적지 않는다. 소제목이 셋 이상이면 저장할 때 첫 소제목 앞에 자동으로 넣는다.
 */

const cell = (c: string) => c.replace(/\|/g, "\\|").replace(/\n/g, " ");
const row = (cells: string[]) => `| ${cells.map(cell).join(" | ")} |`;

export function blocksToMd(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "toc":
        break;
      case "h2":
        out.push(`## ${b.text}${/^s\d+$/.test(b.id) ? "" : ` {#${b.id}}`}`);
        break;
      case "p":
        out.push(b.text);
        break;
      case "note":
        out.push(b.text.split("\n").map((l) => `> ${l}`).join("\n"));
        break;
      case "list":
        out.push(b.items.map((t) => `- ${t.replace(/\n/g, " ")}`).join("\n"));
        break;
      case "table":
        out.push([row(b.head), row(b.head.map(() => "---")), ...b.rows.map(row)].join("\n"));
        break;
      case "links":
        out.push([":::links", ...b.items.map((l) => `- [${l.label}](${l.href})`), ":::"].join("\n"));
        break;
      case "bars":
        out.push([`:::bars${b.unit ? ` ${b.unit}` : ""}`, ...b.items.map((x) => `- ${x.label}: ${x.n}`), ":::"].join("\n"));
        break;
      case "img":
        out.push(`![${b.alt}](${b.src})${b.caption ? `\n*${b.caption}*` : ""}`);
        break;
      case "summary":
        out.push([`:::summary${b.title ? ` ${b.title}` : ""}`, ...b.items.map((t) => `- ${t.replace(/\n/g, " ")}`), ":::"].join("\n"));
        break;
      case "steps":
        out.push([":::steps", ...b.items.map((t) => `- ${t.replace(/\n/g, " ")}`), ":::"].join("\n"));
        break;
      case "faq":
        out.push([":::faq", ...b.items.flatMap((x) => [`Q. ${x.q.replace(/\n/g, " ")}`, `A. ${x.a.replace(/\n/g, " ")}`]), ":::"].join("\n"));
        break;
    }
  }
  return out.join("\n\n");
}

// "\|" 는 칸 안의 세로줄이다. 뒤돌아보기 정규식(옛 사파리에 없다) 대신 잠깐 다른 글자로 바꿔 두고 나눈다.
const splitRow = (l: string) =>
  l.trim().replace(/\\\|/g, "\u0000").replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim().replace(/\u0000/g, "|"));
const isSep = (l: string) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l.trim());
const startsBlock = (l: string) => /^(#{1,6}\s|[-*]\s|>\s?|\||!\[|:::)/.test(l);

export function mdToBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  const used = new Set<string>();
  let i = 0, h = 0;

  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }

    // 소제목. "# 제목" 한 줄은 글 제목 칸이 따로 있어 본문에서는 소제목으로 받는다.
    const hm = l.match(/^#{1,2}\s+(.*)$/);
    if (hm) {
      const idm = hm[1].match(/\s*\{#([A-Za-z0-9_-]+)\}\s*$/);
      const text = (idm ? hm[1].slice(0, idm.index) : hm[1]).trim();
      let id = idm ? idm[1] : "";
      if (!id || used.has(id)) { do { h++; id = `s${h}`; } while (used.has(id)); }
      used.add(id);
      if (text) blocks.push({ type: "h2", text, id });
      i++; continue;
    }
    // 더 작은 제목(###)은 굵은 문단으로.
    const sm = l.match(/^#{3,6}\s+(.*)$/);
    if (sm) { blocks.push({ type: "p", text: `**${sm[1].trim().replace(/\*\*/g, "")}**` }); i++; continue; }

    // :::links / :::bars
    // :::summary / :::steps / :::faq — 제도 안내 글의 틀(2026-11-26).
    const gm = l.match(/^:::(summary|steps|faq)\s*(.*)$/);
    if (gm) {
      const inner: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ":::") { if (lines[i].trim()) inner.push(lines[i].trim()); i++; }
      i++; // 닫는 :::
      if (gm[1] === "faq") {
        const items: { q: string; a: string }[] = [];
        for (const x of inner) {
          const q = x.match(/^Q[.:)]\s*(.+)$/i), a = x.match(/^A[.:)]\s*(.+)$/i);
          if (q) items.push({ q: q[1].trim(), a: "" });
          else if (items.length) items[items.length - 1].a += (items[items.length - 1].a ? " " : "") + (a ? a[1] : x).trim();
        }
        const ok = items.filter((x) => x.q && x.a);
        if (ok.length) blocks.push({ type: "faq", items: ok });
      } else {
        const items = inner.map((x) => x.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, "").trim()).filter(Boolean);
        if (items.length) blocks.push(gm[1] === "summary" ? { type: "summary", items, ...(gm[2].trim() ? { title: gm[2].trim() } : {}) } : { type: "steps", items });
      }
      continue;
    }

    const fm = l.match(/^:::(links|bars)\s*(.*)$/);
    if (fm) {
      const inner: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ":::") { if (lines[i].trim()) inner.push(lines[i].trim().replace(/^[-*]\s+/, "")); i++; }
      i++; // 닫는 :::
      if (fm[1] === "links") {
        const items = inner.map((x) => x.match(/^\[([^\]]+)\]\(([^)]+)\)$/)).filter((m): m is RegExpMatchArray => !!m)
          .map((m) => ({ label: m[1], href: m[2].trim() }));
        if (items.length) blocks.push({ type: "links", items });
      } else {
        const items = inner.map((x) => x.match(/^(.*):\s*([\d,.]+)$/)).filter((m): m is RegExpMatchArray => !!m)
          .map((m) => ({ label: m[1].trim(), n: Number(m[2].replace(/,/g, "")) })).filter((x) => Number.isFinite(x.n));
        if (items.length) blocks.push({ type: "bars", items, ...(fm[2].trim() ? { unit: fm[2].trim() } : {}) });
      }
      continue;
    }

    // 사진
    const im = l.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/);
    if (im) {
      const cap = lines[i + 1]?.match(/^\*([^*].*)\*\s*$/);
      blocks.push({ type: "img", alt: im[1], src: im[2], ...(cap ? { caption: cap[1] } : {}) });
      i += cap ? 2 : 1; continue;
    }

    // 참고
    if (/^>\s?/.test(l)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "").trim()); i++; }
      const text = buf.filter(Boolean).join(" ");
      if (text) blocks.push({ type: "note", text });
      continue;
    }

    // 목록
    if (/^[-*]\s+/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, "").replace(/^\[[ xX]\]\s*/, "").trim()); i++; }
      blocks.push({ type: "list", items: items.filter(Boolean) });
      continue;
    }

    // 표
    if (/^\|/.test(l) && lines[i + 1] !== undefined && isSep(lines[i + 1])) {
      const head = splitRow(l);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        const r = splitRow(lines[i]);
        // 칸 수를 머리줄에 맞춘다. 모자라면 빈 칸, 넘치면 마지막 칸에 붙인다.
        rows.push(r.length >= head.length ? [...r.slice(0, head.length - 1), r.slice(head.length - 1).join(" | ")] : [...r, ...Array(head.length - r.length).fill("")]);
        i++;
      }
      blocks.push({ type: "table", head, rows });
      continue;
    }

    // 문단: 빈 줄이나 다른 블록이 시작되는 줄까지.
    const buf: string[] = [l.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) { buf.push(lines[i].trim()); i++; }
    blocks.push({ type: "p", text: buf.join(" ") });
  }

  // 목차: 소제목이 셋 이상이면 첫 소제목 앞에.
  const heads = blocks.filter((b): b is Extract<Block, { type: "h2" }> => b.type === "h2");
  if (heads.length >= 3) {
    const at = blocks.findIndex((b) => b.type === "h2");
    blocks.splice(at, 0, { type: "toc", items: heads.map((x) => ({ id: x.id, label: x.text.replace(/^\d+\.\s*/, "") })) });
  }
  return blocks;
}

/** 저장 전 점검. 문제가 있으면 사람 말로 돌려준다. */
export function checkBlocks(blocks: Block[]): string | null {
  if (!blocks.length) return "본문이 비어 있습니다.";
  if (!blocks.some((b) => b.type === "p")) return "본문에 문단이 하나는 있어야 합니다.";
  for (const b of blocks) {
    if (b.type === "table" && !b.rows.length) return "표에 줄이 없습니다. 머리줄·구분선(|---|---|) 아래에 내용을 적어 주세요.";
    if (b.type === "img" && !/^(\/|https:\/\/)/.test(b.src)) return `사진 주소는 /img/… 나 https:// 로 시작해야 합니다: ${b.src}`;
  }
  return null;
}
