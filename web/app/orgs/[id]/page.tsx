import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdSlot from "@/components/AdSlot";
import GuideBanner from "@/components/GuideBanner";
import { IllusAgency } from "@/components/Illus";
import JsonLd from "@/components/JsonLd";
import MiniMap from "@/components/MiniMap";
import OrgMark from "@/components/OrgMark";
import PageBanner from "@/components/PageBanner";
import Paras from "@/components/Paras";
import RelatedLinks from "@/components/RelatedLinks";
import { SIDO_SHORT, mapLinks } from "@/lib/geo";
import { getPublicOrgStrict, getPublicOrgs, orgGroup, type PublicOrg } from "@/lib/govData";
import { STATUS_LABEL } from "@/lib/consts";
import { dot, getJobsByOrg, type Job } from "@/lib/pubJobs";
import { agencyRelated } from "@/lib/related";
import { pageGraph } from "@/lib/schema";
import { SITE_URL, withOg } from "@/lib/seo";

/**
 * 공공기관 상세(2026-10-21). 잡알리오 "공공기관 정보" 한 곳 — 기관유형·주무기관·설립근거·하는 일·연혁·소재지에
 * 지도와 길찾기, 그 기관이 낸 채용 공고(나라일터·잡알리오)를 잇는다.
 */
export const revalidate = 21600;
export const dynamicParams = true;

type P = { params: { id: string } };

export async function generateStaticParams() {
  try {
    return (await getPublicOrgs()).slice(0, 60).map((o) => ({ id: o.id }));
  } catch {
    return [];
  }
}

/** 공고의 기관 이름은 "(재)"·"(사)" 같은 법인 표시를 떼고 적힌다. */
const bare = (name: string) => name.replace(/^\((사|재|주|특|학)\)\s*/, "").replace(/\s+/g, " ").trim();
const firstSentence = (s: string | null) => (s ?? "").split(/(?<=[.。])\s+/)[0].slice(0, 120);

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const o = await getPublicOrgStrict(params.id);
  if (!o) return withOg({ title: "찾을 수 없는 기관" });
  const where = [o.sido ? SIDO_SHORT[o.sido] ?? o.sido : "", o.sigungu].filter(Boolean).join(" ");
  return withOg({
    title: `${o.name} — ${o.kind ?? orgGroup(o.kind)}, ${o.ministry ?? "공공기관"} 소관${where ? ` · ${where}` : ""}`,
    description: `${o.name}의 기관유형·주무부처·설립근거·하는 일·소재지와 홈페이지. ${firstSentence(o.intro) || "잡알리오 공공기관 정보 기준."} 이 기관이 낸 채용 공고로 이어집니다.`,
    keywords: [o.name, `${bare(o.name)} 채용`, `${bare(o.name)} 주소`, `${bare(o.name)} 홈페이지`, "공공기관 정보"],
    alternates: { canonical: `/orgs/${o.id}` },
  });
}

/** "o 가\no 나" 같은 줄을 목록으로. 머리 기호는 뗀다. */
function bullets(text: string | null): string[] {
  return (text ?? "").split("\n").map((l) => l.replace(/^[o○•\-·ㅇ*]\s*/, "").trim()).filter(Boolean);
}

export default async function OrgPage({ params }: P) {
  const o = await getPublicOrgStrict(params.id);
  if (!o) notFound();
  const group = orgGroup(o.kind);
  const name = bare(o.name);
  const [board, all] = await Promise.all([
    getJobsByOrg(name, 60).then(async (b) => (b.jobs.length || name === o.name ? b : getJobsByOrg(o.name, 60))),
    getPublicOrgs().catch(() => [] as PublicOrg[]),
  ]);
  const open = board.jobs.filter((j) => j.status !== "closed").slice(0, 5);
  const recent = open.length ? open : board.jobs.slice(0, 3);
  const siblings = all.filter((x) => x.id !== o.id && x.ministry && x.ministry === o.ministry).slice(0, 6);
  const where = [o.sido ? SIDO_SHORT[o.sido] ?? o.sido : "", o.sigungu].filter(Boolean).join(" ");
  const links = mapLinks(o.address ? `${where} ${o.address.split(",")[0]}`.trim() : name);
  const roles = bullets(o.roles);
  const history = bullets(o.history);
  const goals = bullets(o.goals);
  const path = `/orgs/${o.id}`;

  return (
    <div className="pb-4">
      <PageBanner tone="indigo"
        eyebrow={`공공기관 · ${group}`}
        title={o.name}
        sub={firstSentence(o.intro) || `${o.ministry ?? "정부"} 소관 ${o.kind ?? group}입니다.`}
        art={<IllusAgency />}
      >
        <div className="mt-4 flex flex-wrap gap-2">
          {o.homepage && (
            <a href={o.homepage} target="_blank" rel="noopener noreferrer" className="btn btn-primary px-4 py-2 text-[13.5px]">홈페이지 ↗</a>
          )}
          <Link href={`/jobs/org/${encodeURIComponent(board.jobs.length ? (board.jobs[0].org ?? name) : name)}`} className="btn btn-ghost px-4 py-2 text-[13.5px]">
            채용 이력{board.jobs.length ? <span className="num ml-1 text-muted">{board.jobs.length}건{board.jobs.length >= 60 ? "+" : ""}</span> : ""}
          </Link>
          <Link href={`/agency?q=${encodeURIComponent(name.slice(0, 6))}`} className="btn btn-ghost px-4 py-2 text-[13.5px]">사업·행사</Link>
          {o.lat && o.lng && <Link href={`/map?kind=orgs&lat=${o.lat}&lng=${o.lng}`} className="btn btn-ghost px-4 py-2 text-[13.5px]">지도에서 보기</Link>}
        </div>
      </PageBanner>

      <JsonLd data={pageGraph({
        path, name: o.name, description: firstSentence(o.intro) || null,
        crumbs: [{ name: "공공기관", path: "/agency" }, { name: "기관 목록", path: "/orgs" }, { name: o.name }],
        dateModified: o.fetched_at,
        about: {
          "@type": "GovernmentOrganization", "@id": `${SITE_URL}${path}#org`, name: o.name,
          ...(o.homepage ? { url: o.homepage } : {}),
          ...(o.address ? { address: { "@type": "PostalAddress", streetAddress: o.address, addressRegion: o.sido ?? undefined, addressLocality: o.sigungu ?? undefined, addressCountry: "KR" } } : {}),
          ...(o.ministry ? { parentOrganization: { "@type": "GovernmentOrganization", name: o.ministry } } : {}),
          ...(o.lat && o.lng ? { geo: { "@type": "GeoCoordinates", latitude: o.lat, longitude: o.lng } } : {}),
        },
      })} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
        <section className="card p-5">
          <div className="flex items-start gap-3">
            <OrgMark org={o.name} hire="공공" />
            <h2 className="text-[1.0625rem] font-bold leading-snug">기본 정보</h2>
          </div>
          <dl className="mt-4 grid gap-x-6 gap-y-2.5 text-[14px] sm:grid-cols-[7rem_1fr]">
            <dt className="text-muted">기관유형</dt><dd>{o.kind ?? group}</dd>
            <dt className="text-muted">주무기관</dt><dd>{o.ministry ?? "—"}</dd>
            <dt className="text-muted">설립근거</dt><dd>{o.basis ?? "—"}</dd>
            <dt className="text-muted">기관장</dt><dd>{o.head?.replace(/\s+/g, "") ?? "—"}</dd>
            <dt className="text-muted">소재지</dt>
            <dd>
              {o.address ? <>{o.sido && !o.address.includes(SIDO_SHORT[o.sido] ?? o.sido) && !o.address.includes(o.sido) && <span className="text-ink2">{SIDO_SHORT[o.sido] ?? o.sido} </span>}{o.address}</> : "—"}
              {o.address && (
                <span className="ml-2 inline-flex gap-1.5 align-middle">
                  <a href={links.kakao} target="_blank" rel="noopener noreferrer" className="chip !py-0.5 !text-[12px]">카카오맵</a>
                  <a href={links.naver} target="_blank" rel="noopener noreferrer" className="chip !py-0.5 !text-[12px]">네이버지도</a>
                </span>
              )}
            </dd>
            <dt className="text-muted">홈페이지</dt>
            <dd className="break-all">{o.homepage ? <a href={o.homepage} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-4">{o.homepage}</a> : "—"}</dd>
          </dl>
        </section>
        <div>
          {o.lat && o.lng ? (
            <MiniMap lat={o.lat} lng={o.lng} label={name} approx={false} query={o.address ? `${where} ${o.address.split(",")[0]}`.trim() : name} kind="jobs" />
          ) : (
            <div className="card p-5 text-[13.5px] leading-relaxed text-muted">소재지 좌표를 아직 찾지 못했습니다. 홈페이지의 오시는 길을 확인하세요.</div>
          )}
          {o.geo_src === "osm-road" && <p className="mt-1.5 text-[12px] text-faint">지도의 자리는 길 단위까지만 맞습니다(번지를 못 찾음).</p>}
        </div>
      </div>

      {recent.length > 0 && (
        <section className="mt-12">
          <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">{open.length ? "접수 중인 채용 공고" : "최근 채용 공고"}</h2>
          <ul className="mt-4 grid gap-2">
            {recent.map((j: Job) => (
              <li key={j.id} className="card card-link flex items-start gap-3 p-4">
                <span className={`badge ${j.status === "closed" ? "badge-closed" : j.status === "upcoming" ? "badge-soon" : "badge-open"}`}>{STATUS_LABEL[j.status]}</span>
                <Link href={`/jobs/${encodeURIComponent(j.id)}`} className="min-w-0 flex-1 text-[14.5px] font-bold leading-snug hover:text-brand">{j.title}</Link>
                <span className="num shrink-0 text-[12.5px] text-muted">{j.end ? `~${dot(j.end)}` : j.reg ? dot(j.reg) : ""}</span>
              </li>
            ))}
          </ul>
          <Link href={`/jobs/org/${encodeURIComponent(board.jobs[0]?.org ?? name)}`} className="mt-3 inline-flex text-sm font-semibold text-brand hover:underline">
            {name} 채용 공고 모두 보기 →
          </Link>
        </section>
      )}

      {roles.length > 0 && (
        <section className="mt-12">
          <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">하는 일</h2>
          <ul className="mt-4 grid gap-2">
            {roles.map((r, i) => <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed"><span className="text-brand" aria-hidden>•</span><span>{r}</span></li>)}
          </ul>
        </section>
      )}
      {o.intro && (
        <section className="mt-12">
          <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">기관 소개</h2>
          <div className="mt-4 space-y-3 leading-relaxed text-ink2"><Paras text={o.intro} /></div>
        </section>
      )}
      {goals.length > 0 && (
        <section className="mt-12">
          <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">경영목표와 전략</h2>
          <ul className="mt-4 grid gap-1.5 text-[14px] leading-relaxed text-ink2">
            {goals.map((g, i) => <li key={i} className={g.startsWith("-") ? "pl-4 text-muted" : "font-semibold"}>{g.replace(/^-\s*/, "")}</li>)}
          </ul>
        </section>
      )}
      {history.length > 0 && (
        <section className="mt-12">
          <details className="group" open={history.length <= 8}>
            <summary className="cursor-pointer list-none border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
              연혁 <span className="num ml-1 text-sm font-normal text-muted">{history.length}건</span>
              <span className="ml-2 text-sm font-normal text-faint group-open:hidden">펼치기</span>
            </summary>
            <ol className="mt-4 grid gap-1.5 text-[14px] leading-relaxed text-ink2">
              {history.map((h, i) => <li key={i}>{h}</li>)}
            </ol>
          </details>
        </section>
      )}

      {siblings.length > 0 && (
        <section className="mt-12">
          <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">{o.ministry} 소관의 다른 기관</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {siblings.map((s) => (
              <li key={s.id}>
                <Link href={`/orgs/${s.id}`} className="card card-link flex items-center gap-3 p-3.5">
                  <OrgMark org={s.name} hire="공공" size="sm" />
                  <span className="min-w-0">
                    <b className="block truncate text-[14px]">{s.name}</b>
                    <span className="text-[12.5px] text-muted">{s.kind ?? orgGroup(s.kind)}{s.sido ? ` · ${SIDO_SHORT[s.sido] ?? s.sido}` : ""}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-xs leading-relaxed text-muted">
        재정경제부 잡알리오 공공기관 정보(2026년 지정현황)를 매주 받아 옵니다. 기관장·연혁은 기관이 올린 그대로이며, 좌표는 OpenStreetMap 기여자 자료(ODbL)로 찾았습니다.
      </p>
      <AdSlot name="page_bottom" />
      <GuideBanner />
      <RelatedLinks items={[{ href: "/orgs", title: "공공기관 목록", desc: "공기업·준정부기관·기타공공기관 342곳을 유형과 부처로 거릅니다." }, ...agencyRelated()]} />
    </div>
  );
}
