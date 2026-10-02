import type { Metadata } from "next";
import { withOg } from "@/lib/seo";
import Link from "next/link";
import ProgramEntry from "@/components/ProgramEntry";
import RelatedLinks from "@/components/RelatedLinks";
import { blogIndexRelated } from "@/lib/related";
import { SEARCH_SUGGEST, unifiedSearch, type JobHit } from "@/lib/search";

/**
 * 통합 검색. 머리말 검색창이 여기로 온다.
 *
 * 한 화면에 복지·기업·채용·자격증·공공기관·안내 글을 갈래별로 몇 건씩 보이고,
 * 갈래마다 "상세 검색"으로 이어 준다 — 거기서 지역·나이·고용형태 같은 조건을
 * 더 걸 수 있다. 여기서 알아들은 조건(지역·나이)은 그 링크에 그대로 실린다.
 *
 * 검색어마다 주소가 생기므로 색인은 막는다.
 */
export const dynamic = "force-dynamic";

type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v)?.trim() || "";

export function generateMetadata({ searchParams }: { searchParams: SP }): Metadata {
  const q = one(searchParams.q);
  return withOg({
    title: q ? `‘${q}’ 통합 검색` : "통합 검색",
    description: "복지·기업 지원사업, 공공기관 채용, 국가자격, 공공기관 사업, 안내 글을 한 번에 찾습니다.",
    robots: { index: false, follow: true },
  });
}

const H2 = "text-[1.0625rem] font-bold";

function Head({ title, n, href, hint }: { title: string; n: number; href: string; hint: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className={H2}>
        {title} <span className="num ml-1 text-sm font-semibold text-brand">{n.toLocaleString("ko-KR")}건</span>
      </h2>
      <Link href={href} className="text-[13px] text-muted underline underline-offset-4 hover:text-brand">
        {hint} →
      </Link>
    </div>
  );
}

function JobRow({ j }: { j: JobHit }) {
  return (
    <Link href={`/jobs/${encodeURIComponent(j.id)}`} className="card card-link block px-4 py-3">
      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
        <span className={`rounded-pill px-2 py-0.5 font-semibold ${j.open ? "bg-brandSoft text-brand" : "bg-ground text-muted"}`}>
          {j.open ? "접수 중" : "마감"}
        </span>
        {j.hire && <span className="text-muted">{j.hire}</span>}
        {j.end && <span className="num text-faint">~{j.end.slice(5).replace("-", ".")}</span>}
      </div>
      <b className="mt-1 block text-[15px] leading-snug">{j.title}</b>
      <p className="mt-0.5 text-[13px] text-muted">{[j.org, j.region].filter(Boolean).join(" · ")}</p>
    </Link>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const q = one(searchParams.q);
  const r = await unifiedSearch(q);
  const counts = [
    ["복지", r.welfare.total, "welfare"],
    ["기업", r.business.total, "business"],
    ["채용", r.jobs.total, "jobs"],
    ["안내 글", r.guides.length, "guides"],
    ["자격증", r.licenses.total, "licenses"],
    ["공공기관", r.agency.total, "agency"],
  ] as const;
  const grand = counts.reduce((a, c) => a + c[1], 0);

  return (
    <div className="py-4">
      <h1 className="text-[1.5rem] font-extrabold leading-tight">
        {q ? <>‘{q}’ 통합 검색</> : "통합 검색"}
      </h1>

      <form action="/search" method="get" className="mt-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="예) 충북 35세 육아, 간호사, 기능사, 수출"
               className="h-12 min-w-0 flex-1 rounded-pill border border-line bg-surface px-4 text-[15px] outline-none focus:border-brand" />
        <button type="submit" className="btn btn-primary h-12 px-5">찾기</button>
      </form>

      {q ? (
        <>
          <p className="mt-3 text-[13.5px] text-muted">
            {r.bits.length > 0 && <>조건으로 알아들은 것: <b className="text-ink2">{r.bits.join(" · ")}</b>{r.term && " · "}</>}
            {r.term && <>낱말: <b className="text-ink2">‘{r.term}’</b></>}
            {" · "}모두 <b className="num text-ink2">{grand.toLocaleString("ko-KR")}건</b>
          </p>

          <nav aria-label="갈래" className="mt-4 flex flex-wrap gap-1.5">
            {counts.map(([label, n, id]) => (
              <a key={id} href={`#${id}`} className={`chip ${n > 0 ? "" : "opacity-50"}`}>
                {label} <span className="num ml-1 text-[12px] opacity-70">{n.toLocaleString("ko-KR")}</span>
              </a>
            ))}
          </nav>

          {r.failed.length > 0 && (
            <p className="mt-4 rounded-card bg-brandSoft px-4 py-3 text-sm text-brand">
              {r.failed.join("·")} 쪽은 지금 읽지 못했습니다. 잠시 뒤 다시 찾아 주세요.
            </p>
          )}

          {grand === 0 && r.failed.length === 0 && (
            <div className="card mt-6 p-8 text-center">
              <p className="leading-relaxed text-muted">
                ‘{q}’ 에 걸리는 것이 없습니다. 다른 말로 바꾸거나 더 짧게 적어 보세요.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {SEARCH_SUGGEST.map((s) => (
                  <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="chip">{s}</Link>
                ))}
              </div>
            </div>
          )}

          {r.welfare.total > 0 && (
            <section id="welfare" className="mt-10 scroll-mt-24">
              <Head title="개인·가구 복지" n={r.welfare.total} href={r.welfare.href} hint="지역·나이·상태 조건으로 상세 검색" />
              <div className="grid gap-3">
                {r.welfare.items.map((p) => <ProgramEntry key={p.id} p={p} myAge={r.parsed.age} compact />)}
              </div>
            </section>
          )}

          {r.business.total > 0 && (
            <section id="business" className="mt-10 scroll-mt-24">
              <Head title="기업·소상공인 지원" n={r.business.total} href={r.business.href} hint="업종·업력·분야 조건으로 상세 검색" />
              <div className="grid gap-3">
                {r.business.items.map((p) => <ProgramEntry key={p.id} p={p} compact />)}
              </div>
            </section>
          )}

          {(r.jobs.total > 0 || r.jobs.items.length > 0) && (
            <section id="jobs" className="mt-10 scroll-mt-24">
              <Head title="공공기관 채용" n={r.jobs.total} href={r.jobs.href}
                    hint={r.jobs.openOnly ? "지난 공고까지 보기 · 지역·고용형태로 상세 검색" : "지역·고용형태로 상세 검색"} />
              <p className="-mt-1 mb-3 text-[12.5px] text-faint">
                접수 중인 공고 기준입니다.
                {r.jobs.allTotal !== null && r.jobs.allTotal > r.jobs.total && ` 지난 공고까지 ${r.jobs.allTotal.toLocaleString("ko-KR")}건.`}
              </p>
              <div className="grid gap-2">
                {r.jobs.items.map((j) => <JobRow key={j.id} j={j} />)}
              </div>
            </section>
          )}

          {r.guides.length > 0 && (
            <section id="guides" className="mt-10 scroll-mt-24">
              <Head title="안내 글·바로가기" n={r.guides.length} href="/blog" hint="안내 글 전체" />
              <div className="grid gap-2">
                {r.guides.map((g) => (
                  <Link key={g.href} href={g.href} className="card card-link block px-4 py-3">
                    <span className="text-[12px] font-semibold text-brand">{g.tag}</span>
                    <b className="mt-0.5 block text-[15px] leading-snug">{g.title}</b>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{g.desc}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {r.licenses.total > 0 && (
            <section id="licenses" className="mt-10 scroll-mt-24">
              <Head title="국가자격" n={r.licenses.total} href={r.licenses.href} hint="계열·분야로 상세 검색" />
              <ul className="card divide-y divide-line">
                {r.licenses.items.map((l) => (
                  <li key={l.code}>
                    <Link href={`/license/${encodeURIComponent(l.code)}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:text-brand">
                      <span className="font-semibold">{l.name}</span>
                      <span className="shrink-0 text-[12.5px] text-muted">{l.series}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {r.agency.total > 0 && (
            <section id="agency" className="mt-10 scroll-mt-24">
              <Head title="공공기관 사업" n={r.agency.total} href={r.agency.href} hint="생애주기·분야로 상세 검색" />
              <ul className="card divide-y divide-line">
                {r.agency.items.map((a) => (
                  <li key={a.id} className="px-4 py-3">
                    {a.url ? (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-brand">{a.title}</a>
                    ) : <span className="font-semibold">{a.title}</span>}
                    <p className="mt-0.5 text-[13px] text-muted">{[a.org, a.cate].filter(Boolean).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-12 rounded-card border-l-[3px] border-brand bg-brandSoft/40 px-5 py-5">
            <h2 className={H2}>상세 검색</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink2">
              갈래마다 조건이 다릅니다. 지금 적은 말을 그대로 들고 조건을 더 거는 화면으로 갑니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Link href={r.welfare.href} className="chip">복지 — 지역·나이·고용·가구</Link>
              <Link href={r.business.href} className="chip">기업 — 업종·업력·분야</Link>
              <Link href={r.jobs.href} className="chip">채용 — 지역·고용형태·접수 중</Link>
              <Link href={r.licenses.href} className="chip">자격증 — 계열·분야</Link>
              <Link href={r.agency.href} className="chip">공공기관 — 생애주기·분야</Link>
            </div>
          </section>
        </>
      ) : (
        <>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
            복지·기업 지원사업, 공공기관 채용, 국가자격, 공공기관 사업, 안내 글을 한 번에 찾습니다.
            지역이나 나이를 같이 적으면 조건으로 알아듣습니다 — “충북 35세 육아”.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {SEARCH_SUGGEST.map((s) => (
              <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="chip">{s}</Link>
            ))}
          </div>
        </>
      )}

      <RelatedLinks items={blogIndexRelated()} />
    </div>
  );
}
