-- 2026-10-16 적용됨 (Supabase apply_migration tistory_posts).
-- 티스토리(abcfact.tistory.com)에 올린 blog_posts 글의 기록. pipeline/tistory_publish.py 가 쓴다.
-- 한 글은 한 번만 올린다(slug pk). 여기서 줄을 지우면 다음 실행에 다시 올라가니,
-- 티스토리 쪽 글을 지우고 다시 올리고 싶을 때만 지운다.
--   post_id    : 티스토리 글 번호(주소 마지막 조각, https://abcfact.tistory.com/<post_id>)
--   mode       : 'summary'(요약 + 원문 링크, 기본) · 'full'(전문)
--   visibility : 'public' · 'protected' · 'private'
-- anon 은 못 읽는다. service_role(파이프라인)만 다룬다.

create table if not exists public.tistory_posts (
  slug        text primary key references public.blog_posts(slug) on delete cascade,
  post_id     text not null,
  url         text not null,
  mode        text not null default 'summary' check (mode in ('summary','full')),
  visibility  text not null default 'public' check (visibility in ('public','protected','private')),
  posted_at   timestamptz not null default now()
);

alter table public.tistory_posts enable row level security;
revoke all on public.tistory_posts from anon, authenticated;
