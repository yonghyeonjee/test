import { getSiteConfig, type AdSlotName } from "@/lib/settings";

/**
 * 광고 지면.
 *
 * 관리자가 켠 자리에만, 본문이 끝난 뒤에만 나온다. 첫 화면과 목록 사이에는
 * 두지 않는다 — 읽던 사람을 끊는 광고는 결국 아무도 안 누른다. 높이를
 * 제한하고 "광고"라고 적어 본문과 헷갈리지 않게 한다. 비어 있으면 자리
 * 자체를 그리지 않는다.
 *
 * HTML 종류는 관리자가 넣은 스크립트(애드센스 등)를 그대로 심는다. 관리자만
 * 쓰는 입력이라 그렇게 둔다.
 */
export default async function AdSlot({ name }: { name: AdSlotName }) {
  const { ads } = await getSiteConfig();
  const s = ads[name];
  if (!s?.on) return null;
  if (s.kind === "image" ? !s.img : !s.html.trim()) return null;

  return (
    <aside className="ad-slot mt-12" aria-label="광고">
      <span className="ad-tag">광고</span>
      {s.kind === "image" ? (
        <a href={s.href || "#"} target="_blank" rel="noopener noreferrer sponsored" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.img} alt={s.alt || "광고"} className="mx-auto max-h-[140px] w-auto max-w-full" loading="lazy" />
        </a>
      ) : (
        <div className="ad-html" dangerouslySetInnerHTML={{ __html: s.html }} />
      )}
    </aside>
  );
}
