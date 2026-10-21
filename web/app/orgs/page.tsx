import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/AdSlot";
import Faq from "@/components/Faq";
import GuideBanner from "@/components/GuideBanner";
import { IllusAgency } from "@/components/Illus";
import JsonLd from "@/components/JsonLd";
import OrgMark from "@/components/OrgMark";
import PageBanner from "@/components/PageBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { SIDO_SHORT } from "@/lib/geo";
import { SIDO_POINT } from "@/lib/geoData";
import { ORG_GROUPS, getPublicOrgs, orgGroup, type PublicOrg } from "@/lib/govData";
import { agencyRelated } from "@/lib/related";
import { pageGraph } from "@/lib/schema";
import { brandKeys, withOg } from "@/lib/seo";

/**
 * 공공기관 목록(2026-10-21). 잡알리오 "공공기관 정보"의 지정 공공기관 342곳을 기관유형·주무기관·소재지로 거른다.
 * 거르기는 주소(?group= ?ministry= ?sido= ?q=)로 하고 서버가 그린다 — 스크립트 없이도 된다.
 */
export const revalidate = 21600;

const DESC =
  "공기업·준정부기관·기타공공기관 342곳의 주무부처, 기관유형, 소재지, 홈페이지를 한자리에. " +
  "기관을 누르면 하는 일과 연혁, 지도, 채용 이력까지 이어집니다.";

export const metadata: Metadata = withOg({
  title: "공공기관 목록 — 공기업·준정부기관·기타공공기관 342곳 한눈에",
  description: DESC,
  keywords: [...brandKeys("공공기관", "공공기관 목록"), "공공기관 현황", "공기업 목록", "준정부기관 목록", "기타공공기관 목록", "공공기관 주소", "공공기관 주무부처"],
  alternates: { canonical: "/orgs" },
});

type SP = { [k: string]: string | string[] | undefined };
const one = (v: SP[string]) => (Array.isArray(v) ? v[0] : v) || undefined;
const GROUP_TONE: Record<string, string> = { 공기업: "badge-open", 준정부기관: "badge-soon", 기타공공기관: "badge-closed" };

function href(cur: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/orgs?${s}` : "/orgs";
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();

export default async function OrgsPage({ searchParams }: { searchParams: SP }) {
  const cur = { group: one(searchParams.group), ministry: one(searchParams.ministry), sido: one(searchParams.sido), q: one(searchParams.q) };
  const all = await getPublicOrgs().catch(() => [] as PublicOrg[]);
  const q = cur.q ? norm(cur.q) : "";
  const items = all.filter((o) =>
    (!cur.group || orgGroup(o.kind) === cur.group) &&
    (!cur.ministry || o.ministry === cur.ministry) &&
    (!cur.sido || o.sido === cur.sido) &&
    (!q || norm(`${o.name} ${o.ministry ?? ""} ${o.address ?? ""} ${o.sigungu ?? ""}`).includes(q)));
  const byGroup = new Map<string, number>();
  for (const o of all) byGroup.set(orgGroup(o.kind), (byGroup.get(orgGroup(o.kind)) ?? 0) + 1);
  const ministries = [...new Set(all.map((o) => o.ministry).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "ko"));
  const sidos = Object.keys(SIDO_POINT).filter((s) => all.some((o) => o.sido === s));
  const active = Boolean(cur.group || cur.ministry || cur.sido || cur.q);

  return (
    <div className="pb-4">
      <PageBanner tone="indigo"
        eyebrow="공공기관"
        title="공공기관 342곳, 어디서 무엇을 하나"
        sub="공공기관운영법으로 지정된 공기업·준정부기관·기타공공기관입니다. 주무부처와 기관유형으로 거르고, 기관을 누르면 하는 일·소재지·채용 이력까지 봅니다."
        art={<IllusAgency />}
      >
        <p className="num mt-4 text-sm text-muted">
          {ORG_GROUPS.map((g) => `${g} ${byGroup.get(g) ?? 0}곳`).join(" · ")}
        </p>
      </PageBanner>
      <JsonLd data={pageGraph({
        path: "/orgs", name: "공공기관 목록", description: DESC, collection: true,
        crumbs: [{ name: "공공기관", path: "/agency" }, { name: "기관 목록" }],
        items: !active ? items.slice(0, 20).map((o) => ({ name: o.name, path: `/orgs/${o.id}` })) : undefined,
      })} />

      <div className="card mt-6 p-4 sm:p-5">
        <form action="/orgs" method="get" role="search" className="flex gap-2">
          {cur.group && <input type="hidden" name="group" value={cur.group} />}
          {cur.ministry && <input type="hidden" name="ministry" value={cur.ministry} />}
          {cur.sido && <input type="hidden" name="sido" value={cur.sido} />}
          <input name="q" defaultValue={cur.q ?? ""} placeholder="기관명·부처·소재지로 찾기" aria-label="기관 찾기"
                 className="h-10 min-w-0 flex-1 rounded-pill border border-line bg-surface px-4 text-[14px] outline-none focus:border-brand" />
          <button type="submit" className="btn btn-primary px-4">찾기</button>
        </form>
        <div className="mt-4">
          <span className="mr-2 text-xs font-bold text-muted">기관유형</span>
          <span className="inline-flex flex-wrap gap-1.5 align-middle">
            {ORG_GROUPS.map((g) => (
              <Link key={g} href={href(cur, { group: cur.group === g ? undefined : g })} className={`chip !py-1.5 !text-[13px] ${cur.group === g ? "chip-on" : ""}`}>
                {g} <span className="num ml-1 opacity-70">{byGroup.get(g) ?? 0}</span>
              </Link>
            ))}
          </span>
        </div>
        <div className="mt-3">
          <span className="mr-2 text-xs font-bold text-muted">소재지</span>
          <span className="inline-flex flex-wrap gap-1.5 align-middle">
            {sidos.map((s) => (
              <Link key={s} href={href(cur, { sido: cur.sido === s ? undefined : s })} className={`chip !py-1 !text-[12.5px] ${cur.sido === s ? "chip-on" : ""}`}>
                {SIDO_SHORT[s] ?? s}
              </Link>
            ))}
          </span>
        </div>
        <details className="mt-3" open={Boolean(cur.ministry)}>
          <summary className="cursor-pointer text-xs font-bold text-muted">주무부처 {cur.ministry ? `· ${cur.ministry}` : "고르기"}</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ministries.map((m) => (
              <Link key={m} href={href(cur, { ministry: cur.ministry === m ? undefined : m })} className={`chip !py-1 !text-[12.5px] ${cur.ministry === m ? "chip-on" : ""}`}>{m}</Link>
            ))}
          </div>
        </details>
      </div>

      <div className="mb-3 mt-8 flex items-baseline justify-between">
        <h2 className="text-[1.0625rem] font-bold">{active ? "조건에 맞는 기관" : "전체"}</h2>
        <span className="num text-sm text-muted">{items.length}곳</span>
      </div>
      {all.length === 0 ? (
        <div className="card p-8 text-center text-muted">지금은 기관 목록을 불러오지 못했습니다. 잠시 뒤 다시 들어오시면 보입니다.</div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-muted">조건에 맞는 기관이 없습니다.</p>
          <Link href="/orgs" className="btn btn-ghost mt-5">조건 지우기</Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((o) => {
            const g = orgGroup(o.kind);
            return (
              <li key={o.id} className="card card-link p-4">
                <Link href={`/orgs/${o.id}`} className="flex items-start gap-3">
                  <OrgMark org={o.name} hire="공공" size="sm" />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px] leading-snug">{o.name}</b>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
                      <span className={`badge ${GROUP_TONE[g] ?? "badge-closed"}`}>{o.kind ?? g}</span>
                      {o.ministry && <span>{o.ministry}</span>}
                      {(o.sido || o.sigungu) && <span className="text-ink2">{[o.sido ? SIDO_SHORT[o.sido] ?? o.sido : "", o.sigungu].filter(Boolean).join(" ")}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted">
        재정경제부 잡알리오의 2026년 공공기관 지정현황을 매주 받아 옵니다. 소재지 좌표는 OpenStreetMap(Nominatim) 자료로 찾았으며
        길 단위까지만 맞는 곳이 있습니다. 찾아가기 전에 기관 홈페이지의 오시는 길을 확인하세요.
      </p>

      <section className="mt-14">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">공기업·준정부기관·기타공공기관이 어떻게 다른가</h2>
        <div className="mt-4 space-y-4 text-[15px] leading-[1.85] text-ink2">
          <p>
            공공기관운영법은 정부가 출자하거나 재정을 지원하는 기관을 해마다 지정합니다. 2026년에는 342곳입니다.
            공기업은 자체 수입이 큰 곳으로 한국전력·LH 처럼 시장형과 준시장형으로 나뉩니다.
          </p>
          <p>
            준정부기관은 기금을 관리하거나 정부 사업을 위탁받아 집행하는 곳입니다. 국민연금공단·근로복지공단이 여기에 듭니다.
            나머지가 기타공공기관으로, 연구원·진흥원·재단이 많습니다.
          </p>
          <p>
            채용은 유형과 상관없이 대부분 잡알리오와 나라일터에 공고를 냅니다. 기관 상세에서 그 기관이 낸 공고 이력으로 바로 이어집니다.
          </p>
        </div>
      </section>

      <AdSlot name="page_bottom" />
      <Faq items={[
        { q: "지자체 산하 공단·재단은 왜 없나요?", a: "이 목록은 중앙정부가 공공기관운영법으로 지정한 기관만 담습니다. 시설관리공단이나 지역 문화재단 같은 지방공기업·출자출연기관은 지방공기업법으로 따로 관리되어 여기 없습니다." },
        { q: "소재지가 실제와 다른 것 같아요.", a: "잡알리오의 소재지는 시·도 없이 적힌 곳이 많아 OpenStreetMap 에서 길 이름으로 찾았습니다. 같은 길 이름이 여러 도시에 있으면 틀릴 수 있습니다. 기관 홈페이지의 오시는 길이 정확합니다." },
        { q: "이 기관의 채용 공고를 보려면?", a: "기관 상세의 '채용 이력' 단추를 누르면 나라일터·잡알리오에 낸 공고가 등록일순으로 나옵니다. 접수 중인 것이 앞에 옵니다." },
      ]} />
      <GuideBanner />
      <RelatedLinks items={agencyRelated()} />
    </div>
  );
}
