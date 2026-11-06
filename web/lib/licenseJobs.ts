import { cache } from "react";

import { db, dbConfigured } from "./db";
import { todayKst } from "./calendar";

/**
 * 이 자격증을 응시 자격·우대 사항에 적은 공공기관 채용 공고(2026-11-06).
 *
 * 큐넷 원문에는 없고 이 사이트만 셀 수 있는 숫자다 — 나라일터 공고문을 요약해 둔 job_summaries 의
 * requirements·preferred 에서 종목 이름을 찾는다. 자격증 상세 쪽이 서치 콘솔에서 "크롤링됨 - 색인 안 됨" 이
 * 가장 많은 묶음이라(표본 20쪽 중 18쪽), 원문과 다른 내용을 붙이려는 것이다.
 * 요약이 있는 공고만 센다. 이름이 짧으면(3자 이하) 다른 낱말에 섞여 잘못 걸리므로 세지 않는다.
 */
export type LicenseJobs = {
  total: number;
  openN: number;
  since: string | null;
  open: { id: string; title: string; org: string | null; end: string | null }[];
};

// or() 안에서 쉼표·괄호·따옴표는 문법 글자라 뺀다. 따옴표로 감싸면 * 가 와일드카드로 안 읽혀 0건이 된다(2026-11-06).
const clean = (name: string) => name.replace(/\(.*?\)/g, "").replace(/["*,().%_\\\s]/g, "").trim();

export const getLicenseJobs = cache(async (name: string): Promise<LicenseJobs | null> => {
  const key = clean(name);
  if (!dbConfigured || key.length < 4) return null;
  try {
    const { data, error } = await db
      .from("job_summaries")
      .select("source_id")
      .or(`summary->>requirements.ilike.*${key}*,summary->>preferred.ilike.*${key}*`)
      .limit(1000);
    if (error || !data?.length) return null;
    const ids = Array.from(new Set((data as { source_id: string }[]).map((d) => d.source_id)));
    type P = { source_id: string; title: string; org: string | null; reg_date: string | null; end_date: string | null };
    const posts: P[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const r = await db.from("job_posts").select("source_id,title,org,reg_date,end_date")
        .eq("source", "gojobs").in("source_id", ids.slice(i, i + 200));
      if (r.error) return null;
      posts.push(...((r.data ?? []) as P[]));
    }
    if (!posts.length) return null;
    const today = todayKst();
    const open = posts.filter((p) => p.end_date && p.end_date >= today)
      .sort((a, b) => (a.end_date ?? "").localeCompare(b.end_date ?? ""));
    const regs = posts.map((p) => p.reg_date).filter(Boolean).sort() as string[];
    return {
      total: posts.length,
      openN: open.length,
      since: regs[0] ?? null,
      open: open.slice(0, 5).map((p) => ({ id: p.source_id, title: p.title, org: p.org, end: p.end_date })),
    };
  } catch {
    return null;
  }
});
