/**
 * 기관 머리글자. 로고가 없는 공공기관 수천 곳을 한눈에 가르려고, 기관 이름의
 * 앞 두 글자를 색 있는 둥근 네모에 적는다. 색은 기관 계통(국가·지자체·교육·공공)에 따라.
 */
const TONE: Record<string, string> = {
  국가: "bg-brandSoft text-brand",
  지자체: "bg-[#DDF4F0] text-[#0F766E]",
  교육: "bg-[#FDF0DC] text-[#B45309]",
  공공: "bg-[#FCE7F3] text-[#9D174D]",
};

/** "대법원 수원지방법원 안산지원" → "안산". 맨 뒤 낱말이 실제 기관인 경우가 많다. */
export function orgInitials(org: string | null) {
  if (!org) return "기관";
  const words = org.trim().split(/\s+/);
  const last = words[words.length - 1].replace(/[()\[\]]/g, "");
  const w = last.length >= 2 ? last : words[0];
  return w.slice(0, 2);
}

export default function OrgMark({ org, hire, size = "md" }: { org: string | null; hire?: string | null; size?: "sm" | "md" | "lg" }) {
  const tone = (hire && TONE[hire]) || "bg-ground text-muted";
  const dim = size === "lg" ? "h-14 w-14 text-[17px]" : size === "sm" ? "h-9 w-9 text-[12px]" : "h-11 w-11 text-[14px]";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-[12px] font-extrabold tracking-tight ${tone} ${dim}`}
          aria-hidden>
      {orgInitials(org)}
    </span>
  );
}
