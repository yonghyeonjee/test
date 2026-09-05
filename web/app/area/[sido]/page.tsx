import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProgramEntry from "@/components/ProgramEntry";
import { getArea, getAreas, listByArea } from "@/lib/db";

export const revalidate = 86400;
export const dynamicParams = true;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://jiwon.knowhow-it.com";
const YEAR = new Date().getFullYear();

export async function generateStaticParams() {
  const areas = await getAreas();
  return areas.map((a) => ({ sido: a.sido }));
}

export async function generateMetadata({
  params,
}: {
  params: { sido: string };
}): Promise<Metadata> {
  const sido = decodeURIComponent(params.sido);
  const a = await getArea(sido);
  if (!a) return { title: "찾을 수 없는 지역" };

  const title = `${sido} 지원금·복지서비스 ${a.n}건 총정리 (${YEAR})`;
  const description =
    `${sido}에서 신청할 수 있는 복지서비스 ${a.n}건을 나이·소득·가구 조건별로 정리했습니다. ` +
    `청년 대상 ${a.youth}건, 어르신 ${a.senior}건, 저소득 ${a.low_income}건.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE}/area/${encodeURIComponent(sido)}` },
    openGraph: { title, description, type: "website" },
  };
}

export default async function AreaPage({ params }: { params: { sido: string } }) {
  const sido = decodeURIComponent(params.sido);
  const [area, list, all] = await Promise.all([
    getArea(sido),
    listByArea(sido),
    getAreas(),
  ]);
  if (!area) return notFound();

  const stats = [
    { label: "청년 대상", n: area.youth, q: "age=28" },
    { label: "어르신 대상", n: area.senior, q: "age=68" },
    { label: "저소득 가구", n: area.low_income, q: "hh=저소득" },
    { label: "장애인 가구", n: area.disabled, q: "hh=장애인" },
    { label: "임신·다자녀", n: area.family, q: "hh=다자녀" },
  ].filter((s) => s.n > 0);

  return (
    <article>
      <nav className="mb-6 text-xs text-muted">
        <Link href="/" className="hover:text-ink">지원</Link>
        {" / "}
        <span>{sido}</span>
      </nav>

      <h1 className="text-display font-extrabold leading-tight">
        {sido}에서 받을 수 있는
        <br />
        지원금과 복지서비스
      </h1>

      <p className="mt-5 max-w-[34rem] leading-relaxed">
        {sido}의 시·군·구와 중앙부처가 제공하는 복지서비스 가운데 신청 조건을
        확인할 수 있는 <span className="num font-bold">{area.n}건</span>을
        정리했습니다. 조건을 넣으면 해당될 만한 것만 추려 보여드립니다.
      </p>

      <div className="mt-8 flex flex-wrap gap-1.5">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={`/?sido=${encodeURIComponent(sido)}&${s.q}`}
            className="rounded-full border border-rule bg-white px-3 py-1.5 text-sm
                       text-muted transition-colors hover:border-ink hover:text-ink"
          >
            {s.label} <span className="num font-bold">{s.n}</span>
          </Link>
        ))}
      </div>

      <Link
        href={`/?sido=${encodeURIComponent(sido)}`}
        className="mt-8 block bg-ink px-5 py-4 text-center text-[0.95rem]
                   font-bold text-white transition-opacity hover:opacity-90"
      >
        내 조건으로 찾아보기
      </Link>

      <h2 className="mt-16 border-b-2 border-ink pb-2 text-sm font-bold">
        {sido} 지원사업 목록
      </h2>
      <div className="mt-2 divide-y divide-rule">
        {list.map((p) => (
          <ProgramEntry key={p.id} p={p} />
        ))}
      </div>

      <section className="mt-16">
        <h2 className="border-b-2 border-ink pb-2 text-sm font-bold">다른 지역</h2>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {all
            .filter((a) => a.sido !== sido)
            .map((a) => (
              <Link
                key={a.sido}
                href={`/area/${encodeURIComponent(a.sido)}`}
                className="text-sm text-muted hover:text-ink"
              >
                {a.sido}
                <span className="num ml-1 text-xs">{a.n}</span>
              </Link>
            ))}
        </div>
      </section>
    </article>
  );
}
