import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProgramEntry from "@/components/ProgramEntry";
import {
  ageLabel,
  daysLeft,
  getProgram,
  getRelated,
  getTopSourceIds,
  type Detail,
} from "@/lib/db";

export const revalidate = 86400;
export const dynamicParams = true;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://jiwon.knowhow-it.com";

export async function generateStaticParams() {
  const ids = await getTopSourceIds(400);
  return ids.map((id) => ({ id }));
}

/** 검색 결과에 그대로 노출되는 문장. 지역·대상을 앞쪽에 둔다. */
function seoTitle(p: Detail) {
  const where = p.sigungu || p.sido || "";
  const who: string[] = [];
  const age = ageLabel(p);
  if (age) who.push(age.replace("만 ", ""));
  if (p.household?.length) who.push(p.household[0]);
  const tail = who.length ? ` ${who.join(" ")}` : "";
  return `${where}${tail} ${p.title} 신청자격·방법`.replace(/\s+/g, " ").trim();
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const p = await getProgram(decodeURIComponent(params.id));
  if (!p) return { title: "찾을 수 없는 사업" };

  const desc =
    (p.summary || p.target_text || "").slice(0, 155) ||
    `${p.sigungu || p.sido || ""} ${p.title}의 지원대상과 신청방법을 정리했습니다.`;

  return {
    title: seoTitle(p),
    description: desc,
    alternates: { canonical: `${SITE}/p/${encodeURIComponent(p.source_id)}` },
    openGraph: { title: seoTitle(p), description: desc, type: "article" },
  };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-4 border-b border-rule py-3.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm leading-relaxed">{children}</dd>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <>
      <h2 className="mt-9 border-b-2 border-ink pb-2 text-sm font-bold">{title}</h2>
      <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{body}</p>
    </>
  );
}

export default async function ProgramPage({ params }: { params: { id: string } }) {
  const p = await getProgram(decodeURIComponent(params.id));
  if (!p) return notFound();

  const related = await getRelated(p);
  const left = daysLeft(p);
  const where = p.sigungu || p.sido || "전국";
  const age = ageLabel(p);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GovernmentService",
    name: p.title,
    description: p.summary ?? undefined,
    serviceType: p.kind === "welfare" ? "복지서비스" : "기업지원사업",
    provider: p.org_name
      ? { "@type": "GovernmentOrganization", name: p.org_name }
      : undefined,
    areaServed: p.sido
      ? { "@type": "AdministrativeArea", name: where }
      : { "@type": "Country", name: "대한민국" },
    url: `${SITE}/p/${encodeURIComponent(p.source_id)}`,
  };

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-6 text-xs text-muted">
        <Link href="/" className="hover:text-ink">지원</Link>
        {p.sido && (
          <>
            {" / "}
            <Link href={`/area/${encodeURIComponent(p.sido)}`} className="hover:text-ink">
              {p.sido}
            </Link>
          </>
        )}
      </nav>

      <p className="text-sm font-bold">{where}</p>
      <h1 className="mt-1.5 text-[1.75rem] font-extrabold leading-tight">{p.title}</h1>

      {p.summary && <p className="mt-4 leading-relaxed text-muted">{p.summary}</p>}

      {left !== null && left >= 0 && left <= 30 && (
        <p className="num mt-5 inline-block border-l-[3px] border-due pl-3 text-sm font-bold text-due">
          {left === 0 ? "오늘 접수 마감" : `접수 마감까지 ${left}일`}
        </p>
      )}

      <h2 className="mt-11 border-b-2 border-ink pb-2 text-sm font-bold">
        한눈에 보는 신청 조건
      </h2>
      <dl className="mt-1">
        <Row label="지역">{where}</Row>
        {age && <Row label="나이">{age}</Row>}
        {p.income_pct && <Row label="소득">기준 중위소득 {p.income_pct}% 이하</Row>}
        {!!p.employment?.length && <Row label="취업상태">{p.employment.join(", ")}</Row>}
        {!!p.household?.length && <Row label="해당 가구">{p.household.join(", ")}</Row>}
        {!!p.biz_target?.length && <Row label="사업체">{p.biz_target.join(", ")}</Row>}
        {!!p.biz_field?.length && <Row label="지원분야">{p.biz_field.join(", ")}</Row>}
        {p.support_type && p.support_type !== "기타" && (
          <Row label="지원형태">{p.support_type}</Row>
        )}
        <Row label="접수기간">
          {p.is_always_on || !p.apply_end
            ? "상시 접수"
            : `${p.apply_start ? p.apply_start + " ~ " : "~ "}${p.apply_end}`}
        </Row>
        {p.org_name && <Row label="담당">{p.dept_name || p.org_name}</Row>}
        {p.contact && <Row label="문의">{p.contact}</Row>}
      </dl>

      <Section title="지원대상" body={p.target_text} />
      {p.criteria_text !== p.target_text && (
        <Section title="선정기준" body={p.criteria_text} />
      )}
      <Section title="지원내용" body={p.benefit_text} />
      <Section title="신청방법" body={p.apply_method} />

      {p.detail_url && (
        <a
          href={p.detail_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 block bg-ink px-5 py-4 text-center text-[0.95rem]
                     font-bold text-white transition-opacity hover:opacity-90"
        >
          원문에서 확인하고 신청하기
        </a>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted">
        위 조건은 공고 원문에서 자동으로 추려낸 것이라 실제와 다를 수 있습니다.
        소득·재산 기준처럼 여기 담기지 않은 요건이 남아 있을 수 있으니, 신청 전
        반드시 원문 또는 관할 주민센터에서 확인하세요.
        {p.source.startsWith("bokjiro")
          ? " 출처: 복지로(한국사회보장정보원)"
          : " 출처: 기업마당(중소벤처기업부)"}
      </p>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="border-b-2 border-ink pb-2 text-sm font-bold">
            {where}의 다른 지원사업
          </h2>
          <div className="mt-2 divide-y divide-rule">
            {related.map((r) => (
              <ProgramEntry key={r.id} p={r} />
            ))}
          </div>
          {p.sido && (
            <Link
              href={`/area/${encodeURIComponent(p.sido)}`}
              className="mt-6 inline-block border-b-2 border-rule pb-0.5 text-sm font-bold hover:border-ink"
            >
              {p.sido} 전체 보기
            </Link>
          )}
        </section>
      )}
    </article>
  );
}
