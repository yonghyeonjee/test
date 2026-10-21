import Link from "next/link";
import { orgGroup, sidoShort, type PublicOrg } from "@/lib/govData";

/**
 * 공고·지원사업 상세에 붙는 "이 기관은 어떤 곳인가" 카드(2026-10-21). 공고 원문을 그대로 실은 사이트에는 없는
 * 내용(주무부처·유형·소재지·소개)이라 쪽마다 우리 것이 하나 더 생긴다. 공공기관 정보(잡알리오)에서 받은 것이다.
 */
export default function PublicOrgCard({ org, heading }: { org: PublicOrg; heading?: string }) {
  const bare = org.name.replace(/^\((사|재|주|특|학)\)\s*/, "").trim();
  const intro = (org.intro ?? "").replace(/\s+/g, " ").trim();
  const short = intro.length > 220 ? `${intro.slice(0, 220).replace(/[,\s][^,\s]*$/, "")}…` : intro;
  const where = [sidoShort(org.sido), org.sigungu].filter(Boolean).join(" ");
  const addr = org.address ? (org.sido && org.address.includes(org.sido.slice(0, 2)) ? org.address : `${where} ${org.address}`.trim()) : null;
  return (
    <section className="mt-12" aria-labelledby="org-card-h">
      <h2 id="org-card-h" className="sec-title text-[1.0625rem] font-extrabold">{heading ?? `${bare}은 어떤 곳인가`}</h2>
      <div className="card mt-4 p-5">
        <p className="text-[13px] text-muted">
          {orgGroup(org.kind)}{org.kind && org.kind !== orgGroup(org.kind) ? ` · ${org.kind}` : ""}{org.ministry ? ` · 주무부처 ${org.ministry}` : ""}
        </p>
        {short && <p className="mt-2 text-[15px] leading-[1.85] text-ink2">{short}</p>}
        {addr && <p className="mt-2 text-[13.5px] text-muted">소재지 {addr}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/orgs/${encodeURIComponent(org.id)}`} className="chip">기관 정보·지도</Link>
          <Link href={`/jobs/org/${encodeURIComponent(org.name)}`} className="chip">{bare} 채용 이력</Link>
          {org.homepage && <a href={org.homepage} target="_blank" rel="noopener noreferrer" className="chip">누리집</a>}
        </div>
      </div>
    </section>
  );
}
