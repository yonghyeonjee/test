-- 2026-10-10 적용됨 (Supabase 마이그레이션 org_guides).
-- 기관별 "자기소개서·직무수행계획서 작성 가이드". pipeline/org_guide.py 가 하루 몇 곳씩 만들어 넣고,
-- 웹(/jobs/guide/<slug>)은 저장된 것만 읽는다. 한 번 만든 글은 120일 뒤에 다시 쓴다.
--   org      : 나라일터 기관 이름(job_posts.org 와 같은 글자)
--   facts    : 웹 검색(Gemini 검색 접지)으로 모은 사실 — 인재상·핵심가치·전형 절차·자소서 문항·직무수행계획서 요구. 항목마다 출처
--   sources  : [{title, uri, domain}] 접지 출처
--   stats    : 우리 자료(공고 수·접수 기간·직무 분포)
--   body     : 블로그와 같은 블록(toc·p·h2·list·table·links·note)
--   faq      : [{q, a}] FAQPage 로 알린다

create table if not exists public.org_guides (
  org          text primary key,
  slug         text not null unique,
  title        text not null,
  summary      text not null,
  keywords     text[] not null default '{}',
  body         jsonb not null,
  faq          jsonb not null default '[]',
  facts        jsonb not null default '{}',
  sources      jsonb not null default '[]',
  stats        jsonb not null default '{}',
  model        text,
  published_at date not null default current_date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.org_guides enable row level security;

create or replace view public.org_guides_public as
  select org, slug, title, summary, keywords, body, faq, sources, stats, published_at, updated_at
  from public.org_guides
  where published_at <= current_date;

grant select on public.org_guides_public to anon, authenticated;
