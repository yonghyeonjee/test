"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchOrgNews, ORGS_EVENT, orgHref, readOrgs, removeOrg, syncOrgs, type OrgNews, type SavedOrg } from "@/lib/savedOrgs";

/**
 * 저장한 기관과 그 사이 올라온 공고(2026-11-27).
 *  strip : 첫 화면에 가로 한 줄. 저장한 기관이 없으면 아무것도 안 그린다.
 *  list  : /saved 에 세로 목록. 새 공고 제목까지 보이고 지우기 단추가 있다.
 * "새 공고"는 그 기관의 공고 목록을 마지막으로 본 뒤 들어온 것이다(기관 화면에 들어가면 지워진다).
 */
export default function SavedOrgs({ variant = "list", className = "" }: { variant?: "strip" | "list"; className?: string }) {
  const [orgs, setOrgs] = useState<SavedOrg[] | null>(null);
  const [news, setNews] = useState<Record<string, OrgNews>>({});

  useEffect(() => {
    const load = () => {
      const list = readOrgs();
      setOrgs(list);
      void fetchOrgNews(list).then((ns) => setNews(Object.fromEntries(ns.map((n) => [n.name, n]))));
    };
    load();
    void syncOrgs();   // 서버 목록과 다르면 고쳐 쓰고, 그때 ORGS_EVENT 로 다시 그린다
    window.addEventListener(ORGS_EVENT, load);
    return () => window.removeEventListener(ORGS_EVENT, load);
  }, []);

  if (!orgs) return null;
  // 새 공고가 있는 기관을 앞으로.
  const list = orgs.slice().sort((a, b) => (news[b.name]?.fresh ?? 0) - (news[a.name]?.fresh ?? 0));
  const line = (o: SavedOrg) => {
    const n = news[o.name];
    if (!n) return "확인 중…";
    return n.open > 0 ? `접수 중 ${n.open}건` : "지금 접수 중인 공고 없음";
  };
  const badge = (o: SavedOrg) => {
    const f = news[o.name]?.fresh ?? 0;
    return f > 0 ? <span className="num shrink-0 rounded-pill bg-brand px-2 py-0.5 text-[11.5px] font-bold text-white">새 공고 {f >= 20 ? "20+" : f}건</span> : null;
  };

  if (variant === "strip") {
    if (!list.length) return null;
    return (
      <section className={className} aria-label="저장한 기관">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] font-bold text-muted">저장한 기관</h2>
          <Link href="/saved" className="py-1 text-[12px] text-faint hover:text-brand">모두 보기</Link>
        </div>
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {list.slice(0, 8).map((o) => (
            <li key={o.name} className="shrink-0">
              <Link href={orgHref(o.name)} className="block w-[13.5rem] rounded-card border border-line bg-surface px-3.5 py-2.5 hover:border-brand">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-semibold text-ink">{o.name}</span>
                  {badge(o)}
                </span>
                <span className="num mt-0.5 block truncate text-[12px] text-muted">{line(o)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!list.length)
    return (
      <p className={`text-[13.5px] leading-relaxed text-muted ${className}`}>
        아직 저장한 기관이 없습니다. 기관 채용 화면이나 공고에서 <b className="text-ink">이 기관 새 공고 챙기기</b>를 누르면 여기 쌓이고,
        새 공고가 올라오면 알려 드립니다.
      </p>
    );

  return (
    <ul className={`divide-y divide-line ${className}`}>
      {list.map((o) => {
        const n = news[o.name];
        return (
          <li key={o.name} className="py-3">
            <div className="flex items-start gap-3">
              <Link href={orgHref(o.name)} className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-semibold leading-snug text-ink">{o.name}</span>
                  {badge(o)}
                </span>
                <span className="num mt-1 block text-[12.5px] text-muted">{line(o)}</span>
              </Link>
              <button type="button" aria-label={`${o.name} 저장 해제`} onClick={() => removeOrg(o.name)}
                      className="shrink-0 rounded-pill px-2.5 py-1.5 text-[12.5px] text-faint transition-colors hover:bg-ground hover:text-alert">
                지우기
              </button>
            </div>
            {n && n.items.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {n.items.map((it) => (
                  <li key={it.id}>
                    <Link href={`/jobs/${encodeURIComponent(it.id)}`} className="block rounded-[10px] bg-ground px-3 py-2 text-[13px] leading-snug text-ink2 hover:text-brand">
                      {it.title}
                      {it.end && <span className="num ml-1.5 text-[12px] text-muted">~{it.end.slice(5).replace("-", ".")}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
