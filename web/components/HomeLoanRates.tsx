import Link from "next/link";
import { getHomeLoanRates, monthLabel, pct, type HomeLoanRates as Rates } from "@/lib/homeLoanRates";

/**
 * 보금자리론·디딤돌 금리표. compact 면 표 둘만(구입 쪽에 끼울 때), 아니면
 * 우대금리와 주석까지(생활금융 쪽).
 */
export default async function HomeLoanRates({ compact = false }: { compact?: boolean }) {
  const r = await getHomeLoanRates();
  if (!r) return null;
  return <RatesView r={r} compact={compact} />;
}

export function RatesView({ r, compact }: { r: Rates; compact: boolean }) {
  const b = r.bogeumjari, d = r.didimdol;
  return (
    <div className="grid gap-4">
      {d.general && (
        <section className="card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-extrabold">디딤돌대출 금리 <span className="text-muted">— {monthLabel(d.month)}</span></h3>
            {d.notice && <span className="num text-xs text-muted">공시 {d.notice.replaceAll("-", ".")}</span>}
          </div>
          <p className="mt-1 text-[13px] text-muted">부부합산 소득 구간 × 만기. 고정금리 또는 5년 단위 변동금리.</p>
          <Table terms={d.general.terms} rows={d.general.rows.map((x) => ({ name: x.band, rates: x.rates }))} head="소득(부부합산)" />
          {d.first_newlywed && (
            <>
              <p className="mt-4 text-[13.5px] font-bold">생애최초로 집을 사는 신혼가구</p>
              <Table terms={d.first_newlywed.terms} rows={d.first_newlywed.rows.map((x) => ({ name: x.band, rates: x.rates }))} head="소득(부부합산)" />
            </>
          )}
          {d.notes[0] && <p className="mt-2 text-xs leading-relaxed text-muted">{d.notes[0]}</p>}
          {!compact && d.prefs.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-ink2">
              {d.prefs.map((p) => <li key={p.slice(0, 40)}>· {p}</li>)}
              {d.floor && <li>· {d.floor}</li>}
            </ul>
          )}
        </section>
      )}

      {b.rows.length > 0 && (
        <section className="card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-extrabold">보금자리론 금리 <span className="text-muted">— {monthLabel(b.month)}</span></h3>
            {b.notice && <span className="num text-xs text-muted">공시 {b.notice.replaceAll("-", ".")}</span>}
          </div>
          <p className="mt-1 text-[13px] text-muted">만기까지 고정금리. 소득 기준이 디딤돌보다 넓은 대신 금리가 높다.</p>
          <Table terms={b.terms} rows={b.rows} head="상품" />
          {b.notes.slice(0, 3).map((n) => <p key={n.slice(0, 30)} className="mt-1.5 text-xs leading-relaxed text-muted">{n}</p>)}
          {!compact && b.prefs.length > 0 && (
            <>
              <p className="mt-4 text-[13.5px] font-bold">우대금리 (최대 1.0%p까지 겹쳐 적용)</p>
              <ul className="mt-2 divide-y divide-line text-[13.5px]">
                {b.prefs.map((p) => (
                  <li key={p.item} className="flex gap-3 py-2">
                    <span className="num w-14 shrink-0 font-bold text-brand">-{p.pct}%p</span>
                    <span className="min-w-0"><b className="font-bold">{p.item}</b>{p.cond && <span className="ml-1.5 text-muted">{p.cond}</span>}</span>
                  </li>
                ))}
                {b.extras.map((p) => (
                  <li key={p.item} className="flex gap-3 py-2">
                    <span className="num w-14 shrink-0 font-bold text-accent">+{p.pct}%p</span>
                    <span className="min-w-0"><b className="font-bold">{p.item}</b>{p.cond && <span className="ml-1.5 text-muted">{p.cond}</span>}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <p className="text-xs leading-relaxed text-muted">
        한국주택금융공사 누리집 금리안내를 {r.checked.replaceAll("-", ".")}에 읽은 것입니다. 실제 적용 금리는 심사 결과와 우대 조건에 따라 다릅니다.
        {compact && (
          <> 우대금리와 조건은 <Link href="/money/home-loan" className="underline underline-offset-4 hover:text-brand">구입자금 대출 금리</Link>에서 봅니다.</>
        )}
      </p>
    </div>
  );
}

function Table({ terms, rows, head }: { terms: string[]; rows: { name: string; rates: number[] }[]; head: string }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[22rem] text-[13.5px]">
        <thead>
          <tr className="border-b-2 border-line2 text-left text-xs text-muted">
            <th className="py-1.5 pr-2 font-normal">{head}</th>
            {terms.map((t) => <th key={t} className="num py-1.5 text-right font-normal">{t}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-line">
              <td className="py-2 pr-2 font-bold leading-snug">{r.name}</td>
              {r.rates.map((v, i) => <td key={i} className="num py-2 text-right">{pct(v)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
