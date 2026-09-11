import Link from "next/link";
import { groupByField, type LicenseBoard } from "@/lib/qnet";

/**
 * 종목 목록. 계열 칩으로 거른 뒤 대직무분야 → 중직무분야로 접어 보여 준다.
 * 600개 가까운 종목을 한 번에 펼치면 스크롤만 길어지므로, 분야가 넷 이상이면
 * 접어 두고 제목만 보이게 한다.
 */
export default function LicenseList({ board, picked }: { board: LicenseBoard; picked: string }) {
  const list = picked ? board.all.filter((l) => l.series === picked) : board.all;
  const groups = groupByField(list);
  if (!board.ok)
    return (
      <div className="card mt-6 p-8 text-center">
        <p className="leading-relaxed text-muted">
          지금은 종목 목록을 불러오지 못했습니다.
          <br />
          공공데이터 쪽이 잠시 응답하지 않는 경우가 있어, 잠시 뒤 다시 들어오시면 보입니다.
        </p>
        <a href="https://www.q-net.or.kr" target="_blank" rel="noopener noreferrer"
           className="btn btn-ghost mt-5">
          큐넷에서 직접 보기
        </a>
      </div>
    );
  return (
    <>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/license" className={`chip ${picked ? "" : "chip-on"}`}>
              전체
              <span className="num text-[11.5px] font-bold opacity-70">{board.all.length}</span>
            </Link>
            {board.series.map((s) => (
              <Link
                key={s.name}
                href={`/license?series=${encodeURIComponent(s.name)}`}
                className={`chip ${picked === s.name ? "chip-on" : ""}`}
              >
                {s.name}
                <span className="num text-[11.5px] font-bold opacity-70">{s.n}</span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            한국산업인력공단 공공데이터 · 기술사→기능장→기사→산업기사→기능사 순으로 어렵습니다.
          </p>

          <div className="mt-6 space-y-3">
            {groups.map((g) => (
              <details key={g.field} className="card group p-5" open={groups.length <= 3}>
                <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4
                                    [&::-webkit-details-marker]:hidden">
                  <h2 className="text-[15px] font-bold">
                    {g.field}
                    <span className="ml-2 text-xs font-normal text-muted transition-transform
                                     group-open:hidden">펼치기</span>
                  </h2>
                  <span className="num text-xs text-muted">{g.n}종목</span>
                </summary>
                <div className="mt-4 space-y-4">
                  {g.subs.map((s) => (
                    <div key={s.subField || "_"}>
                      {s.subField && (
                        <h3 className="mb-1.5 text-[13px] font-bold text-ink2">{s.subField}</h3>
                      )}
                      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13.5px]">
                        {s.items.map((l) => (
                          <li key={l.code || l.name} className="text-ink2">
                            {l.name}
                            {!picked && (
                              <span className="ml-1 text-[11px] text-faint">{l.series}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
    </>
  );
}
