import type { Block } from "./stories";

/**
 * 읽는 시간. 한글은 분에 500자 안팎이 보통이라 600자를 1분으로 잡는다(숫자·표가 많아 조금 빠르다).
 * 1분보다 짧아도 1분으로 적는다 — "0분"은 이상하다.
 */
export function readMinutes(text: string): number {
  const n = text.replace(/\s+/g, "").length;
  return Math.max(1, Math.round(n / 600));
}

/** 블록 글의 본문 글자만 모은다. 링크 목록·표도 읽는 데 시간이 드니 넣는다. */
export function blocksText(blocks: Block[]): string {
  return blocks.map((b) => {
    switch (b.type) {
      case "p": case "note": case "h2": return b.text;
      case "list": return b.items.join(" ");
      case "links": return b.items.map((l) => l.label).join(" ");
      case "table": return b.rows.flat().join(" ");
      case "bars": return b.items.map((x) => x.label).join(" ");
      default: return "";
    }
  }).join(" ");
}
