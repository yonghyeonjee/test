/**
 * 긴 문단을 문장 단위로 끊어 여러 문단으로 그린다(2026-10-17). 휴대폰에서 한 문단이 열 줄을 넘으면 읽다가 줄을 놓친다.
 * 문장을 차례로 모으다 max 자를 넘으면 새 문단을 연다. 문장 하나가 max 보다 길면 그 문장만 한 문단이 된다.
 */
export function splitParas(text: string, max = 120): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t ? [t] : [];
  // 마침표·물음표·느낌표 뒤 빈칸에서 문장을 나눈다. "1. 서류" 같은 번호 뒤는 끊지 않는다.
  const sents = t.split(/(?<=[^\d\s][.!?。])\s+/);
  const out: string[] = [];
  let cur = "";
  for (const s of sents) {
    if (cur && cur.length + 1 + s.length > max) { out.push(cur); cur = s; }
    else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out;
}

export default function Paras({ text, className, max }: { text: string; className?: string; max?: number }) {
  return <>{splitParas(text, max).map((p, i) => <p key={i} className={className}>{p}</p>)}</>;
}
