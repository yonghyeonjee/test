import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HousingPage from "@/components/HousingPage";
import {
  KINDS, KIND_KEYS, WHO, WHO_KEYS, countOf, housingCounts, housingPath, housingTitle, isKind, isWho,
} from "@/lib/housing";

export const revalidate = 21600;
export const dynamicParams = true;

export function generateStaticParams() {
  return WHO_KEYS.flatMap((who) => KIND_KEYS.map((kind) => ({ kind, who })));
}

export async function generateMetadata({ params }: { params: { kind: string; who: string } }): Promise<Metadata> {
  const { kind, who } = params;
  if (!isKind(kind) || !isWho(who)) return { title: "찾을 수 없는 쪽" };
  const counts = await housingCounts().catch(() => []);
  const n = countOf(counts, kind, who);
  const k = KINDS[kind], w = WHO[who];
  const title = housingTitle(kind, who, undefined, n);
  return {
    title,
    description: `${w.label}이(가) 받을 수 있는 ${k.noun} 지원 총정리. 주택도시기금 대출 조건과 지금 접수 중인 지자체 사업 ${n}건을 지역별로 봅니다.`,
    keywords: [
      `${w.label} ${k.label} 지원`, `${w.label} ${k.label} 대출`, `${w.label} ${k.title}`,
      `${w.label} ${k.label}자금 대출이자 지원`, `${w.label} 주거 지원`, `${w.label} 주택 지원`,
      ...(kind === "buy" ? [`${w.label} 주택구입자금대출`, `${w.label} 디딤돌`, `${w.label} 내집마련`] : []),
      ...(kind === "jeonse" ? [`${w.label} 버팀목`, `${w.label} 전세대출`] : []),
      ...(kind === "wolse" ? [`${w.label} 월세지원`, `${w.label} 주거비 지원`] : []),
    ],
    alternates: { canonical: housingPath(kind, who) },
  };
}

export default function Page({ params }: { params: { kind: string; who: string } }) {
  const { kind, who } = params;
  if (!isKind(kind) || !isWho(who)) notFound();
  return <HousingPage kind={kind} who={who} />;
}
