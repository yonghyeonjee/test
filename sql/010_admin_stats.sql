-- 2026-10-13 적용됨 (Supabase 마이그레이션 admin_stats_functions + 색인).
-- 관리자 화면이 한 번에 읽는 집계. 전에는 수집 대상 8개 × 3 질의 + 건수 7 질의를 따로 보내 왕복이 30번 넘었고,
-- "마지막 수집 시각"(order by fetched_at desc limit 1)은 색인이 없어 job_posts 24만 건을 훑었다(300ms × 2).
--   admin_source_stats() returns jsonb  — [{key, n, newest, fetched}] 수집 대상 8개
--   admin_counts(p_since, p_today, p_since7) returns jsonb — 검색·유입·저장 건수 7개
--   job_posts_source_fetched_idx (source, fetched_at desc nulls last)
-- 함수 본문은 Supabase 에 적용된 정의가 원본이다. service_role 만 실행. web/app/admin/page.tsx 가 쓴다.

create index concurrently if not exists job_posts_source_fetched_idx on public.job_posts (source, fetched_at desc nulls last);
