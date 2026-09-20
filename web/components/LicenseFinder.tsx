"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type FinderItem = { code: string; name: string; series: string; field: string };

const MAX = 24;

/**
 * 자격증 이름으로 바로 찾기.
 *
 * 600개가 넘는 종목을 분야별로 접어 두면 "정보처리기사가 어느 분야지?" 부터
 * 막힌다. 화면에 들어온 사람은 대개 이름 하나를 들고 온다. 이름 한두 글자만
 * 쳐도 바로 좁혀지게 한다. 서버를 거치지 않고 손에 든 목록에서 거른다.
 */
export default function LicenseFinder({
  items,
  placeholder = "예: 정보처리, 지게차, 사회복지사",
  emptyNote = "이 이름의 종목이 없습니다. 국가전문자격은 따로 모아 두었으니 그 화면에서 찾아보세요.",
  initial = "",
}: { items: FinderItem[]; placeholder?: string; emptyNote?: string; initial?: string }) {
  // 채용 공고에서 "관련 자격증"을 누르면 검색어가 채워진 채로 온다.
  const [q, setQ] = useState(initial);
  const key = q.trim().replace(/\s+/g, "").toLowerCase();

  const hits = useMemo(() => {
    if (!key) return [];
    const out: FinderItem[] = [];
    // 앞글자가 맞는 것을 먼저, 그다음 중간에 들어 있는 것.
    for (const l of items) if (l.name.replace(/\s+/g, "").toLowerCase().startsWith(key)) out.push(l);
    for (const l of items) {
      const n = l.name.replace(/\s+/g, "").toLowerCase();
      if (!n.startsWith(key) && n.includes(key)) out.push(l);
    }
    return out;
  }, [items, key]);

  return (
    <div className="card mt-6 p-4 sm:p-5">
      <label htmlFor="license-q" className="block text-[14.5px] font-bold">
        자격증 이름으로 찾기
      </label>
      <input
        id="license-q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="field mt-2 w-full"
        autoComplete="off"
        inputMode="search"
      />
      {key && (
        <div className="mt-3" aria-live="polite">
          {hits.length === 0 ? (
            <p className="text-[13.5px] leading-relaxed text-muted">{emptyNote}</p>
          ) : (
            <>
              <p className="text-xs text-muted">
                <span className="num font-bold text-ink2">{hits.length}</span>개 종목
                {hits.length > MAX && ` 중 ${MAX}개만 보입니다. 더 정확히 적어 보세요.`}
              </p>
              <ul className="mt-2 divide-y divide-line">
                {hits.slice(0, MAX).map((l) => (
                  <li key={l.code}>
                    <Link
                      href={`/license/${encodeURIComponent(l.code)}`}
                      className="flex items-baseline justify-between gap-3 py-2 hover:text-brand"
                    >
                      <span className="text-[14.5px] font-semibold">{l.name}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {l.series} · {l.field}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
