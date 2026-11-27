-- 2026-11-27 적용됨 (Supabase apply_migration; 사용자 승인).
--
-- 1) 저장한 기관을 서버에 둔다. saved_item 의 kind 에 'org' 를 더하고, "그 기관의 공고를 마지막으로 본 때"를
--    seen_at 에 적는다(그 뒤에 들어온 공고가 "새 공고"다). item_id 는 기관 이름(job_posts.org) 그대로.
--    전에는 브라우저(localStorage)에만 있어 브라우저를 정리하면 사라지고 계정으로 옮겨 다니지 못했다.
--
-- 2) 방문 흐름. visit_log 는 들어온 첫 쪽만 적는다 — 들어온 사람이 다음 쪽으로 넘어가는지, 한 쪽만 보고
--    나가는지 알 수 없었다(ChatGPT 유입 500건이 공고 하나만 보고 나가는지). 같은 탭에서 둘째 쪽부터 다섯째 쪽까지
--    "어느 길로 들어와(channel) 어느 쪽에 내려(landing) 몇 번째로(step) 어디를 봤나(path)"를 한 줄씩 적는다.
--    사람·기기를 가리키는 값은 없다(열쇠·IP·UA 없음). 줄끼리 이을 수 없고, 채널·첫 쪽별 비율만 센다.
--    읽기·쓰기는 서버(service_role)만 한다 — web/app/api/visit/step/route.ts.

alter table public.saved_item drop constraint if exists saved_item_kind_check;
alter table public.saved_item add constraint saved_item_kind_check check (kind in ('p', 'job', 'org'));
alter table public.saved_item add column if not exists seen_at timestamptz;

create table if not exists public.visit_step (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  channel text not null,
  landing text not null,
  step    smallint not null check (step between 2 and 5),
  path    text not null
);
create index if not exists visit_step_at_idx on public.visit_step (at desc);
alter table public.visit_step enable row level security;
revoke all on table public.visit_step from anon, authenticated;
