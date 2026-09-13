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

/**
 * "1) 2) …" 목록 번호 앞에서 줄을 끊는다.
 *
 * 정규식만으로는 괄호 안의 숫자를 가려내지 못했다. "보증금 + (월임대료×12)
 * ÷ 제한 산정률" 의 "12)" 를 목록 번호로 읽어 한 문장을 두 동강 냈다.
 * 앞 글자만 봐서는 알 수 없다 — 괄호가 열려 있는지를 세어야 한다.
 *
 * 그래서 한 글자씩 훑으며 괄호 깊이를 센다. 깊이가 0일 때 나오는
 * "숫자)" 만 목록 번호로 본다.
 */
function splitNumbered(src: string) {
  let out = "";
  let depth = 0;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (c === "(" || c === "（") {
      depth++;
      out += c;
      continue;
    }
    if ((c === ")" || c === "）") && depth > 0) {
      depth--;
      out += c;
      continue;
    }

    // 괄호 밖에서만, 그리고 숫자 한가운데가 아닐 때만 번호로 본다.
    const prev = src[i - 1] ?? "";
    if (depth === 0 && !/[\d.]/.test(prev)) {
      // "1)" 꼴
      const paren = src.slice(i).match(/^(\d{1,2})\)\s*(?=\S)/);
      if (paren) {
        out += `\n${paren[1]}) `;
        i += paren[0].length - 1;
        continue;
      }
      // "1." 꼴. 날짜("2025. 1. 1. 부터")와 갈라야 한다.
      //  - 뒤에 또 숫자가 오면 날짜다: "2025. 1. 1" 의 앞 두 마디.
      //  - 여기까지 써 놓은 것이 "숫자." 로 끝나도 날짜다: "2025. 1. " 다음의
      //    마지막 "1. 부터" 가 그렇다. 뒤만 봐서는 목록과 구별되지 않는다.
      const dated = /\d\.$/.test(out.replace(/\s+$/, ""));
      const dot = dated ? null : src.slice(i).match(/^(\d{1,2})\.\s+(?=[^\d\s])/);
      if (dot) {
        out += `\n${dot[1]}. `;
        i += dot[0].length - 1;
        continue;
      }
    }
    out += c;
  }
  return out;
}

/** 표시 앞에서 줄을 끊는다. 표시는 붙어 오기도 한다 ("…등 불가- 제출서류"). */
function breakUp(src: string) {
  let s = src.replace(/\s+/g, " ").trim();

  s = splitNumbered(s);
  // ①②③ …
  s = s.replace(new RegExp(`\\s*([${CIRCLED}])\\s*`, "g"), "\n$1 ");
  // - 항목. 뒤에 한글·영문이 와야 한다(날짜 2025-01, 범위 표기와 구분).
  s = s.replace(/\s*[-−]\s+(?=[가-힣A-Za-z])/g, "\n- ");
  // 머리표. 부처마다 쓰는 글자가 다르다 — 실제로 본 것을 모두 넣는다.
  // "▤ 주택기준 : …" 이 안 잡혀 요약 문단 한가운데 그대로 박혀 있었다.
  // 가운뎃점(·)은 넣지 않는다. "청년·신혼" 처럼 낱말 안에서 쓰인다.
  s = s.replace(/\s*([*※○●□■▢▣▤▥▦▧▨▩◇◆▶▷◈◦▪▫‣])\s*(?=\S)/g, "\n$1 ");
  // ㅇ·ㅁ 은 공문서에서 제일 흔한 머리표인데 빠져 있었다. 실제로
  // "ㅇ보훈예우수당 : 월 12만원ㅇ매월 말 지급" 이 한 줄로 붙어 나왔다.
  // 낱자라 낱말에 섞일 일이 거의 없지만, 뒤에 글자가 바로 붙을 때만 본다.
  s = s.replace(/\s*([ㅇㅁ])\s*(?=[가-힣A-Za-z0-9(「【[])/g, "\n$1 ");

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
    const num = line.match(/^(\d{1,2}[).]|[①-⑳])\s*(.*)$/);
    if (num) return { kind: "item", n: num[1], text: num[2] };

    if (/^[*※]/.test(line))
      return { kind: "note", text: line.replace(/^[*※]\s*/, "") };

    const bullet = line.match(/^[-○●□■▢▣▤▥▦▧▨▩◇◆▶▷◈◦▪▫‣ㅇㅁ]\s*(.*)$/);
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
