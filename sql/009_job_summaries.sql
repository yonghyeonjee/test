-- 2026-10-10 적용됨 (Supabase 마이그레이션 job_summaries).
-- 공고 요약. 나라일터 공고에 붙은 공고문(pdf·hwp·hwpx)을 읽어 모집 분야·인원, 자격, 접수 기간·방법, 제출 서류,
-- 전형 절차, 근무 조건을 뽑아 둔다. pipeline/job_summary.py 가 쓰고, 공고 쪽(/jobs/<id>)이 읽는다.
--   source_id : job_posts.source_id (gojobs)
--   summary   : {one_line, positions[], requirements[], preferred[], period{}, documents[], process[], work{}, contact, notes[]}
--   files     : 읽은 첨부 파일 이름

create table if not exists public.job_summaries (
  source_id  text primary key,
  summary    jsonb not null,
  files      text[] not null default '{}',
  chars      integer not null default 0,
  model      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_summaries enable row level security;

create or replace view public.job_summaries_public as
  select source_id, summary, files, updated_at from public.job_summaries;

grant select on public.job_summaries_public to anon, authenticated;
