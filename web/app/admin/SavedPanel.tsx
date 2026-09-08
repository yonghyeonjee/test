import Link from "next/link";
import { describeQuery, fmtPhoneTail, when } from "@/lib/savedFormat";

export type SavedCond = {
  id: number;
  device_key: string;
  kind: string | null;
  label: string | null;
  query: string;
  created_at: string;
  open_count: number | null;
};

export type Account = {
  device_key: string;
  display_name: string | null;
  phone_tail: string | null;
  email: string | null;
  notify_consent: boolean | null;
};

/**
 * 저장된 조건과, 그 기기에 연결된 계정을 같이 보여준다.
 * 계정 없이 저장한 사람도 있으므로(기기에만 남긴 경우) 이름은 없을 수 있다.
 */
export default function SavedPanel({
  rows,
  accounts,
}: {
  rows: SavedCond[];
  accounts: Account[];
}) {
  if (!rows.length)
    return <p className="text-sm text-muted">아직 저장된 조건이 없습니다.</p>;

  const byDevice = new Map(accounts.map((a) => [a.device_key, a]));

  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => {
        const acc = byDevice.get(r.device_key);
        const tail = fmtPhoneTail(acc?.phone_tail ?? null);
        const bits = describeQuery(r.query);
        return (
          <li key={r.id} className="py-3.5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`badge ${
                  r.kind === "business" ? "badge-soon" : "badge-open"
                }`}
              >
                {r.kind === "business" ? "기업" : "개인"}
              </span>
              <b className="text-[15px]">
                {acc?.display_name ?? (
                  <span className="font-normal text-faint">계정 없음</span>
                )}
              </b>
              {tail && <span className="num text-sm text-muted">···{tail}</span>}
              <span className="num ml-auto text-xs text-faint">
                {when(r.created_at)}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              {acc?.email ? (
                <a
                  href={`mailto:${acc.email}`}
                  className="underline underline-offset-4 hover:text-brand"
                >
                  {acc.email}
                </a>
              ) : (
                <span className="text-faint">연락처 없음</span>
              )}
              {acc?.notify_consent && <span className="text-brand">안내 수신 동의</span>}
              {r.label && <span>메모: {r.label}</span>}
              {!!r.open_count && <span className="num">{r.open_count}회 열람</span>}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {bits.length ? (
                bits.map((b) => (
                  <span key={b} className="badge badge-quiet">
                    {b}
                  </span>
                ))
              ) : (
                <span className="text-xs text-faint">조건 없음</span>
              )}
              <Link
                href={`/?${r.query}`}
                className="text-xs text-muted underline underline-offset-4 hover:text-brand"
              >
                이 조건으로 열기
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
