import { pct, type RateBoard } from "@/lib/rentRate";

/**
 * 은행별 금리표.
 *
 * 한 은행에 보증비율이 다른 조건이 두 줄 붙는다. 은행 이름을 두 번 적으면
 * 같은 은행이 두 곳인 것처럼 보이므로 rowSpan 으로 묶는다.
 * 좁은 화면에서는 표만 가로로 밀어서 본다. 표를 접으면 비교가 안 된다.
 */
export default function RateTable({ board }: { board: RateBoard }) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="num w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-line2 text-left text-[13px] text-muted">
            <th className="py-2.5 pr-3 font-semibold">은행</th>
            <th className="py-2.5 pr-3 text-right font-semibold">보증비율</th>
            <th className="py-2.5 pr-3 text-right font-semibold">기준금리</th>
            <th className="py-2.5 pr-3 text-right font-semibold">가산금리</th>
            <th className="py-2.5 pr-3 text-right font-semibold">적용금리</th>
            <th className="py-2.5 text-right font-semibold">고객센터</th>
          </tr>
        </thead>
        <tbody>
          {board.banks.map((b) =>
            (b.tiers.length ? b.tiers : [null]).map((t, i) => (
              <tr key={`${b.bank}-${i}`} className="border-b border-line">
                {i === 0 && (
                  <th
                    scope="row"
                    rowSpan={Math.max(b.tiers.length, 1)}
                    className="py-2.5 pr-3 text-left align-middle font-bold"
                  >
                    {b.bank}
                  </th>
                )}
                <td className="py-2.5 pr-3 text-right text-muted">
                  {t?.ratio === null || t === null ? "—" : `${t.ratio}%`}
                </td>
                <td className="py-2.5 pr-3 text-right text-muted">{pct(t?.base ?? null)}</td>
                <td className="py-2.5 pr-3 text-right text-muted">{pct(t?.extra ?? null)}</td>
                <td className="py-2.5 pr-3 text-right font-bold text-brand">
                  {pct(t?.rate ?? null)}
                </td>
                {i === 0 && (
                  <td
                    rowSpan={Math.max(b.tiers.length, 1)}
                    className="py-2.5 text-right align-middle text-muted"
                  >
                    {b.callCenter ?? "—"}
                  </td>
                )}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
