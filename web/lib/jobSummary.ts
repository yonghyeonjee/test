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

export type LoadedSummary = { summary: JobSummary; files: string[]; updated: string };

type Row = { summary: Partial<JobSummary> | null; files?: string[] | null; updated_at?: string | null };

/**
 * 저장된 한 줄을 화면 모양으로. 모집 분야·자격·서류·전형이 하나도 없으면 빈 요약(null)으로 친다.
 * 공고 쪽과 사이트맵(getTopJobIds)이 "요약이 있다"를 같은 기준으로 보도록 여기 하나만 둔다.
 */
export function toLoadedSummary(row: Row | null): LoadedSummary | null {
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
}

/**
 * 엄격한 판. 색인 여부(robots)를 정하는 쪽이 쓴다 — "요약이 없다"와 "못 읽었다"를 가려야 해서
 * DB 오류를 null 로 삼키지 않고 던진다(getGuideBySlugStrict 와 같은 꼴). 부르는 쪽은 오류면 요약이
 * 있는 것으로 치고 색인을 남긴다(2026-10-17 — 잠깐의 DB 오류로 noindex 가 사흘 캐시에 남지 않게).
 */
export const getJobSummaryStrict = cache(async (sourceId: string): Promise<LoadedSummary | null> => {
  if (!dbConfigured) return null;
  const { data, error } = await db.from("job_summaries_public").select("summary,files,updated_at").eq("source_id", sourceId).maybeSingle();
  if (error) throw new Error(`[getJobSummary ${sourceId}] ${error.message}`);
  return toLoadedSummary(data as Row | null);
});

/** 화면에 그릴 때 쓰는 느슨한 판. 못 읽으면 요약 없이 그린다. */
export const getJobSummary = cache(async (sourceId: string): Promise<LoadedSummary | null> => {
  try {
    return await getJobSummaryStrict(sourceId);
  } catch {
    return null;
  }
});
