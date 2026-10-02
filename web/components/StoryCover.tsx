import Glyph from "./Glyph";

/**
 * 블로그 글의 머리 그림. 글마다 사진을 구할 수 없으니 갈래(주제·기관·직무·지역)에
 * 따라 색과 표식을 달리한 띠를 쓴다. 목록이 잡지처럼 보이게 하는 것이 목적이다.
 */
const KIND: Record<string, { from: string; to: string; glyph: string; label: string }> = {
  topic:  { from: "#5A4BE0", to: "#7B6CF6", glyph: "spark",    label: "주제별 지원" },
  org:    { from: "#0F766E", to: "#2DD4BF", glyph: "pin",      label: "기관 톺아보기" },
  role:   { from: "#B45309", to: "#F59E0B", glyph: "user",     label: "직무별 채용 시기" },
  region: { from: "#BE123C", to: "#FB7185", glyph: "chart",    label: "지역별 지원" },
  story:  { from: "#1E1B4B", to: "#3B2FB5", glyph: "book",     label: "사례" },
};

export default function StoryCover({ kind, label, className = "" }: { kind: string; label?: string; className?: string }) {
  const k = KIND[kind] ?? KIND.story;
  return (
    <div className={`relative flex h-24 items-end overflow-hidden rounded-t-card px-4 pb-3 text-white ${className}`}
         style={{ background: `linear-gradient(135deg, ${k.from}, ${k.to})` }} aria-hidden>
      <svg viewBox="0 0 320 96" className="absolute inset-0 h-full w-full opacity-20" preserveAspectRatio="none" fill="none" stroke="#fff" strokeWidth="1">
        <path d="M-20 70c60-30 120 30 180 0s120-40 180-10M-20 30c60-30 120 30 180 0s120-40 180-10M-20 110c60-30 120 30 180 0s120-40 180-10" />
      </svg>
      <span className="relative text-[12.5px] font-bold tracking-wide">{label ?? k.label}</span>
      <span className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/15 backdrop-blur-sm">
        <Glyph name={k.glyph} className="h-5 w-5" strokeWidth={2.2} />
      </span>
    </div>
  );
}
