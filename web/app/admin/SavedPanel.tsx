import Link from "next/link";
import { describeQuery, fmtBizNo, fmtPhone } from "@/lib/saved";

export type SavedFull = {
  id: number;
  kind: "welfare" | "business";
  label: string | null;
  query: string;
  name: string;
  phone: string;
  email: string;
  biz_no: string | null;
  created_at: string;
};

const when = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * 저장 신청이 들어온 목록. 연락처가 그대로 보이는 화면이므로
 * 로그인 뒤에서만 렌더한다.
 */
export default function SavedPanel({ rows }: { rows: SavedFull[] }) {
  if (!rows.length)
    return <p className="text-sm text-muted">아직 저장된 조건이 없습니다.</p>;

  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => {
        const bits = describeQuery(r.query);
        const biz = fmtBizNo(r.biz_no);
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
              <b className="text-[15px]">{r.name}</b>
              <a
                href={`tel:${r.phone}`}
                className="num text-sm text-brand underline underline-offset-4"
              >
                {fmtPhone(r.phone)}
              </a>
              <span className="num ml-auto text-xs text-faint">
                {when(r.created_at)}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <a
                href={`mailto:${r.email}`}
                className="underline underline-offset-4 hover:text-brand"
              >
                {r.email}
              </a>
              {biz && <span className="num">사업자 {biz}</span>}
              {r.label && <span>메모: {r.label}</span>}
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
