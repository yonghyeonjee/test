import Link from "next/link";
import { SIDO_SHORT, mapLinks } from "@/lib/geo";
import { fmtPop, fmtPrd, getGovSites, getPublicOrgs, getRegionStats, officesOf, siteOf, type GovSite, type RegionStat } from "@/lib/govData";

/**
 * 지역 쪽의 "관공서와 누리집" 칸(2026-10-21). 시·도청과 시·군·구청의 주소·누리집·인구, 그 시·도에 있는 공공기관.
 * 자료를 못 읽으면 청사 표(코드에 실림)만으로 그린다.
 */
export default async function GovOffices({ sido }: { sido: string }) {
  const offices = officesOf(sido);
  if (!offices.length) return null;
  const [sites, stats, orgs] = await Promise.all([
    getGovSites().catch(() => [] as GovSite[]),
    getRegionStats().catch(() => [] as RegionStat[]),
    getPublicOrgs().catch(() => []),
  ]);
  const sidoStat = stats.find((s) => s.level === 1 && s.sido === sido) ?? null;
  const popOf = (sgg: string) => stats.find((s) => s.level === 2 && s.sido === sido && s.sigungu === sgg)?.pop ?? null;
  const mine = orgs.filter((o) => o.sido === sido);
  const top = offices.find((o) => o.kind === "시·도청");
  // 시·군·구 가나다 차례로 묶고, 그 안에서 시청·군청이 구청보다 먼저(수원시청 → 권선구청 → 장안구청 …).
  const rest = offices.filter((o) => o.kind !== "시·도청")
    .sort((a, b) => a.sgg.localeCompare(b.sgg, "ko") || (a.kind === "구청" ? 1 : 0) - (b.kind === "구청" ? 1 : 0) || a.name.localeCompare(b.name, "ko"));
  const topSite = siteOf(sites, sido, null);
  const short = SIDO_SHORT[sido] ?? sido;

  return (
    <section className="mt-16">
      <h2 className="border-b-2 border-line2 pb-2 text-[1.0625rem] font-bold">{sido} 관공서와 누리집</h2>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        지원사업의 접수처는 대개 시·군·구청과 읍·면·동 행정복지센터입니다. 청사 주소와 누리집을 모았고,
        {sidoStat?.pop ? <> 주민등록인구는 <b className="num text-ink2">{fmtPop(sidoStat.pop)}</b>({fmtPrd(sidoStat.prd)} 기준)입니다.</> : " 누리집 단추로 공고 게시판에 바로 갑니다."}
      </p>

      {top && (
        <div className="card mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 p-5">
          <div className="min-w-0 flex-1">
            <b className="text-[15px]">{top.name}</b>
            <p className="mt-1 text-[13.5px] text-muted">({top.zip}) {top.address}</p>
          </div>
          <span className="flex flex-wrap gap-1.5">
            {topSite && <a href={topSite.url} target="_blank" rel="noopener noreferrer" className="chip !py-1 !text-[12.5px]">누리집 ↗</a>}
            <a href={mapLinks(top.name).kakao} target="_blank" rel="noopener noreferrer" className="chip !py-1 !text-[12.5px]">길찾기</a>
          </span>
        </div>
      )}

      {rest.length > 0 && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {rest.map((o) => {
            const site = siteOf(sites, sido, o.sgg);
            // 구청은 그 구의 인구, 시청·군청은 시·군 전체 인구(주소에 구가 적혀 있어도).
            const pop = popOf(o.kind === "구청" && o.gu ? o.gu : o.sgg);
            return (
              <li key={o.key} className="card flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <b className="text-[14.5px]">{o.name}</b>
                  {pop ? <span className="num ml-2 text-[12px] text-faint">{fmtPop(pop)}</span> : null}
                  <p className="mt-1 text-[13px] leading-snug text-muted">{o.address}</p>
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
                    {site && <a href={site.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">누리집 ↗</a>}
                    <a href={mapLinks(`${o.sgg} ${o.name}`).kakao} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-brand">길찾기</a>
                    <Link href={`/?sido=${encodeURIComponent(sido)}&sigungu=${encodeURIComponent(o.sgg)}&via=area`} className="text-muted hover:text-brand">{o.sgg} 지원사업</Link>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {mine.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[14.5px] font-bold">{short}에 있는 공공기관 <span className="num ml-1 font-normal text-muted">{mine.length}곳</span></h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {mine.slice(0, 12).map((o) => (
              <Link key={o.id} href={`/orgs/${o.id}`} className="chip !py-1 !text-[12.5px]">{o.name}</Link>
            ))}
            {mine.length > 12 && <Link href={`/orgs?sido=${encodeURIComponent(sido)}`} className="chip chip-on !py-1 !text-[12.5px]">모두 보기 →</Link>}
          </div>
        </div>
      )}
      <p className="mt-3 text-[12.5px] text-faint">
        <Link href="/map?kind=orgs" className="underline underline-offset-4 hover:text-brand">정책지도의 관공서·공공기관 탭</Link>에서 지도 위 위치와 가까운 순으로 볼 수 있습니다.
      </p>
    </section>
  );
}
