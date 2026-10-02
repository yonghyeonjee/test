import type { Metadata } from "next";
import { withOg } from "@/lib/seo";
import { notFound } from "next/navigation";
import HousingPage from "@/components/HousingPage";
import {
  KINDS, KIND_KEYS, WHO, WHO_KEYS, countFor, housingCounts, housingPath, housingTitle, isKind, isWho, sidosFor,
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
  const counts = await housingCounts().catch(() => []);
  const n = countFor(counts, kind, who, sido);
  const k = KINDS[kind], w = WHO[who];
  const title = housingTitle(kind, who, sido, n);
  return withOg({
    title,
    description: `${sido} ${w.label} ${k.noun} 지원 총정리. 지금 접수 중인 시·군 사업 ${n}건과 주택도시기금 대출 조건을 한 화면에서 봅니다.`,
    keywords: [
      `${sido} ${w.label} ${k.label} 지원`, `${sido} ${w.label} ${k.label} 대출`, `${sido} ${w.label} ${k.title}`,
      `${sido} ${w.label} ${k.label}자금 대출이자 지원`, `${sido} ${w.label} 주거비 지원`, `${sido} ${w.label} 주거 지원`,
      ...(kind === "buy" ? [`${sido} ${w.label} 주택구입자금대출`, `${sido} ${w.label} 매매 대출`] : []),
    ],
    alternates: { canonical: housingPath(kind, who, sido) },
    // 사업이 없는 시·도는 얇은 쪽이다. 색인하지 않는다.
    ...(n === 0 ? { robots: { index: false, follow: true } } : {}),
  });
}

export default function Page({ params }: { params: { kind: string; who: string; sido: string } }) {
  const { kind, who } = params;
  const sido = decodeURIComponent(params.sido);
  if (!isKind(kind) || !isWho(who) || !/^[가-힣]{2,12}$/.test(sido)) notFound();
  return <HousingPage kind={kind} who={who} sido={sido} />;
}
