/**
 * 정부 공고 원문을 읽을 수 있게 쪼갠다.
 *
 * 복지로·기업마당이 주는 본문에는 줄바꿈이 없다. 한 줄에 다 붙어 온다.
 *
 *   "- 접수처 : 주소지 동 행정복지센터 - 접수방법 : 본인 직접 방문 접수
 *    (09:00 ~ 18:00, 토·일, 공휴일 제외) * 대리접수 ... 등 불가- 제출서류
 *    * 공고일 이후 발급분만 유효 1) 신혼부부 ... 신청서 1부 2) ..."
 *
 * 그런데 원문에는 구조가 있다 — "-"는 항목, "1)"은 서류 목록, "*"는 단서다.
 * 표시만 살려 내면 읽을 수 있는 글이 된다. whitespace-pre-line 은 줄바꿈이
 * 있어야 듣는데 줄바꿈 자체가 없으니 아무 일도 하지 않았다.
 *
 * 글자는 하나도 바꾸지 않는다. 자르는 자리만 찾는다.
 */

export type Block =
  /** "- 접수처 : 주소지 동 행정복지센터" — 이름과 값이 나뉘는 항목 */
  | { kind: "field"; label: string; value: string }
  /** "- 제출서류" 처럼 값 없이 이름만 있는 소제목 */
  | { kind: "head"; text: string }
  /** "1) 신청서 1부" */
  | { kind: "item"; n: string; text: string }
  /** "* 공고일 이후 발급분만 유효" — 단서·주의 */
  | { kind: "note"; text: string }
  | { kind: "text"; text: string };

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

/** 표시 앞에서 줄을 끊는다. 표시는 붙어 오기도 한다 ("…등 불가- 제출서류"). */
function breakUp(src: string) {
  let s = src.replace(/\s+/g, " ").trim();

  // 1) 2) … — 여는 괄호나 숫자 뒤가 아닐 때만. "1부(…)" 같은 것은 건드리지 않는다.
  s = s.replace(/(?<![(（\d])\s*(\d{1,2}\))\s*(?=\S)/g, "\n$1 ");
  // ①②③ …
  s = s.replace(new RegExp(`\\s*([${CIRCLED}])\\s*`, "g"), "\n$1 ");
  // - 항목. 뒤에 한글·영문이 와야 한다(날짜 2025-01, 범위 표기와 구분).
  s = s.replace(/\s*[-−]\s+(?=[가-힣A-Za-z])/g, "\n- ");
  // * ※ ○ □ ▶ ◦ 단서·머리표
  s = s.replace(/\s*([*※○□▶◦])\s*(?=\S)/g, "\n$1 ");

  return s.split("\n").map((l) => l.trim()).filter(Boolean);
}

/**
 * "이름 : 값"으로 볼 수 있나.
 *
 * 시각 표기("09:00 ~ 18:00")가 이름:값으로 잘못 잡히면 "09"라는 이름이
 * 생긴다. 이름 쪽에 글자가 하나라도 있어야 이름으로 본다.
 */
function asField(line: string): Block | null {
  const m = line.match(/^([^:：]{1,20})\s*[:：]\s*(.+)$/);
  if (!m) return null;
  const label = m[1].trim();
  if (!/[가-힣A-Za-z]/.test(label)) return null;
  return { kind: "field", label, value: m[2].trim() };
}

export function parseGovText(src: string | null | undefined): Block[] {
  if (!src?.trim()) return [];
  return breakUp(src).map((line): Block => {
    const num = line.match(/^(\d{1,2}\)|[①-⑳])\s*(.*)$/);
    if (num) return { kind: "item", n: num[1], text: num[2] };

    if (/^[*※]/.test(line))
      return { kind: "note", text: line.replace(/^[*※]\s*/, "") };

    const bullet = line.match(/^[-○□▶◦]\s*(.*)$/);
    if (bullet) {
      const rest = bullet[1];
      // "접수처 : 주소지 동 행정복지센터" → 이름과 값으로.
      return asField(rest) ?? { kind: "head", text: rest };
    }

    return asField(line) ?? { kind: "text", text: line };
  });
}

/** 쪼갤 만한 구조가 있나. 없으면 원문을 그대로 두는 편이 낫다. */
export function hasStructure(src: string | null | undefined) {
  const b = parseGovText(src);
  return b.length > 1 && b.some((x) => x.kind !== "text");
}
