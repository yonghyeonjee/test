import { NextResponse } from "next/server";
import { HELPER_JOB_INTENT, HELPER_YIELD, helperTerms, matchFaq } from "@/lib/helperFaq";
import { unifiedSearch, type SectionKey } from "@/lib/search";

/**
 * 응답 도우미의 답(2026-11-27). 물어본 한 줄을 받아
 *   1) 정해진 질문에 가까우면 그 질문의 번호를 돌려주고(답 글은 화면이 갖고 있다),
 *   2) 아니면 군말을 떼고 통합 검색(lib/search)으로 찾아 갈래별로 몇 건씩 돌려준다.
 * 글을 지어내지 않는다. 돌려주는 것은 사이트에 실제로 있는 공고의 제목과 주소뿐이다.
 */
export const dynamic = "force-dynamic";

type Item = { href: string; title: string; sub: string };
type Sec = { key: SectionKey; label: string; total: number; href: string; items: Item[] };

const PER = 4;
const md = (d: string | null | undefined) => (d ? `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))} 마감` : null);
const join = (xs: (string | null | undefined | false)[]) => xs.filter(Boolean).join(" · ");
const HEAD = { "Cache-Control": "private, max-age=60", "X-Robots-Tag": "noindex" };

export async function GET(req: Request) {
  const text = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (text.length < 2) return NextResponse.json({ kind: "empty" }, { headers: HEAD });

  const faq = matchFaq(text);
  const terms = helperTerms(text);
  if (faq && !(HELPER_YIELD.has(faq.id) && terms)) return NextResponse.json({ kind: "faq", faq: faq.id }, { headers: HEAD });
  if (!terms) return NextResponse.json({ kind: "empty" }, { headers: HEAD });

  const more = `/search?q=${encodeURIComponent(terms)}`;
  try {
    const r = await unifiedSearch(terms);
    const all: Record<SectionKey, Sec> = {
      jobs: {
        key: "jobs", label: r.jobs.items.some((j) => j.open) ? "접수 중인 채용 공고" : "지난 채용 공고", total: r.jobs.total || r.jobs.items.length, href: r.jobs.href,
        items: r.jobs.items.slice(0, PER).map((j) => ({
          href: `/jobs/${encodeURIComponent(j.id)}`, title: j.title, sub: join([j.org, j.open ? md(j.end) : "마감"]),
        })),
      },
      welfare: {
        key: "welfare", label: "지원사업", total: r.welfare.total, href: r.welfare.href,
        items: r.welfare.items.slice(0, PER).map((p) => ({
          href: `/p/${encodeURIComponent(p.source_id)}`, title: p.title,
          sub: join([p.sigungu || p.sido || "전국", p.is_always_on ? "상시 접수" : md(p.apply_end)]),
        })),
      },
      business: {
        key: "business", label: "기업·창업 지원사업", total: r.business.total, href: r.business.href,
        items: r.business.items.slice(0, PER).map((p) => ({
          href: `/p/${encodeURIComponent(p.source_id)}`, title: p.title,
          sub: join([p.org_name, p.is_always_on ? "상시 접수" : md(p.apply_end)]),
        })),
      },
      licenses: {
        key: "licenses", label: "자격증", total: r.licenses.total, href: r.licenses.href,
        items: r.licenses.items.slice(0, PER).map((l) => ({
          href: `/license/${encodeURIComponent(l.code)}`, title: l.name, sub: join([l.series, l.field]),
        })),
      },
      guides: {
        key: "guides", label: "안내 글", total: r.guides.length, href: more,
        items: r.guides.slice(0, PER).map((g) => ({ href: g.href, title: g.title, sub: g.tag })),
      },
      agency: { key: "agency", label: "공공기관 사업", total: 0, href: r.agency.href, items: [] },
    };
    // 채용을 물었으면 채용부터. 나머지는 검색이 정한 순서.
    const order = HELPER_JOB_INTENT.test(text) ? (["jobs", ...r.order.filter((k) => k !== "jobs")] as SectionKey[]) : r.order;
    const sections = order.map((k) => all[k]).filter((s) => s.items.length > 0).slice(0, 3);
    if (!sections.length) return NextResponse.json({ kind: "none", terms, bits: r.bits, more, faq: faq?.id ?? null }, { headers: HEAD });
    return NextResponse.json({ kind: "search", terms, bits: r.bits, sections, more }, { headers: HEAD });
  } catch (e) {
    console.warn("[ask]", e instanceof Error ? e.message : e);
    return NextResponse.json({ kind: "error", terms, more }, { headers: HEAD });
  }
}
