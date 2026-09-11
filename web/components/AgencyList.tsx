import Link from "next/link";
import { dot, type AlioItem } from "@/lib/alioplus";

export type Facet = { name: string; label: string; options: { code: string; label: string }[] };

function href(base: string, cur: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

/**
 * 알리오 플러스 자료 목록. 사업·행사·시설이 같은 틀을 쓴다.
 *
 * 거르기는 API 가 받는 조건을 그대로 링크로 만든다. 서버가 걸러 주므로
 * 화면은 받은 것을 보여 주기만 한다. 검색어는 GET 폼이라 스크립트가 없어도 된다.
 */
export default function AgencyList({
  base, items, ok, reason, facets, current, qName, empty, external,
}: {
  base: string;
  items: AlioItem[];
  ok: boolean;
  reason: string | null;
  facets: Facet[];
  current: Record<string, string | undefined>;
  /** 검색어 파라미터 이름. 없으면 검색창을 그리지 않는다. */
  qName?: string;
  empty: string;
  /** 자료를 못 받았을 때 대신 보낼 곳. */
  external: { href: string; label: string };
}) {
  const active = Object.values(current).some(Boolean);
  return (
    <div className="mt-6">
      {qName && (
        <form action={base} method="get" className="flex gap-2">
          {Object.entries(current)
            .filter(([k, v]) => k !== qName && v)
            .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input name={qName} defaultValue={current[qName] ?? ""}
                 placeholder="기관명·이름·소개로 찾기" className="field min-w-0 flex-1"
                 aria-label="검색어" />
          <button type="submit" className="btn btn-primary shrink-0 px-5 py-2.5">찾기</button>
        </form>
      )}

      {facets.map((f) => (
        <div key={f.name} className="mt-4">
          <span className="mr-2 text-xs font-bold text-muted">{f.label}</span>
          <span className="inline-flex flex-wrap gap-1.5 align-middle">
            {f.options.map((o) => {
              const on = current[f.name] === o.code;
              return (
                <Link key={o.code}
                      href={href(base, current, { [f.name]: on ? undefined : o.code })}
                      className={`chip !py-1.5 !text-[13px] ${on ? "chip-on" : ""}`}>
                  {o.label}
                </Link>
              );
            })}
          </span>
        </div>
      ))}

      {!ok ? (
        <div className="card mt-6 p-8 text-center">
          <p className="leading-relaxed text-muted">
            지금은 자료를 불러오지 못했습니다.
            {reason?.includes("인증키") ? (
              <>
                <br />
                알리오 플러스 인증키가 아직 연결되지 않았습니다.
              </>
            ) : (
              <>
                <br />
                잠시 뒤 다시 들어오시면 보입니다.
              </>
            )}
          </p>
          <a href={external.href} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-5">
            {external.label}
          </a>
        </div>
      ) : (
        <>
          <div className="mb-3 mt-8 flex items-baseline justify-between">
            <h2 className="text-[1.0625rem] font-bold">{active ? "조건에 맞는 것" : "전체"}</h2>
            <span className="num text-sm text-muted">{items.length}건</span>
          </div>
          {items.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="leading-relaxed text-muted">{empty}</p>
              <Link href={base} className="btn btn-ghost mt-5">조건 지우기</Link>
            </div>
          ) : (
            <ul className="grid gap-3">
              {items.map((it) => {
                const inner = (
                  <>
                    {it.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {it.tags.map((t) => <span key={t} className="badge badge-quiet">{t}</span>)}
                      </div>
                    )}
                    <b className="mt-2 block text-[15px] leading-snug">{it.title}</b>
                    <span className="mt-1 block text-[13px] text-muted">
                      {[it.org, it.cate, it.address].filter(Boolean).join(" · ")}
                    </span>
                    {it.target && (
                      <span className="mt-1 block text-[13px] text-ink2">대상 {it.target}</span>
                    )}
                    {it.desc && (
                      <span className="mt-1.5 line-clamp-2 block text-[13.5px] leading-relaxed text-muted">
                        {it.desc}
                      </span>
                    )}
                    {(it.start || it.end) && (
                      <span className="num mt-1.5 block text-xs text-muted">
                        {dot(it.start) ?? "—"} ~ {dot(it.end) ?? "—"}
                      </span>
                    )}
                  </>
                );
                return (
                  <li key={it.id}>
                    {it.url ? (
                      <a href={it.url} target="_blank" rel="noopener noreferrer"
                         className="card card-link block p-5">{inner}</a>
                    ) : (
                      <div className="card block p-5">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
