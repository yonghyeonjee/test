-- 2026-10-13 적용됨 (Supabase execute_sql; 표·색인·RLS·권한만).
-- 저장한 공고·사업(즐겨찾기). 저장 조건(saved_condition)과 같은 기기 열쇠(UUID)가 주인이다.
-- 계정으로 로그인하면 계정 열쇠가 되고, 로그인할 때 이 브라우저 열쇠의 저장분을 계정 열쇠로 옮긴다
-- (web/app/account/actions.ts loginAccount). 읽기·쓰기는 전부 서버(service_role)가 한다 —
-- web/app/api/saved/items/route.ts. 함수(rpc)는 두지 않고 PostgREST 로 바로 다룬다.
--   kind    : 'p'(지원사업 /p/<id>) · 'job'(채용 /jobs/<id>)
--   item_id : programs.source_id · job_posts.source_id
--   title/sub : 목록에 보일 제목과 부제(지역·기관). end_date 는 접수 마감(지나면 '마감' 표시).
-- 기기마다 100건까지. 넘으면 가장 오래된 것부터 지운다.

create table if not exists public.saved_item (
  id         bigserial primary key,
  device_key uuid not null,
  kind       text not null check (kind in ('p','job')),
  item_id    text not null,
  title      text not null,
  sub        text,
  end_date   date,
  created_at timestamptz not null default now(),
  unique (device_key, kind, item_id)
);
create index if not exists saved_item_device_idx on public.saved_item (device_key, created_at desc);
alter table public.saved_item enable row level security;
revoke all on table public.saved_item from anon, authenticated;
revoke all on sequence public.saved_item_id_seq from anon, authenticated;
