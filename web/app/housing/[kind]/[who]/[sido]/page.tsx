import type { Metadata } from "next";
import { withOg } from "@/lib/seo";
import { notFound } from "next/navigation";
import HousingPage, { housingDescription } from "@/components/HousingPage";
import {
  KINDS, KIND_KEYS, WHO, WHO_KEYS, SIDO_INDEX_MIN, countFor, countOf, housingCounts, housingPath, housingTitle, isKind, isWho, sidosFor,
} from "@/lib/housing";

export const revalidate = 21600;
export const dynamicParams = true;

/** 사업이 3건 이상인 시·도만 미리 만든다. 나머지는 열릴 때 만든다. */
export async function generateStaticParams() {
  try {
    const counts = await housingCounts();
    return WHO_KEYS.flatMap((who) =>
      KIND_KEYS.flatMap((kind) => sidosFor(counts, kind, who, 3).map((s) => ({ kind, who, sido: s.sido }))),
    );
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: { kind: string; who: string; sido: string } }): Promise<Metadata> {
  const { kind, who } = params;
  const sido = decodeURIComponent(params.sido);
  if (!isKind(kind) || !isWho(who)) return withOg({ title: "찾을 수 없는 쪽" });
  // 못 읽으면 null. 예전에는 빈 목록으로 받아 0건 → noindex 가 되었다 — DB 가 잠깐 흔들려도 색인이 꺼졌다.
  const counts = await housingCounts().catch(() => null);
  const n = counts ? countFor(counts, kind, who, sido) : 0;
  // 그 시·도만의 사업(전국 제외)이 적으면 전국 쪽과 거의 같은 쪽이다(lib/housing SIDO_INDEX_MIN, 2026-10-17).
  // 건수를 못 읽었으면 색인을 끄지 않는다.
  const thin = counts !== null && countOf(counts, kind, who, sido) < SIDO_INDEX_MIN;
  const k = KINDS[kind], w = WHO[who];
  const title = housingTitle(kind, who, sido, n);
  return withOg({
    title,
    description: housingDescription(kind, who, sido, n),
    keywords: [
      `${sido} ${w.label} ${k.label} 지원`, `${sido} ${w.label} ${k.label} 대출`, `${sido} ${w.label} ${k.title}`,
      `${sido} ${w.label} ${k.label}자금 대출이자 지원`, `${sido} ${w.label} 주거비 지원`, `${sido} ${w.label} 주거 지원`,
      ...(kind === "buy" ? [`${sido} ${w.label} 주택구입자금대출`, `${sido} ${w.label} 매매 대출`] : []),
    ],
    alternates: { canonical: housingPath(kind, who, sido) },
    ...(thin ? { robots: { index: false, follow: true } } : {}),
  });
}

export default function Page({ params }: { params: { kind: string; who: string; sido: string } }) {
  const { kind, who } = params;
  const sido = decodeURIComponent(params.sido);
  if (!isKind(kind) || !isWho(who) || !/^[가-힣]{2,12}$/.test(sido)) notFound();
  return <HousingPage kind={kind} who={who} sido={sido} />;
}
