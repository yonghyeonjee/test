import Link from "next/link";
import { groupBySeries, type License } from "@/lib/qnet";

/**
 * 국가전문자격 목록.
 *
 * 등급이 없으니 등급 칩도 없다. 대신 갈래로 나뉘는 자격(관광통역안내사 12개
 * 언어, 국가유산수리기능자 24개 직능)만 묶어 보이고, 한 종목뿐인 자격은
 * 한자리에 모은다. 갈래마다 칩을 하나씩 만들면 화면이 칩으로 덮인다.
 */
export default function ProLicenseList({ items }: { items: License[] }) {
  const { multi, single } = groupBySeries(items);

  return (
    <section id="list" className="mt-10">
      <h2 className="sec-title text-[1.0625rem] font-extrabold">자격별 종목 목록</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        종목 이름을 누르면 안내 화면으로 갑니다.
      </p>

      <div className="mt-4 space-y-3">
        {multi.map((g) => (
          <div key={g.series} className="card p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-[15px] font-bold">{g.series}</h3>
              <span className="num text-xs text-muted">{g.items.length}종목</span>
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13.5px]">
              {g.items.map((l) => (
                <li key={l.code || l.name} className="text-ink2">
                  {l.code ? (
                    <Link href={`/license/${encodeURIComponent(l.code)}`}
                          className="hover:text-brand hover:underline">{l.name}</Link>
                  ) : l.name}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {single.length > 0 && (
          <div className="card p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-[15px] font-bold">한 종목으로 치르는 자격</h3>
              <span className="num text-xs text-muted">{single.length}종목</span>
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13.5px]">
              {single.map((l) => (
                <li key={l.code || l.name} className="text-ink2">
                  {l.code ? (
                    <Link href={`/license/${encodeURIComponent(l.code)}`}
                          className="hover:text-brand hover:underline">{l.name}</Link>
                  ) : l.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
