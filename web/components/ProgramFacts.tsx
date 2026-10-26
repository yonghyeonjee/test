import Link from "next/link";

import type { Detail, ProgramFacts as Facts } from "@/lib/db";
import { TOPICS } from "@/lib/topics";

/**
 * 사업 상세의 "이 사이트에서만 보이는 것"(2026-10-26). 복지로 원문을 옮긴 글만 있는 쪽은 구글이 원문 대신 보여 줄 이유가 없다.
 * 우리 자료 전체를 모아야 나오는 숫자 셋을 글과 링크로 적는다 — 같은 지역에서 지금 접수 중인 다른 사업 수, 같은 시·도의 같은 주제
 * 사업 수, 같은 이름의 사업을 하는 시·도 수. 숫자는 매일 새벽 수집 뒤 바뀐다.
 */
export default function ProgramFacts({ p, f }: { p: Detail; f: Facts | null }) {
  if (!f) return null;
  const where = p.sigungu ? `${p.sido ?? ""} ${p.sigungu}`.trim() : p.sido ?? "전국";
  const areaHref = p.sido
    ? p.sigungu
      ? `/?sido=${encodeURIComponent(p.sido)}&sigungu=${encodeURIComponent(p.sigungu)}&via=facts`
      : `/area/${encodeURIComponent(p.sido)}`
    : "/policies";
  const topic = TOPICS.find((t) => p.topics?.includes(t.key));
  const items: { n: number; label: string; href: string; rel?: string }[] = [];
  if (f.same_area_n > 0) items.push({ n: f.same_area_n, label: `${where}에서 지금 접수 중인 다른 사업`, href: areaHref, rel: areaHref.includes("?") ? "nofollow" : undefined });
  if (topic && f.same_sido_topic_n > 0) items.push({ n: f.same_sido_topic_n, label: `${p.sido ?? "전국"}의 ${topic.long} 사업`, href: `/topic/${topic.slug}` });
  if (f.sidos_with_title > 1) items.push({ n: f.sidos_with_title, label: `"${p.title}" 이름으로 사업을 하는 시·도`, href: `/?q=${encodeURIComponent(p.title)}&via=facts`, rel: "nofollow" });
  if (items.length === 0) return null;

  const sentence = [
    f.same_area_n > 0 ? `${where}에는 이 사업 말고도 접수 중인 사업이 ${f.same_area_n.toLocaleString()}건 있습니다` : null,
    topic && f.same_sido_topic_n > 0 ? `그중 ${topic.name} 쪽만 ${f.same_sido_topic_n.toLocaleString()}건입니다` : null,
    f.sidos_with_title > 1
      ? `같은 이름의 사업을 ${f.sidos_with_title}개 시·도가 따로 운영하니, 사는 곳 기준으로 골라야 합니다`
      : f.sidos_with_title === 1 && p.sido
        ? `같은 이름의 사업은 ${p.sido}에만 있습니다`
        : null,
  ].filter(Boolean).join(". ");

  return (
    <section className="mt-8 rounded-card border border-line bg-surface p-5" aria-labelledby="program-facts">
      <h2 id="program-facts" className="text-sm font-bold">이 사업을 둘러싼 숫자</h2>
      <p className="mt-2 text-[14px] leading-[1.8] text-ink2">{sentence}.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {items.map((it) => (
          <li key={it.label} className="rounded-[12px] bg-white/80 px-3 py-2.5 ring-1 ring-inset ring-line">
            <b className="num block text-[1.2rem] font-extrabold text-ink">{it.n.toLocaleString()}</b>
            <Link href={it.href} rel={it.rel} prefetch={false} className="text-[12.5px] leading-snug text-muted hover:text-brand">{it.label}</Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-faint">복지로·기업마당·소상공인24 공고를 매일 새벽 모아 센 숫자입니다. 접수가 끝난 사업은 빼고 셉니다.</p>
    </section>
  );
}
