import { cache } from "react";
import { db, dbConfigured } from "./db";

/**
 * 공고 요약(job_summaries). 파이프라인(pipeline/job_summary.py)이 첨부 공고문을 읽어 뽑아 둔 것.
 * 여기서는 읽기만 한다. 요약이 비어 있으면(그림 공고 등) null.
 */
export type JobSummary = {
  one_line: string;
  positions: { name: string; headcount: string; grade: string; type: string }[];
  requirements: string[];
  preferred: string[];
  period: { start: string; end: string; how: string };
  documents: string[];
  process: string[];
  work: { place: string; hours: string; pay: string; term: string };
  contact: string;
  notes: string[];
};

export const getJobSummary = cache(async (sourceId: string): Promise<{ summary: JobSummary; files: string[]; updated: string } | null> => {
  if (!dbConfigured) return null;
  try {
    const { data } = await db.from("job_summaries_public").select("summary,files,updated_at").eq("source_id", sourceId).maybeSingle();
    const row = data as { summary: Partial<JobSummary> | null; files: string[]; updated_at: string } | null;
    const s = row?.summary;
    if (!s || !Array.isArray(s.positions) && !Array.isArray(s.requirements)) return null;
    const filled = (s.positions?.length ?? 0) + (s.requirements?.length ?? 0) + (s.documents?.length ?? 0) + (s.process?.length ?? 0);
    if (!filled) return null;
    return {
      summary: {
        one_line: s.one_line ?? "", positions: s.positions ?? [], requirements: s.requirements ?? [], preferred: s.preferred ?? [],
        period: { start: "", end: "", how: "", ...(s.period ?? {}) }, documents: s.documents ?? [], process: s.process ?? [],
        work: { place: "", hours: "", pay: "", term: "", ...(s.work ?? {}) }, contact: s.contact ?? "", notes: s.notes ?? [],
      },
      files: row?.files ?? [], updated: row?.updated_at ?? "",
    };
  } catch {
    return null;
  }
});
