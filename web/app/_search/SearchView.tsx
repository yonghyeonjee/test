import Link from "next/link";
import PortalSearch from "@/components/PortalSearch";
import ProgramEntry from "@/components/ProgramEntry";
import TopStripAd from "@/components/TopStripAd";
import { SEARCH_SUGGEST, type JobHit, type SearchResult } from "@/lib/search";

/**
 * 검색 결과 화면의 몸통. 통합 검색(/search)과 사업자 검색(/business/search)이
 * 같은 것을 쓴다 — 갈래의 차례와 보이는 갈래만 다르다.
 *
 *  - all: 복지 → 기업 → 채용 → 안내 글 → 자격증 → 공공기관
 *  - business: 기업 → 공공기관 → 안내 글. 복지·채용·자격증은 건수만 적고 통합 검색으로 보낸다.
 */
export type Scope = "all" | "business";

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

/** 연관 검색어 줄. 누르면 그 말로 다시 찾는다. */
function Related({ terms, base, label = "연관 검색어" }: { terms: string[]; base: string; label?: string }) {
  if (!terms.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 flex items-center gap-1 text-[12.5px] font-semibold text-muted">
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 10h12M11 5l5 5-5 5" />
        </svg>
        {label}
      </span>
      {terms.map((t) => (
        <Link key={t} href={`${base}?q=${encodeURIComponent(t)}`} className="chip !py-1 !text-[13px]">{t}</Link>
      ))}
    </div>
  );
}

export default function SearchView({
  q, r, idx, scope, eyebrow, title, sub, placeholder, placeholderNarrow, hot,
}: {
  q: string;
  r: SearchResult;
  idx: Record<string, { sido: string; full: string }>;
  scope: Scope;
  /** 많이 찾는 말(lib/hotTerms). 빈 검색창 아래와 빈 결과에 쓴다. */
  hot: string[];
  eyebrow: string;
  title: React.ReactNode;
  sub: string;
  placeholder?: string;
  placeholderNarrow?: string;
}) {
  const biz = scope === "business";
  const base = biz ? "/business/search" : "/search";
  const counts = (biz
    ? [
        ["기업", r.business.total, "business"],
        ["공공기관", r.agency.total, "agency"],
        ["안내 글", r.guides.length, "guides"],
      ]
    : [
        ["복지", r.welfare.total, "welfare"],
        ["기업", r.business.total, "business"],
        ["채용", r.jobs.total, "jobs"],
        ["안내 글", r.guides.length, "guides"],
        ["자격증", r.licenses.total, "licenses"],
        ["공공기관", r.agency.total, "agency"],
      ]) as readonly (readonly [string, number, string])[];
  const grand = counts.reduce((a, c) => a + c[1], 0);
  // 사업자 검색에서 빼 둔 갈래. 건수만 적고 통합 검색으로 보낸다.
  const elsewhere = biz ? r.welfare.total + r.jobs.total + r.licenses.total : 0;
  // describe() 는 낱말도 "‘경비’ 포함" 으로 끼워 준다. 여기서는 낱말을 따로 적으므로 뺀다.
  const conds = r.bits.filter((b) => !b.endsWith(" 포함"));

  const welfare = r.welfare.total > 0 && !biz && (
    <section id="welfare" className="mt-10 scroll-mt-24">
      <Head title="개인·가구 복지" n={r.welfare.total} href={r.welfare.href} hint="지역·나이·상태 조건으로 상세 검색" />
      <div className="grid gap-3">
        {r.welfare.items.map((p) => <ProgramEntry key={p.id} p={p} myAge={r.parsed.age} compact />)}
      </div>
    </section>
  );
  const business = r.business.total > 0 && (
    <section id="business" className="mt-10 scroll-mt-24">
      <Head title="기업·소상공인 지원" n={r.business.total} href={r.business.href} hint="업종·업력·분야 조건으로 상세 검색" />
      <div className="grid gap-3">
        {r.business.items.map((p) => <ProgramEntry key={p.id} p={p} compact />)}
      </div>
    </section>
  );
  const jobs = !biz && (r.jobs.total > 0 || r.jobs.items.length > 0) && (
    <section id="jobs" className="mt-10 scroll-mt-24">
      <Head title="공공기관 채용" n={r.jobs.total} href={r.jobs.href}
            hint={r.jobs.openOnly ? "지난 공고까지 보기 · 지역·고용형태로 상세 검색" : "지역·고용형태로 상세 검색"} />
      <p className="-mt-1 mb-3 text-[12.5px] text-faint">
        접수 중인 공고 기준입니다.
        {r.jobs.allTotal !== null && r.jobs.allTotal > r.jobs.total && ` 지난 공고까지 ${r.jobs.allTotal.toLocaleString("ko-KR")}건.`}
        {r.jobs.also.length > 0 && ` 연관어(${r.jobs.also.slice(0, 5).join("·")})도 같이 찾았습니다.`}
      </p>
      <div className="grid gap-2">
        {r.jobs.items.map((j) => <JobRow key={j.id} j={j} />)}
      </div>
    </section>
  );
  const guides = r.guides.length > 0 && (
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
  );
  const licenses = !biz && r.licenses.total > 0 && (
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
  );
  const agency = r.agency.total > 0 && (
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
  );

  return (
    <div className="py-4">
      {/* 검색창이 주인공. 띠 위에 올려 첫 화면과 같은 얼굴로. */}
      <section className="hub-stage -mx-5 px-5 pb-7 pt-6 sm:mx-0 sm:rounded-card sm:px-8">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display mt-1.5 text-[1.5rem] leading-tight sm:text-[1.75rem]">{title}</h1>
        <p className="mt-1.5 text-[13.5px] text-muted">{sub}</p>
        <div className="mt-4">
          <PortalSearch index={idx} initial={q} scope={scope} hot={q ? [] : hot}
                        placeholder={placeholder} placeholderNarrow={placeholderNarrow} />
        </div>
      </section>

      <TopStripAd />

      {q ? (
        <>
          <p className="mt-5 text-[13.5px] text-muted">
            {conds.length > 0 && <>조건으로 알아들은 것: <b className="text-ink2">{conds.join(" · ")}</b>{r.term && " · "}</>}
            {r.term && <>낱말: <b className="text-ink2">‘{r.term}’</b></>}
            {" · "}모두 <b className="num text-ink2">{grand.toLocaleString("ko-KR")}건</b>
          </p>
          {r.expanded.length > 0 && (
            <p className="mt-1 text-[13px] text-muted">
              {r.expanded.map((e) => (
                <span key={e.word} className="mr-3 inline-block">
                  ‘{e.word}’의 연관어 <b className="text-ink2">{e.also.slice(0, 5).join("·")}</b>도 함께 찾았습니다.
                </span>
              ))}
            </p>
          )}

          <nav aria-label="갈래" className="mt-4 flex flex-wrap gap-1.5">
            {counts.map(([label, n, id]) => (
              <a key={id} href={`#${id}`} className={`chip ${n > 0 ? "" : "opacity-50"}`}>
                {label} <span className="num ml-1 text-[12px] opacity-70">{n.toLocaleString("ko-KR")}</span>
              </a>
            ))}
            {biz && elsewhere > 0 && (
              <Link href={`/search?q=${encodeURIComponent(q)}`} className="chip">
                개인 복지·채용·자격증 <span className="num ml-1 text-[12px] opacity-70">{elsewhere.toLocaleString("ko-KR")}</span>
              </Link>
            )}
          </nav>

          {r.related.length > 0 && (
            <div className="mt-4 rounded-card border border-line bg-surface2 px-4 py-3">
              <Related terms={r.related} base={base} />
            </div>
          )}

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
              {r.related.length > 0 && (
                <p className="mt-2 text-[13.5px] text-muted">
                  비슷한 말로 다시 찾아보세요 — {r.related.slice(0, 4).map((t, i) => (
                    <span key={t}>{i > 0 && ", "}<Link href={`${base}?q=${encodeURIComponent(t)}`} className="font-semibold text-brand underline underline-offset-4">{t}</Link></span>
                  ))}
                </p>
              )}
              {biz && elsewhere > 0 && (
                <p className="mt-2 text-[13.5px] text-muted">
                  개인 복지·채용·자격증에는 <Link href={`/search?q=${encodeURIComponent(q)}`} className="font-semibold text-brand underline underline-offset-4">{elsewhere.toLocaleString("ko-KR")}건</Link>이 있습니다.
                </p>
              )}
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {(biz ? hot : SEARCH_SUGGEST).map((s) => (
                  <Link key={s} href={`${base}?q=${encodeURIComponent(s)}`} className="chip">{s}</Link>
                ))}
              </div>
            </div>
          )}

          {biz ? (<>{business}{agency}{guides}</>) : (<>{welfare}{business}{jobs}{guides}{licenses}{agency}</>)}

          <section className="mt-12 rounded-card border-l-[3px] border-brand bg-brandSoft/40 px-5 py-5">
            <h2 className={H2}>상세 검색</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink2">
              갈래마다 조건이 다릅니다. 지금 적은 말을 그대로 들고 조건을 더 거는 화면으로 갑니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {biz ? (
                <>
                  <Link href={r.business.href} className="chip">기업 — 지역·업종·업력·분야</Link>
                  <Link href={r.agency.href} className="chip">공공기관 — 생애주기·분야</Link>
                  <Link href={`/search?q=${encodeURIComponent(q)}`} className="chip">통합 검색에서 전부 보기</Link>
                </>
              ) : (
                <>
                  <Link href={r.welfare.href} className="chip">복지 — 지역·나이·고용·가구</Link>
                  <Link href={r.business.href} className="chip">기업 — 업종·업력·분야</Link>
                  <Link href={r.jobs.href} className="chip">채용 — 지역·고용형태·접수 중</Link>
                  <Link href={r.licenses.href} className="chip">자격증 — 계열·분야</Link>
                  <Link href={r.agency.href} className="chip">공공기관 — 생애주기·분야</Link>
                </>
              )}
            </div>
          </section>
        </>
      ) : (
        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {(biz
            ? [
                ["업종·업력을 섞어 적어도 됩니다", "“경남 제조업 3년차 수출” 처럼 지역·업종을 섞어 적으면 지역은 조건으로, 나머지는 낱말로 찾습니다."],
                ["비슷한 말도 같이 찾습니다", "‘수출’을 치면 해외진출·해외판로 공고도 나옵니다. 무엇을 같이 찾았는지 결과 위에 적어 둡니다."],
                ["공공기관 사업까지 한 번에", "기업마당·소상공인24 공고와 공공기관이 직접 여는 사업을 같이 보고, 상세 검색으로 업종·업력 조건을 더 겁니다."],
              ]
            : [
                ["한 줄로 적으면 조건으로 알아듣습니다", "“충북 35세 육아” 처럼 지역·나이·상황을 섞어 적어도 됩니다. 지역과 나이는 조건으로, 나머지는 낱말로 찾습니다."],
                ["비슷한 말도 같이 찾습니다", "‘경비’를 치면 경호·보안·방호 공고도 나옵니다. 무엇을 같이 찾았는지 결과 위에 적어 둡니다."],
                ["갈래마다 상세 검색으로 이어집니다", "복지는 지역·나이·가구, 채용은 지역·고용형태, 자격증은 계열처럼 갈래마다 다른 조건을 더 걸 수 있습니다."],
              ]
          ).map(([h, b]) => (
            <div key={h} className="card p-5">
              <b className="block text-[15px] font-bold">{h}</b>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{b}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
