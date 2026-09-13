import { parseGovText, type Block } from "@/lib/govText";

/**
 * 정부 공고 원문을 읽을 수 있게 보여 준다.
 *
 * 원문은 줄바꿈 없이 한 줄로 온다. 표시(-, 1), *)만 살려 내면 구조가
 * 드러난다. 글자는 하나도 바꾸지 않는다 — 자르고 묶어서 보여 줄 뿐이다.
 *
 * 이름:값 항목은 표처럼, 번호 목록은 번호 목록으로, 별표로 시작하는
 * 단서는 눈에 덜 띄게 옆으로 물려 둔다. 원문에서 단서는 대개 바로 앞
 * 항목에 붙는 말이라, 앞엣것 아래에 들여쓴다.
 */
function Group({ blocks, asHeading }: { blocks: Block[]; asHeading: boolean }) {
  const first = blocks[0];

  if (first.kind === "field")
    return (
      <dl className="mt-3 overflow-hidden rounded-ctl border border-line">
        {blocks.map((b, i) =>
          b.kind === "field" ? (
            // 휴대폰에서는 이름 칸을 따로 두면 값 쪽이 너무 좁아진다.
            // 좁을 때는 위아래로 쌓고, 넓어지면 나란히 놓는다.
            <div key={i} className="border-b border-line px-3.5 py-2.5 last:border-b-0 odd:bg-ground/40
                                    sm:flex sm:gap-3">
              <dt className="break-keep text-[12.5px] font-semibold text-muted sm:w-[5.5rem] sm:shrink-0 sm:text-[13px]">
                {b.label}
              </dt>
              <dd className="mt-0.5 min-w-0 break-keep text-[14px] leading-relaxed sm:mt-0 sm:flex-1">
                {b.value}
              </dd>
            </div>
          ) : null,
        )}
      </dl>
    );

  if (first.kind === "item")
    return (
      <ol className="mt-3 space-y-1.5">
        {blocks.map((b, i) =>
          b.kind === "item" ? (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed">
              <span className="num mt-[3px] w-6 shrink-0 rounded-[6px] bg-brandSoft px-1 py-0.5
                               text-center text-[11px] font-bold text-brand">
                {b.n.replace(/[).]$/, "")}
              </span>
              <span className="min-w-0 flex-1 break-keep">{b.text}</span>
            </li>
          ) : null,
        )}
      </ol>
    );

  // 여기부터는 text 를 가진 종류뿐이다.
  const lines = blocks.flatMap((b) => (b.kind === "field" ? [] : [b.text]));

  if (first.kind === "note")
    return (
      <div className="mt-2 space-y-1 border-l-2 border-line2 pl-3">
        {lines.map((t, i) => (
          <p key={i} className="text-[13px] leading-relaxed text-muted">{t}</p>
        ))}
      </div>
    );

  // "- 제출서류" 처럼 뒤에 목록을 거느리면 소제목이다. 그런데 뒤에 아무것도
  // 안 붙는 줄도 같은 모양으로 온다 — "ㅇ매월 말 지급" 같은 것이 그렇다.
  // 그걸 굵은 제목으로 세우면 다음 칸의 제목처럼 보인다. 거느린 것이 있을
  // 때만 제목으로 쓰고, 아니면 그냥 한 줄로 둔다.
  if (first.kind === "head")
    return asHeading ? (
      <>
        {lines.map((t, i) => (
          <p key={i} className="mt-4 text-[14.5px] font-bold">{t}</p>
        ))}
      </>
    ) : (
      <ul className="mt-3 space-y-1.5">
        {lines.map((t, i) => (
          <li key={i} className="flex gap-2 text-[14px] leading-relaxed">
            <span aria-hidden="true" className="mt-[9px] size-1 shrink-0 rounded-full bg-brand/60" />
            <span className="min-w-0 flex-1 break-keep">{t}</span>
          </li>
        ))}
      </ul>
    );

  return (
    <>
      {lines.map((t, i) => (
        <p key={i} className="mt-3 text-[14px] leading-relaxed">{t}</p>
      ))}
    </>
  );
}

export default function GovText({ body }: { body: string | null }) {
  const blocks = parseGovText(body);
  if (!blocks.length) return null;

  // 같은 종류끼리 이어 붙는 만큼 한 덩어리로 묶는다.
  const groups: Block[][] = [];
  for (const b of blocks) {
    const last = groups[groups.length - 1];
    if (last && last[0].kind === b.kind) last.push(b);
    else groups.push([b]);
  }

  // 소제목인지 아닌지는 뒤에 무엇이 오느냐로 갈린다.
  const leads = new Set(["item", "field", "note"]);
  return (
    <div>
      {groups.map((g, i) => (
        <Group key={i} blocks={g} asHeading={leads.has(groups[i + 1]?.[0]?.kind ?? "")} />
      ))}
    </div>
  );
}
