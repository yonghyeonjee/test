import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdSlot from "@/components/AdSlot";
import { josa } from "@/lib/faq";
import { descLines, lastCate, phase } from "@/components/AgencyList";
import CalendarAdd from "@/components/CalendarAdd";
import GuideBanner from "@/components/GuideBanner";
import { IllusAgency } from "@/components/Illus";
import JsonLd from "@/components/JsonLd";
import OrgMark from "@/components/OrgMark";
import PageBanner from "@/components/PageBanner";
import RelatedLinks from "@/components/RelatedLinks";
import { AGENCY_KIND, AGENCY_TEXT_MIN, agencyHref, agencyItemBySlug, type AgencyKind } from "@/lib/agencyStore";
import { dot, type AlioItem } from "@/lib/alioplus";
import { agencyEvents } from "@/lib/calEvents";
import { SIDO_SHORT, mapLinks } from "@/lib/geo";
import { getPublicOrgStrict, getPublicOrgs, type PublicOrg } from "@/lib/govData";
import { getJobsByOrg } from "@/lib/pubJobs";
import { agencyRelated } from "@/lib/related";
import { pageGraph } from "@/lib/schema";
import { withOg } from "@/lib/seo";

/**
 * 공공기관 사업·행사·시설 한 건의 상세(2026-11-15).
 *
 * 목록(/agency·/agency/events·/agency/facilities)의 카드가 원문·지도·검색으로 바로 나가 버려
 * 사이트에 머물 자리가 없었다. 여기서 대상·기간·장소·내용을 다 읽고, 이 기관의 다른 사업과
 * 기관 정보·채용 공고를 본 다음에 맨 아래 단추로 나가게 한다.
 *
 * 자료는 알리오 플러스를 받아 둔 agency_items 그대로다. 본문이 짧은 것은 알리오 한 줄을 옮긴 것뿐이라
 * 검색에 내놓지 않는다(noindex,follow). 사이트맵에도 아직 넣지 않는다.
 */
export const revalidate = 21600;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

type P = { params: { id: string } };

/** 기관 이름의 "(재)"·"(사)" 같은 법인 표시와 빈칸을 떼고 견준다. */
const bare = (name: string) => name.replace(/^\((사|재|주|특|학)\)\s*/, "").replace(/\s+/g, "").trim();
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const cleanUrl = (u: string) => u.replace(/^(https?:\/\/)\s+/, "$1");
/** "o 가\no 나" 같은 줄을 목록으로. 머리 기호는 뗀다(app/orgs/[id] 와 같은 방식). */
const bullets = (text: string | null): string[] =>
  (text ?? "").split("\n").map((l) => l.replace(/^[o○•\-·ㅇ*]\s*/, "").trim()).filter(Boolean);

function describe(kind: AgencyKind, it: AlioItem): string {
  const k = AGENCY_KIND[kind].label;
  const head = `${josa(it.org ?? "공공기관", "이가")} 운영하는 ${k} ‘${it.title}’.`;
  const facts = [
    it.target ? `대상 ${cut(it.target, 40)}` : "",
    it.start || it.end ? `기간 ${dot(it.start) ?? ""}~${dot(it.end) ?? ""}` : "",
    it.address ? `장소 ${cut(it.address, 30)}` : "",
  ].filter(Boolean).join(" · ");
  return cut([head, facts, it.desc ?? ""].filter(Boolean).join(" "), 155);
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const found = await agencyItemBySlug(params.id);
  if (!found) return withOg({ title: "찾을 수 없는 항목" });
  const { kind, item: it } = found;
  const thin = (it.desc?.length ?? 0) < AGENCY_TEXT_MIN;
  return withOg({
    title: `${cut(it.title, 40)} — ${it.org ?? "공공기관"} ${AGENCY_KIND[kind].label}`,
    description: describe(kind, it),
    keywords: [it.title, it.org ?? "", `${it.org ?? "공공기관"} ${AGENCY_KIND[kind].label}`, AGENCY_KIND[kind].listName].filter(Boolean),
    alternates: { canonical: `/agency/${params.id}` },
    ...(thin ? { robots: { index: false, follow: true } } : {}),
  });
}

export default async function AgencyItemPage({ params }: P) {
  const found = await agencyItemBySlug(params.id);
  if (!found) notFound();
  const { kind, item: it, all } = found;
  const K = AGENCY_KIND[kind];
  const path = `/agency/${params.id}`;

  const st = phase(it);
  const fee = it.tags.find((t) => t === "무료" || t === "유료");
  const avail = it.tags.find((t) => t === "신청 가능" || t === "예약 가능");
  const rest = it.tags.filter((t) => t !== fee && t !== avail);
  const cate = lastCate(it.cate);
  const lines = it.desc ? descLines(it.desc) : [];
  const events = agencyEvents(it);

  // 같은 기관의 다른 것, 같은 분류의 다른 것. 겹치지 않게.
  const sameOrg = it.org ? all.filter((x) => x.id !== it.id && x.org === it.org).slice(0, 6) : [];
  const sameCate = cate
    ? all.filter((x) => x.id !== it.id && x.org !== it.org && lastCate(x.cate) === cate).slice(0, 6)
    : [];

  // 기관 정보(잡알리오 342곳)와 잇는다. 이름이 꼭 같지 않아 법인 표시·빈칸을 떼고 견준다.
  const orgs = it.org ? await getPublicOrgs().catch(() => [] as PublicOrg[]) : [];
  const org = it.org ? orgs.find((o) => bare(o.name) === bare(it.org!)) ?? null : null;

  // 내용 채우기(2026-11-15). 알리오 플러스가 준 것이 설명 두세 줄뿐인 항목이 많다(사업 923건 중 743건이 300자 미만,
  // 대상·기간·주소가 비어 "한눈에 보기"에 운영 기관 한 줄만 남았다). 지어낼 수는 없으니, 이미 갖고 있는 사실로 채운다 —
  // 운영 기관이 무슨 일을 하는 곳인지(잡알리오 기관 정보: 하는 일·설립근거·소재지·홈페이지)와 그 기관의 채용 공고.
  // 곁가지라 못 읽어도 쪽은 그대로 낸다.
  const [full, board] = org
    ? await Promise.all([
        getPublicOrgStrict(org.id).catch(() => null),
        getJobsByOrg(bare(org.name), 30)
          .then((b) => (b.jobs.length || bare(org.name) === org.name ? b : getJobsByOrg(org.name, 30)))
          .catch(() => null),
      ])
    : [null, null];
  const roles = bullets(full?.roles ?? null).slice(0, 6);
  const openJobs = (board?.jobs ?? []).filter((j) => j.status !== "closed").slice(0, 4);
  const shownJobs = openJobs.length ? openJobs : (board?.jobs ?? []).slice(0, 3);
  const orgPlace = org ? [org.sido ? SIDO_SHORT[org.sido] ?? org.sido : "", org.sigungu].filter(Boolean).join(" ") : "";
  const orgLinks = org?.address ? mapLinks(`${orgPlace} ${org.address.split(",")[0]}`.trim()) : null;
  const orgTotal = it.org ? all.filter((x) => x.org === it.org).length : 0;

  const links = it.address ? mapLinks(it.address) : null;
  const searchQ = encodeURIComponent([it.org, it.title].filter(Boolean).join(" "));
  const outLabel = avail === "예약 가능" ? "예약하러 가기" : avail ? "신청하러 가기" : "기관 안내(원문) 보기";

  return (
    <div className="pb-4">
      <JsonLd data={pageGraph({
        path, name: it.title, description: describe(kind, it),
        crumbs: [{ name: "공공기관", path: "/agency" }, ...(kind === "business" ? [] : [{ name: K.listName, path: K.list }]), { name: it.title }],
      })} />

      <nav aria-label="길잡이" className="mt-3 text-[12.5px] text-muted">
        <Link href="/agency" className="hover:text-ink">공공기관</Link>
        {kind !== "business" && (<> <span aria-hidden>›</span> <Link href={K.list} className="hover:text-ink">{K.listName}</Link></>)}
        {" "}<span aria-hidden>›</span> <span className="text-ink2">{cut(it.title, 28)}</span>
      </nav>

      <PageBanner tone="indigo"
        eyebrow={`공공기관 ${K.label}${it.org ? ` · ${it.org}` : ""}`}
        title={it.title}
        sub={it.target ? `대상: ${cut(it.target, 90)}` : `${josa(it.org ?? "공공기관", "이가")} 직접 운영하는 ${K.label}입니다.`}
        art={<IllusAgency />}
      >
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {avail && <span className="badge badge-open">{avail}</span>}
          {st && <span className={`badge ${st.cls}`}>{st.label}</span>}
          {fee && <span className={`badge ${fee === "무료" ? "badge-new" : "badge-quiet"}`}>{fee}</span>}
          {cate && <span className="badge badge-quiet">{cate}</span>}
          {rest.map((t) => <span key={t} className="badge badge-quiet">{t}</span>)}
        </div>
      </PageBanner>

      <section className="card mt-6 p-5">
        <h2 className="text-[1.0625rem] font-bold leading-snug">한눈에 보기</h2>
        <dl className="mt-4 grid gap-x-6 gap-y-2.5 text-[14px] sm:grid-cols-[6rem_1fr]">
          <dt className="text-muted">운영 기관</dt>
          <dd>{org ? <Link href={`/orgs/${org.id}`} className="font-semibold text-brand underline underline-offset-4">{it.org}</Link> : it.org ?? "—"}</dd>
          {it.target && (<><dt className="text-muted">대상</dt><dd className="leading-relaxed">{it.target}</dd></>)}
          {(it.start || it.end) && (<><dt className="text-muted">기간</dt><dd className="num">{dot(it.start) ?? "—"} ~ {dot(it.end) ?? "—"}</dd></>)}
          {it.address && (
            <><dt className="text-muted">장소</dt>
            <dd>
              {it.address}
              {links && (
                <span className="ml-2 inline-flex gap-1.5 align-middle">
                  <a href={links.kakao} target="_blank" rel="noopener noreferrer" className="chip !py-0.5 !text-[12px]">카카오맵</a>
                  <a href={links.naver} target="_blank" rel="noopener noreferrer" className="chip !py-0.5 !text-[12px]">네이버지도</a>
                </span>
              )}
            </dd></>
          )}
          {it.cate && (<><dt className="text-muted">분류</dt><dd>{it.cate}</dd></>)}
          {fee && (<><dt className="text-muted">요금</dt><dd>{fee}</dd></>)}
          {org?.ministry && (<><dt className="text-muted">소관 부처</dt><dd>{org.ministry}</dd></>)}
          {org?.kind && (<><dt className="text-muted">기관 유형</dt><dd>{org.kind}</dd></>)}
          {org?.address && (
            <><dt className="text-muted">기관 소재지</dt>
            <dd>
              {orgPlace && !org.address.includes(orgPlace.split(" ")[0]) ? `${orgPlace} ` : ""}{org.address}
              {!it.address && orgLinks && (
                <span className="ml-2 inline-flex gap-1.5 align-middle">
                  <a href={orgLinks.kakao} target="_blank" rel="noopener noreferrer" className="chip !py-0.5 !text-[12px]">카카오맵</a>
                  <a href={orgLinks.naver} target="_blank" rel="noopener noreferrer" className="chip !py-0.5 !text-[12px]">네이버지도</a>
                </span>
              )}
            </dd></>
          )}
          {org?.homepage && (
            <><dt className="text-muted">홈페이지</dt>
            <dd className="break-all"><a href={org.homepage} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-4">{org.homepage}</a></dd></>
          )}
          {orgTotal > 1 && (
            <><dt className="text-muted">이 기관의 {K.label}</dt>
            <dd><Link href={`${K.list}?q=${encodeURIComponent(bare(it.org ?? "").slice(0, 8))}`} className="text-brand underline underline-offset-4">모두 <span className="num">{orgTotal}</span>건 보기</Link></dd></>
          )}
        </dl>
        {events.length > 0 && (
          <div className="mt-4 flex justify-end border-t border-line pt-3">
            <CalendarAdd size="sm" events={events} file={it.title} />
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">내용</h2>
        {lines.length > 0 ? (
          <ul className="mt-4 space-y-2 text-[15px] leading-[1.8] text-ink2">
            {lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        ) : (
          <p className="mt-4 text-[14.5px] leading-relaxed text-muted">
            기관이 알리오 플러스에 올린 설명이 없습니다. 아래 기관 안내에서 대상과 신청 방법을 확인하세요.
          </p>
        )}
      </section>

      {org && (
        <section className="mt-10">
          <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">운영 기관은 어떤 곳인가</h2>
          <div className="card mt-4 p-5">
            <div className="flex items-start gap-3">
              <OrgMark org={org.name} hire="공공" />
              <div className="min-w-0">
                <b className="block text-[15px]">{org.name}</b>
                <span className="text-[12.5px] text-muted">{[org.kind, org.ministry ? `${org.ministry} 소관` : "", org.sido].filter(Boolean).join(" · ")}</span>
              </div>
            </div>
            {org.intro && <p className="mt-3 line-clamp-6 text-[14px] leading-relaxed text-ink2">{org.intro}</p>}
            {roles.length > 0 && (
              <>
                <h3 className="mt-5 text-[14px] font-bold">이 기관이 하는 일</h3>
                <ul className="mt-2 grid gap-1.5">
                  {roles.map((r, i) => <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink2"><span className="text-brand" aria-hidden>•</span><span>{r}</span></li>)}
                </ul>
              </>
            )}
            {(full?.basis || full?.head) && (
              <dl className="mt-5 grid gap-x-6 gap-y-2 border-t border-line pt-4 text-[13.5px] sm:grid-cols-[5.5rem_1fr]">
                {full?.basis && (<><dt className="text-muted">설립 근거</dt><dd className="leading-relaxed">{full.basis}</dd></>)}
                {full?.head && (<><dt className="text-muted">기관장</dt><dd>{full.head.replace(/\s+/g, "")}</dd></>)}
              </dl>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/orgs/${org.id}`} className="btn btn-ghost px-4 py-2 text-[13.5px]">기관 정보 보기</Link>
              <Link href={`/jobs/org/${encodeURIComponent(org.name.replace(/^\((사|재|주|특|학)\)\s*/, ""))}`} className="btn btn-ghost px-4 py-2 text-[13.5px]">이 기관 채용 공고</Link>
            </div>
          </div>
        </section>
      )}

      {org && shownJobs.length > 0 && (
        <section className="mt-10">
          <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">
            {it.org}의 {openJobs.length ? "접수 중인 채용 공고" : "최근 채용 공고"}
          </h2>
          <ul className="mt-4 grid gap-2">
            {shownJobs.map((j) => (
              <li key={j.id} className="card card-link flex items-start gap-3 p-4">
                <span className={`badge ${j.status === "closed" ? "badge-closed" : j.status === "upcoming" ? "badge-soon" : "badge-open"}`}>
                  {j.status === "closed" ? "마감" : j.status === "upcoming" ? "접수 예정" : "접수 중"}
                </span>
                <Link href={`/jobs/${encodeURIComponent(j.id)}`} className="min-w-0 flex-1 text-[14.5px] font-bold leading-snug hover:text-brand">{j.title}</Link>
                <span className="num shrink-0 text-[12.5px] text-muted">{j.end ? `~${dot(j.end)}` : j.reg ? dot(j.reg) : ""}</span>
              </li>
            ))}
          </ul>
          <Link href={`/jobs/org/${encodeURIComponent(board?.jobs[0]?.org ?? bare(org.name))}`} className="mt-3 inline-flex text-sm font-semibold text-brand hover:underline">
            {it.org} 채용 공고 모두 보기 →
          </Link>
        </section>
      )}

      {sameOrg.length > 0 && (
        <section className="mt-10">
          <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">{it.org}의 다른 {K.label}</h2>
          <ItemLinks kind={kind} items={sameOrg} />
        </section>
      )}

      <AdSlot name="page_bottom" />

      {sameCate.length > 0 && (
        <section className="mt-10">
          <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">같은 분야({cate})의 다른 {K.label}</h2>
          <ItemLinks kind={kind} items={sameCate} showOrg />
        </section>
      )}

      {/* 나가는 길은 내용을 다 본 뒤 맨 아래에. */}
      <section className="card mt-10 p-5">
        <h2 className="text-[1.0625rem] font-bold leading-snug">{avail ? "신청·예약은 기관에서 합니다" : "자격과 기간의 최종 확인은 기관에서"}</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          여기 내용은 기획재정부 알리오 플러스에 기관이 올린 그대로입니다. 대상·기간이 바뀌었을 수 있으니 신청 전에 기관 안내를 확인하세요.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {it.url ? (
            <a href={cleanUrl(it.url)} target="_blank" rel="noopener noreferrer" className="btn btn-primary px-5 py-2.5 text-[14px]">{outLabel} ↗</a>
          ) : org?.homepage ? (
            <a href={org.homepage} target="_blank" rel="noopener noreferrer" className="btn btn-primary px-5 py-2.5 text-[14px]">{it.org} 홈페이지 ↗</a>
          ) : (
            <a href={`https://search.naver.com/search.naver?query=${searchQ}`} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-primary px-5 py-2.5 text-[14px]">기관 안내 검색해 보기 ↗</a>
          )}
          <Link href={K.list} className="btn btn-ghost px-5 py-2.5 text-[14px]">{K.listName} 더 보기</Link>
        </div>
      </section>

      <GuideBanner />
      <RelatedLinks items={agencyRelated()} />
    </div>
  );
}

function ItemLinks({ kind, items, showOrg }: { kind: AgencyKind; items: AlioItem[]; showOrg?: boolean }) {
  return (
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
      {items.map((x) => (
        <li key={x.id}>
          <Link href={agencyHref(kind, x.id)} className="card card-link block p-3.5">
            <b className="line-clamp-2 text-[14px] leading-snug">{x.title}</b>
            <span className="mt-1 block truncate text-[12.5px] text-muted">
              {[showOrg ? x.org : "", x.target ? `대상 ${x.target}` : "", x.address ?? ""].filter(Boolean).join(" · ") || lastCate(x.cate) || ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
