import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import Faq from "@/components/Faq";
import HomeLoanRates from "@/components/HomeLoanRates";
import JsonLd from "@/components/JsonLd";
import MidAd from "@/components/MidAd";
import ProgramEntry from "@/components/ProgramEntry";
import PromoBanner from "@/components/PromoBanner";
import ShareButton from "@/components/ShareButton";
import {
  CHECKED, KINDS, KIND_KEYS, WHO, WHO_KEYS, countFor, countOf, findPath, govFor,
  housingCounts, housingFaq, housingList, housingPath, housingTitle, shortSido, sidosFor,
  type KindKey, type WhoKey,
} from "@/lib/housing";
import { ORG_ID, pageGraph } from "@/lib/schema";
import { SITE_URL } from "@/lib/seo";

/**
 * 주거 지원 쪽 하나. 전국 쪽과 시·도 쪽이 같은 틀을 쓴다.
 *
 * 위에서부터: 한눈에 → 정부 상품(글) → 지자체 사업(DB) → 시·군 이름 →
 * 다른 대상·종류·지역 → 자주 묻는 질문. 검색으로 들어온 사람이 위 두 칸만
 * 읽어도 무엇을 신청할지 알게 하는 것이 목표다.
 */
export default async function HousingPage({ kind, who, sido }: { kind: KindKey; who: WhoKey; sido?: string }) {
  const [counts, list] = await Promise.all([
    housingCounts().catch(() => []),
    housingList(kind, who, sido).catch(() => []),
  ]);
  const n = sido ? countFor(counts, kind, who, sido) : countOf(counts, kind, who);
  const title = housingTitle(kind, who, sido, n || list.length);
  const path = housingPath(kind, who, sido);
  const k = KINDS[kind], w = WHO[who];
  const gov = govFor(kind, who);
  const faq = housingFaq(kind, who, sido);
  const sidos = sidosFor(counts, kind, who);
  const sggs = Array.from(new Set(list.map((p) => p.sigungu).filter(Boolean) as string[]));
  const desc =
    `${sido ? `${sido}에서 ` : ""}${w.label}이(가) 받을 수 있는 ${k.noun} 지원을 모았습니다. ` +
    `주택도시기금 등 정부 대출 조건과, 지금 접수 중인 ${sido ? "시·군" : "지자체"} 사업 ${list.length}건을 ` +
    `한 화면에서 봅니다.`;

  const ld = pageGraph({
    path,
    name: title,
    description: desc,
    dateModified: CHECKED,
    collection: true,
    crumbs: [
      { name: "주거 지원", path: "/housing" },
      ...(sido ? [{ name: `${w.label} ${k.label}`, path: housingPath(kind, who) }, { name: sido }] : [{ name: `${w.label} ${k.label}` }]),
    ],
    about: {
      "@type": "ItemList",
      "@id": `${SITE_URL}${path}#list`,
      name: title,
      numberOfItems: list.length,
      itemListElement: list.slice(0, 20).map((p, i) => ({
        "@type": "ListItem", position: i + 1, name: p.title,
        url: `${SITE_URL}/p/${encodeURIComponent(p.source_id)}`,
      })),
      author: { "@id": ORG_ID },
    },
  });

  return (
    <div className="pb-4">
      <JsonLd data={ld} />
      <nav aria-label="위치" className="mt-2 text-[13px] text-muted">
        <Link href="/housing" className="hover:text-brand">주거 지원</Link>
        {" · "}
        {sido ? (
          <>
            <Link href={housingPath(kind, who)} className="hover:text-brand">{w.label} {k.label}</Link>
            {" · "}<span className="text-ink2">{sido}</span>
          </>
        ) : (
          <span className="text-ink2">{w.label} {k.label}</span>
        )}
      </nav>

      <header className="mt-3">
        <h1 className="display text-[1.6rem] leading-tight">{title}</h1>
        <p className="num mt-2 text-xs text-faint">{CHECKED} 확인 · 지자체 사업은 매일 갱신</p>
        <p className="mt-3 text-[15.5px] leading-[1.85] text-ink2">
          {w.label}({w.desc})이 {sido ? `${sido}에서 ` : ""}받을 수 있는 {k.noun} 지원은 두 층입니다.
          나라가 주택도시기금으로 운영하는 <b className="font-bold">대출</b>이 바닥이고, 그 위에
          시·군이 <b className="font-bold">이자나 월세를 대신 내주는 사업</b>이 얹힙니다. 둘 다 챙겨야 손해가 없습니다.
        </p>
      </header>

      {/* 정부 상품 */}
      <section className="mt-8">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">정부가 운영하는 것 (전국 공통)</h2>
        <div className="mt-4 grid gap-3">
          {gov.map((g) => (
            <article key={g.name} className="card p-5">
              <h3 className="text-[15px] font-extrabold leading-snug">{g.name}</h3>
              <dl className="mt-3 space-y-2 text-[14.5px] leading-relaxed">
                <div className="flex gap-3"><dt className="w-14 shrink-0 text-muted">대상</dt><dd className="text-ink2">{g.who}</dd></div>
                <div className="flex gap-3"><dt className="w-14 shrink-0 text-muted">내용</dt><dd className="text-ink2">{g.what}</dd></div>
                <div className="flex gap-3"><dt className="w-14 shrink-0 text-muted">조건</dt><dd className="text-ink2">{g.cond.join(" · ")}</dd></div>
              </dl>
              {g.note && <p className="mt-2 text-[13px] leading-relaxed text-muted">{g.note}</p>}
              <a href={g.href} target="_blank" rel="noopener noreferrer"
                 className="mt-3 inline-block text-[13.5px] font-bold underline underline-offset-4 hover:text-brand">
                원문에서 조건 확인
              </a>
            </article>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          금리와 최대 한도는 정부 대책에 따라 바뀝니다. 위 숫자는 {CHECKED} 기준이고, 신청 전 원문에서 다시 확인하세요.
        </p>
      </section>

      {kind === "buy" && (
        <section className="mt-10">
          <h2 className="sec-title text-[1.0625rem] font-extrabold">이번 달 금리</h2>
          <div className="mt-4"><HomeLoanRates compact /></div>
        </section>
      )}

      <MidAd name="detail_mid" context="general" seed={`housing-${kind}-${who}`} className="mt-10" />

      {/* 지자체 사업 */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="sec-title text-[1.0625rem] font-extrabold">
            {sido ? `${sido} 시·군 사업` : "지자체 사업"} — 지금 접수 중
          </h2>
          <span className="num text-sm text-muted">{list.length}건{list.length >= 60 && "+"}</span>
        </div>
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
          복지로·기업마당 공고 가운데 ‘{w.q}’와 ‘{k.q}’가 함께 적힌 것만 골랐습니다.
          {sido ? ` ${sido} 사업과 전국 사업이 같이 나옵니다.` : " 시·도를 고르면 우리 동네 것만 남습니다."}
        </p>
        {list.length === 0 ? (
          <div className="card mt-4 p-6 text-center text-muted">
            지금 접수 중인 {sido ? "시·군" : "지자체"} 사업이 없습니다. 위 정부 상품과 다른 지역 목록을 보세요.
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {list.slice(0, 30).map((p) => <ProgramEntry key={p.id} p={p} compact />)}
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={findPath(kind, who, sido)} className="btn btn-primary px-5 py-3">
            나이·상황까지 넣어 다시 찾기
          </Link>
          <ShareButton title={title} />
        </div>
      </section>

      {sggs.length > 1 && (
        <section className="mt-10">
          <h2 className="sec-title text-[1.0625rem] font-extrabold">사업이 있는 시·군</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sggs.map((g) => {
              const sp = new URLSearchParams({ q: `${w.q} ${k.q}`, via: "housing" });
              const s = list.find((p) => p.sigungu === g)?.sido;
              if (s) sp.set("sido", s);
              sp.set("sigungu", g);
              return <Link key={g} href={`/?${sp}`} className="chip">{g}</Link>;
            })}
          </div>
        </section>
      )}

      {/* 다른 지역 */}
      {!sido && sidos.length > 0 && (
        <section className="mt-10">
          <h2 className="sec-title text-[1.0625rem] font-extrabold">지역별로 보기</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sidos.map((s) => (
              <Link key={s.sido} href={housingPath(kind, who, s.sido)} className="chip">
                {shortSido(s.sido)} <span className="num text-[11.5px] font-bold text-faint">{s.n}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 다른 대상·종류 */}
      <section className="mt-10">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">{sido ? `${sido}의 다른 주거 지원` : "다른 대상·종류"}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {WHO_KEYS.map((wk) =>
            KIND_KEYS.map((kk) => {
              if (wk === who && kk === kind) return null;
              const c = sido ? countFor(counts, kk, wk, sido) : countOf(counts, kk, wk);
              return (
                <Link key={`${wk}-${kk}`} href={housingPath(kk, wk, sido)}
                      className="card card-link flex items-center justify-between px-4 py-3 text-[14.5px]">
                  <span><b>{WHO[wk].label}</b> {KINDS[kk].title}</span>
                  {counts.length > 0 && <span className="num text-xs text-muted">{c}</span>}
                </Link>
              );
            }),
          )}
        </div>
      </section>

      <Faq items={faq} />

      <section className="mt-10">
        <h2 className="sec-title text-[1.0625rem] font-extrabold">확인한 곳</h2>
        <ul className="mt-3 space-y-1.5 text-[14px] text-ink2">
          {[
            ["마이홈포털 — 청년·신혼부부 주거지원", "https://www.myhome.go.kr/hws/portal/main/getMgtMainPage.do"],
            ["주택도시기금 (기금e든든)", "https://nhuf.molit.go.kr"],
            ["복지로", "https://www.bokjiro.go.kr"],
          ].map(([l, h]) => (
            <li key={h}><a href={h} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-brand">{l}</a></li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          지자체 사업 목록은 공고 본문의 낱말로 고른 것이라 빠지거나 섞일 수 있습니다. 신청 자격과 기간은 각 공고 원문이 기준입니다.
        </p>
      </section>

      <AdSlot name="page_bottom" />
      <PromoBanner placement={`housing-${kind}`} context="general" />
    </div>
  );
}
